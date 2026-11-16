// Porta di Mare · asistente de reservas (Supabase Edge Function, Deno).
// La web le manda la conversación; la IA responde y, cuando el cliente confirma los datos,
// llama a la herramienta crear_reserva, que guarda la petición como «pendiente» en la base de datos.
//
// IA principal: Google Gemini. Si Gemini está saturado (429), falla (5xx) o tarda más de GEMINI_ESPERA_MS,
// esa conversación la atiende DeepSeek (solo si hay DEEPSEEK_API_KEY).
//
// Secretos (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY     la clave de Google AI Studio (obligatoria; nunca va en la web)
//   DEEPSEEK_API_KEY   opcional: clave de DeepSeek para la reserva
//   ALLOWED_ORIGIN     opcional: dominios que pueden usar el chat, separados por comas
//                      (p. ej. https://tuusuario.github.io). Sin él, cualquiera.
//   GEMINI_MODEL       opcional: modelo de Gemini (por defecto gemini-3.5-flash-lite)
//   DEEPSEEK_MODEL     opcional: modelo de DeepSeek (por defecto deepseek-flash, V4.1 Flash)
//   GEMINI_ESPERA_MS   opcional: cuánto esperar a Gemini antes de pasar a DeepSeek (por defecto 12000)
//   TELEGRAM_BOT_TOKEN opcional: token del bot de Telegram (clientes por Telegram + avisos al restaurante)
//   TELEGRAM_ADMIN     opcional: usuario de Telegram del restaurante (sin @); solo él puede activar los avisos
//   GEMINI_TTS_MODEL   opcional: modelo de voz para contestar notas de voz (por defecto gemini-3.8-flash-lite-tts)
//   GEMINI_VOZ         opcional: voz de Gemini (por defecto Kore)
//
// Telegram: entiende notas de voz (Gemini las transcribe) y, si el cliente habla por voz, contesta con voz.
//
// Rutas: POST /chat (web) · POST /chat?telegram=1 (webhook) · GET /chat?telegram_setup=1 (conectar el bot)
//        POST /chat?aviso=1 (lo llama la base de datos al entrar una petición)
// SUPABASE_URL y las claves internas (SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY) los pone Supabase solo.

import { Mp3Encoder } from "npm:@breezystack/lamejs@1.2.7";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const TTS_MODELO = Deno.env.get("GEMINI_TTS_MODEL") || "gemini-3.8-flash-lite-tts";
const VOZ = Deno.env.get("GEMINI_VOZ") || "Kore";
const MODELO = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
const GEMINI_ESPERA_MS = Number(Deno.env.get("GEMINI_ESPERA_MS")) || 12000;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const DEEPSEEK_MODELO = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-flash";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Clave para llamar a pedir_reserva(): la anon clásica si existe; si no, la de servidor que Supabase
// pone en la función (nunca sale de aquí). Las dos pasan por las mismas validaciones de la base de datos.
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TG_ADMIN = (Deno.env.get("TELEGRAM_ADMIN") || "").replace(/^@/, "").trim().toLowerCase();
const ORIGENES = (Deno.env.get("ALLOWED_ORIGIN") || "").split(",").map((s) => s.trim()).filter(Boolean);

// Límites para que nadie gaste la clave con conversaciones eternas
const MAX_MENSAJES = 30;
const MAX_CARACTERES = 1000;

/* Lo que sabe el asistente */
const SISTEMA = `Eres el asistente de reservas de Porta di Mare, «Ristorante · Terrazza · Crew», un restaurante italiano con horno de leña y terraza en Premià de Mar.

Datos del restaurante:
- Dirección: Carrer d'Enric Granados, 97, 08330 Premià de Mar.
- Teléfono y WhatsApp: 633 45 06 54. Instagram: @portadimare.ristorante.
- Horario: lunes y martes cerrado. De miércoles a domingo, comida de 12:00 a 16:00 y cena de 20:00 a 23:00.
- Mesas dentro y en terraza. Grupos, cumpleaños y cenas de empresa: se preparan; para grupos grandes conviene avisar con antelación.
- Carta de pizzas (precios con IVA): Marinara 10,00 € (tomate, ajo, orégano); Margherita 11,00 € (mozzarella, tomate); Napoli 13,00 € (tomate, mozzarella, anchoas, orégano); Parmigiana 13,00 € (vegetal: tomate, mozzarella, berenjena, parmesano); Baldo 5 13,00 € (tomate, mozzarella, pesto, atún); Tonno 13,50 € (tomate, mozzarella, atún); Romanaccia 14,00 € (tomate, mozzarella, atún, cebolla); Mac II 14,00 € (vegetal: tomate, stracchino, espinaca, rábano, berenjena, calabacín); 4 Formaggi 14,50 € (tomate, mozzarella, taleggio, scamorza, gorgonzola); Jordi II 15,50 € (tomate, mozzarella de búfala, tomates semisecos, albahaca); Cestino di Wilma 16,00 € (tomate, mozzarella, berenjena, tomates semisecos, mozzarella de búfala).
- Calzone: Calzone 13,50 € (tomate, mozzarella, jamón cocido); Calzone farcito 14,50 € (tomate, mozzarella, champiñones, alcachofas, olivas, jamón cocido); Calzone Aiur 16,50 € (tomate, mozzarella, queso de cabra, huevo, rosbif).
- Suplementos de pizza: masa negra de carbón 1,50 €; masa sin gluten 3,00 €; masa integral 1,50 €; pescado, carne, embutidos o setas 2,50 €; trufa negra 4,00 €; otros ingredientes 1,00 €.
- También hay antipasti, pasta y postres (vitello tonnato, burrata, tiramisù, panna cotta…), pero su carta y precios no están publicados: di que se pueden consultar en el local.
- Alérgenos: los platos pueden contener huevo, gluten, pescado, frutos de cáscara o lácteos. Hay masa sin gluten. Para alergias, que lo indiquen en la reserva y lo consulten con el personal.

Cómo reservar:
1. Para pedir una reserva necesitas: nombre, número de personas, día, hora y un teléfono de contacto. El servicio (Comida o Cena) sale de la hora. Las notas (celebración, alergias, terraza, trona…) son opcionales: pregúntalas una vez.
2. Pide los datos que falten de forma natural, de uno en uno o de dos en dos. No pidas lo que el cliente ya ha dicho.
3. Convierte días relativos («mañana», «el sábado») en una fecha concreta usando la fecha de hoy que se te da. Si el día cae en lunes o martes, o la hora está fuera del horario, dilo y propone otra.
4. Antes de guardar, resume la reserva en una línea (día con el nombre del día, hora, personas, nombre, teléfono, notas) y pide confirmación explícita. Solo cuando el cliente confirme, llama a crear_reserva, una sola vez.
5. Después explica que es una petición: el restaurante la confirmará por teléfono o WhatsApp. Nunca digas que la mesa ya está confirmada ni prometas una mesa o zona concreta.
6. Si crear_reserva devuelve un error, explica el motivo con tus palabras y ayuda a corregirlo.
7. Cuando se guarda, crear_reserva devuelve un código de 6 caracteres: díselo al cliente y explícale que con ese código puede consultar, cambiar o anular su reserva escribiendo aquí.

Consultar, cambiar o anular una reserva:
- Pide siempre el código de reserva; sin código no puedes buscarla (si no lo tiene, que llame al 633 45 06 54). Nunca inventes ni adivines códigos.
- Con el código, llama a consultar_reserva y cuéntale los datos y el estado con tus palabras.
- Para cambiarla (día, hora, personas o notas) o anularla: resume lo que vas a hacer y pide confirmación explícita; solo entonces llama a modificar_reserva o anular_reserva.
- Al cambiarla, explica que vuelve a quedar pendiente: el restaurante la confirmará de nuevo. Las reservas ya pasadas, anuladas o atendidas no se pueden cambiar.

Estilo: responde en el idioma del cliente (castellano, catalán o inglés). Mensajes cortos, cálidos y claros, sin listas largas ni markdown. No inventes platos, precios ni servicios que no estén aquí. Si te preguntan algo que no sabes, da el teléfono. Si la conversación no tiene que ver con el restaurante, reconduce con amabilidad.`;

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function hoyEnMadrid() {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" });
  const partes = Object.fromEntries(f.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const iso = `${partes.year}-${partes.month}-${partes.day}`;
  const dia = DIAS[new Date(iso + "T12:00:00Z").getUTCDay()];
  return { iso, dia };
}

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const permitido = !ORIGENES.length ? "*" : ORIGENES.includes(origin) ? origin : ORIGENES[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(req: Request, status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" } });
}

/* Guarda la petición con la misma función pública que usa el formulario (valida días, horas y límites) */
async function pedirReserva(r: { nombre: string; personas: number; dia: string; servicio: string; hora: string; telefono: string; notas: string }, origen = "Chat") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pedir_reserva`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_n: r.nombre, p_p: r.personas, p_d: r.dia, p_s: r.servicio, p_h: r.hora, p_x: r.notas || "", p_tel: r.telefono, p_origen: origen }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true as const, codigo: String(j?.codigo || "") };
  return { ok: false as const, error: String(j?.message || "No se ha podido guardar la reserva") };
}

/* Consultar, cambiar y anular por código: solo con la clave de servidor (la web no puede llamarlas) */
async function rpcServidor(nombre: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await res.json().catch(() => null);
  if (res.ok) return { ok: true as const, datos: j as Record<string, unknown> | null };
  return { ok: false as const, error: String(j?.message || "No se ha podido completar") };
}

/* ——— Las herramientas, iguales para las dos IA ——— */
type Herramienta = {
  nombre: string;
  descripcion: string;
  parametros: Record<string, { type: string; description: string; enum?: string[] }>;
  obligatorios: string[];
};
const CODIGO = { type: "string", description: "Código de reserva de 6 caracteres que tiene el cliente (p. ej. K7Q2XM)" };
const HERRAMIENTAS: Herramienta[] = [{
  nombre: "crear_reserva",
  descripcion: "Guarda la petición de reserva en el libro del restaurante como pendiente de confirmar y devuelve su código. Úsala una sola vez y solo después de que el cliente haya confirmado explícitamente el resumen.",
  parametros: {
    nombre: { type: "string", description: "Nombre de quien reserva" },
    personas: { type: "integer", description: "Número de personas, de 1 a 80" },
    dia: { type: "string", description: "Fecha en formato AAAA-MM-DD" },
    servicio: { type: "string", enum: ["Comida", "Cena"], description: "Comida (12:00-16:00) o Cena (20:00-23:00)" },
    hora: { type: "string", description: "Hora de llegada en formato HH:MM, 24 h" },
    telefono: { type: "string", description: "Teléfono de contacto" },
    notas: { type: "string", description: "Celebración, alergias, terraza, trona… Cadena vacía si no hay" },
  },
  obligatorios: ["nombre", "personas", "dia", "servicio", "hora", "telefono", "notas"],
}, {
  nombre: "consultar_reserva",
  descripcion: "Busca una reserva por su código y devuelve sus datos y su estado (pendiente, confirmada, llegada, novino o anulada).",
  parametros: { codigo: CODIGO },
  obligatorios: ["codigo"],
}, {
  nombre: "modificar_reserva",
  descripcion: "Cambia el día, la hora, las personas o las notas de una reserva existente. Pasa solo lo que cambia. Úsala solo después de consultarla y de que el cliente confirme el cambio. La reserva vuelve a quedar pendiente de confirmar por el restaurante.",
  parametros: {
    codigo: CODIGO,
    dia: { type: "string", description: "Nuevo día, AAAA-MM-DD" },
    hora: { type: "string", description: "Nueva hora, HH:MM, 24 h" },
    personas: { type: "integer", description: "Nuevo número de personas" },
    notas: { type: "string", description: "Notas nuevas completas (sustituyen a las anteriores)" },
  },
  obligatorios: ["codigo"],
}, {
  nombre: "anular_reserva",
  descripcion: "Anula una reserva por su código. Úsala solo después de consultarla y de que el cliente confirme que quiere anularla.",
  parametros: { codigo: CODIGO },
  obligatorios: ["codigo"],
}];

type Texto = { role: "user" | "assistant"; content: string };
type Estado = { reserva: Record<string, unknown> | null; origen: string };
const ESTADOS: Record<string, string> = {
  pendiente: "pendiente de confirmar por el restaurante", confirmada: "confirmada por el restaurante",
  llegada: "ya ha pasado (el cliente vino)", novino: "ya ha pasado (no se presentó)", anulada: "anulada",
};

/* Ejecuta una herramienta. Solo se crea una reserva por conversación (con cualquiera de las dos IA). */
async function ejecutar(nombre: string, args: Record<string, unknown>, estado: Estado): Promise<string> {
  if (nombre === "crear_reserva") {
    if (estado.reserva) return `Ya se ha guardado una reserva en esta conversación (código ${estado.reserva.codigo}). No guardes otra.`;
    const datos = {
      nombre: String(args.nombre ?? ""), personas: Math.round(Number(args.personas)), dia: String(args.dia ?? ""),
      servicio: String(args.servicio ?? ""), hora: String(args.hora ?? ""), telefono: String(args.telefono ?? ""), notas: String(args.notas ?? ""),
    };
    const g = await pedirReserva(datos, estado.origen);
    if (!g.ok) return `ERROR: ${g.error}. La reserva NO se ha guardado.`;
    estado.reserva = { nombre: datos.nombre, personas: datos.personas, dia: datos.dia, servicio: datos.servicio, hora: datos.hora, codigo: g.codigo };
    return `Petición guardada como pendiente. Código de reserva: ${g.codigo}. Dale el código al cliente: con él podrá consultar, cambiar o anular la reserva aquí mismo. El restaurante la confirmará por teléfono o WhatsApp.`;
  }
  const codigo = String(args.codigo ?? "");
  if (nombre === "consultar_reserva") {
    const g = await rpcServidor("consultar_reserva", { p_codigo: codigo });
    if (!g.ok) return `ERROR: ${g.error}`;
    if (!g.datos) return "No hay ninguna reserva con ese código. Pide al cliente que lo revise.";
    const r = g.datos;
    return `Reserva ${r.codigo}: ${r.nombre}, ${r.personas} personas, ${r.dia} (${DIAS[new Date(r.dia + "T12:00:00Z").getUTCDay()]}), ${r.servicio} a las ${r.hora}` +
      `${r.notas ? `, notas: ${r.notas}` : ""}. Estado: ${ESTADOS[String(r.estado)] || r.estado}.`;
  }
  if (nombre === "modificar_reserva") {
    const g = await rpcServidor("modificar_reserva", {
      p_codigo: codigo, p_d: args.dia || null, p_h: args.hora || null,
      p_p: args.personas == null ? null : Math.round(Number(args.personas)), p_x: args.notas == null ? null : String(args.notas),
    });
    if (!g.ok) return `ERROR: ${g.error}. La reserva NO se ha cambiado.`;
    await avisarCambio(g.datos!, "cambiada").catch((e) => console.error("Aviso de cambio:", e));
    return `Reserva cambiada: ${g.datos!.personas} personas, ${g.datos!.dia}, ${g.datos!.servicio} a las ${g.datos!.hora}. Vuelve a estar pendiente: el restaurante la confirmará de nuevo por teléfono o WhatsApp.`;
  }
  if (nombre === "anular_reserva") {
    const g = await rpcServidor("anular_reserva", { p_codigo: codigo });
    if (!g.ok) return `ERROR: ${g.error}. La reserva NO se ha anulado.`;
    await avisarCambio(g.datos!, "anulada").catch((e) => console.error("Aviso de anulación:", e));
    return "Reserva anulada. El restaurante ya está avisado.";
  }
  return "ERROR: herramienta desconocida.";
}

/* Error de una IA que justifica pasar a la otra: saturada, caída o lenta */
class ErrorIA extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}
function esSaturacion(e: unknown) {
  if (e instanceof ErrorIA) return e.status === 429 || e.status >= 500;
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "TypeError");   // tiempo agotado o red
}
const RECHAZO = "Perdona, con eso no puedo ayudarte. Para cualquier duda, llámanos al 633 45 06 54.";

/* ——— Gemini ——— */
type Parte = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown; thought?: boolean; [k: string]: unknown };
type Contenido = { role: "user" | "model"; parts: Parte[] };

const GEMINI_TOOLS = [{
  functionDeclarations: HERRAMIENTAS.map((h) => ({
    name: h.nombre,
    description: h.descripcion,
    parameters: {
      type: "OBJECT",
      properties: Object.fromEntries(Object.entries(h.parametros).map(([k, v]) =>
        [k, { type: v.type.toUpperCase(), description: v.description, ...(v.enum ? { format: "enum", enum: v.enum } : {}) }])),
      required: h.obligatorios,
    },
  })),
}];

async function llamarGemini(contenidos: Contenido[], sistema: string) {
  const t0 = Date.now();
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    signal: AbortSignal.timeout(GEMINI_ESPERA_MS),
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: contenidos, tools: GEMINI_TOOLS, generationConfig: { maxOutputTokens: 2048 } }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`Gemini ${MODELO}: HTTP ${res.status} en ${Date.now() - t0} ms`);
  if (!res.ok) throw new ErrorIA(res.status, j?.error?.message || `Gemini respondió ${res.status}`);
  return j as { candidates?: { content?: Contenido }[] };
}

async function conGemini(textos: Texto[], sistema: string, estado: Estado): Promise<string> {
  const contenidos: Contenido[] = textos.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const cand = (await llamarGemini(contenidos, sistema)).candidates?.[0];
    if (!cand?.content) return RECHAZO;
    contenidos.push({ role: "model", parts: cand.content.parts || [] });   // tal cual: conserva sus firmas de razonamiento
    const llamadas = (cand.content.parts || []).filter((p) => p.functionCall);
    if (!llamadas.length) {
      return (cand.content.parts || []).filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
    }
    const respuestas: Parte[] = [];
    for (const p of llamadas) {
      const resultado = await ejecutar(p.functionCall!.name, p.functionCall!.args || {}, estado);
      respuestas.push({ functionResponse: { name: p.functionCall!.name, response: { resultado } } });
    }
    contenidos.push({ role: "user", parts: respuestas });
  }
  return "";
}

/* ——— DeepSeek (API compatible con OpenAI) ——— */
type MensajeDS = { role: string; content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string; [k: string]: unknown };

const DEEPSEEK_TOOLS = HERRAMIENTAS.map((h) => ({
  type: "function",
  function: {
    name: h.nombre,
    description: h.descripcion,
    parameters: { type: "object", properties: h.parametros, required: h.obligatorios, additionalProperties: false },
  },
}));

async function llamarDeepSeek(mensajes: MensajeDS[]) {
  const t0 = Date.now();
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    signal: AbortSignal.timeout(25000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: DEEPSEEK_MODELO, messages: mensajes, tools: DEEPSEEK_TOOLS, max_tokens: 2048, thinking: { type: "disabled" } }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`DeepSeek ${DEEPSEEK_MODELO}: HTTP ${res.status} en ${Date.now() - t0} ms`);
  if (!res.ok) throw new ErrorIA(res.status, j?.error?.message || `DeepSeek respondió ${res.status}`);
  return j as { choices?: { message?: MensajeDS }[] };
}

async function conDeepSeek(textos: Texto[], sistema: string, estado: Estado): Promise<string> {
  const mensajes: MensajeDS[] = [{ role: "system", content: sistema }, ...textos.map((m) => ({ role: m.role, content: m.content }))];
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const msg = (await llamarDeepSeek(mensajes)).choices?.[0]?.message;
    if (!msg) return RECHAZO;
    mensajes.push(msg);   // tal cual, con sus tool_calls
    if (!msg.tool_calls?.length) return (msg.content || "").trim();
    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* argumentos rotos: pedir_reserva los rechazará */ }
      mensajes.push({ role: "tool", tool_call_id: tc.id, content: await ejecutar(tc.function.name, args, estado) });
    }
  }
  return "";
}

/* ——— Responder: Gemini primero; si está saturado, caído o lento, DeepSeek ——— */
async function responder(textos: Texto[], sistema: string, estado: Estado): Promise<{ texto: string; motor: string }> {
  const listo = () => (estado.reserva ? `¡Listo! Hemos recibido tu petición. Tu código de reserva es ${estado.reserva.codigo}. Te confirmaremos la mesa por teléfono o WhatsApp.` : "");
  try {
    if (!GEMINI_API_KEY) throw new ErrorIA(503, "Sin clave de Gemini");
    return { texto: (await conGemini(textos, sistema, estado)) || listo(), motor: "gemini" };
  } catch (e) {
    if (!DEEPSEEK_API_KEY || !esSaturacion(e)) throw e;
    console.log("Paso a DeepSeek:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    if (estado.reserva) return { texto: listo(), motor: "deepseek" };   // ya guardada con Gemini: no se repite
    return { texto: (await conDeepSeek(textos, sistema, estado)) || listo(), motor: "deepseek" };
  }
}

function sistemaDeHoy(extra = "") {
  const hoy = hoyEnMadrid();
  return `${SISTEMA}${extra ? "\n\n" + extra : ""}\n\nHoy es ${hoy.dia}, ${hoy.iso} (hora de Madrid).`;
}

/* ——— Base de datos con la clave de servidor (solo dentro de la función) ——— */
async function bd(ruta: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...init,
    signal: AbortSignal.timeout(10000),
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`BD ${res.status}: ${JSON.stringify(j)}`);
  return j;
}

/* ——— Telegram ——— */
async function tg(metodo: string, datos: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${metodo}`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return await res.json().catch(() => ({ ok: false }));
}
/* Secreto del webhook: se deriva del token, así nadie más puede hacerse pasar por Telegram */
async function secretoWebhook() {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("porta-di-mare:" + TG_TOKEN));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}
const URL_FUNCION = `${SUPABASE_URL}/functions/v1/chat`;
const PANEL = "https://tutuifc.github.io/porta-di-mare/panel.html";

const BIENVENIDA: Record<string, string> = {
  es: "¡Hola! Soy el asistente de Porta di Mare 🍕 Te ayudo a pedir mesa o a resolver dudas sobre la carta y el horario. Puedes escribirme o mandarme un audio. ¿Para qué día y cuántas personas?",
  ca: "Hola! Sóc l'assistent de Porta di Mare 🍕 T'ajudo a demanar taula o amb dubtes sobre la carta i l'horari. Pots escriure'm o enviar-me un àudio. Per a quin dia i quantes persones?",
  en: "Hi! I'm the Porta di Mare assistant 🍕 I can help you book a table or answer questions about the menu and opening hours. You can type or send me a voice message. Which day, and how many people?",
};
const CANAL_TELEGRAM = "Canal: el cliente te escribe por mensajería (Telegram, como si fuera el WhatsApp del restaurante). Mensajes cortos. No ves su número de teléfono: pídeselo igualmente para la reserva.";

const CANAL_VOZ = "Este mensaje del cliente es una nota de voz (transcrita) y tu respuesta se le enviará como audio con voz: frases cortas y naturales para decir en voz alta, sin emojis, sin enlaces ni símbolos. Di las horas, fechas y precios como se pronuncian.";

/* ——— Notas de voz: Telegram → texto (Gemini) y texto → voz (Gemini TTS → MP3) ——— */
function aBase64(b: Uint8Array) {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
function deBase64(s: string) {
  const b = atob(s), u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

async function descargarDeTelegram(fileId: string) {
  const f = await tg("getFile", { file_id: fileId });
  const ruta = f?.result?.file_path;
  if (!f?.ok || !ruta) throw new Error("Telegram no ha dado el archivo");
  if ((f.result.file_size || 0) > 10 * 1024 * 1024) throw new Error("Audio demasiado grande");
  const res = await fetch(`https://api.telegram.org/file/bot${TG_TOKEN}/${ruta}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Descarga del audio: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const INAUDIBLE = "[inaudible]";
async function transcribir(audio: Uint8Array, mime: string) {
  const t0 = Date.now();
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    signal: AbortSignal.timeout(25000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: mime, data: aBase64(audio) } },
        { text: `Transcribe literalmente lo que dice este audio, en su idioma original. Devuelve solo la transcripción, sin comillas ni comentarios. Si no hay voz o no se entiende, devuelve exactamente ${INAUDIBLE}` },
      ] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`Transcripción ${MODELO}: HTTP ${res.status} en ${Date.now() - t0} ms`);
  if (!res.ok) throw new ErrorIA(res.status, j?.error?.message || `Gemini respondió ${res.status}`);
  const partes: Parte[] = j?.candidates?.[0]?.content?.parts || [];
  return partes.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
}

/* Gemini devuelve WAV (o PCM crudo) a 24 kHz, 16 bits, mono; Telegram quiere la nota de voz en MP3/OGG */
function pcmDe(audio: Uint8Array) {
  let rate = 24000, ini = 0, fin = audio.length;
  const v = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
  const id = (o: number) => String.fromCharCode(audio[o], audio[o + 1], audio[o + 2], audio[o + 3]);
  if (audio.length > 12 && id(0) === "RIFF" && id(8) === "WAVE") {
    for (let o = 12; o + 8 <= audio.length;) {
      const tam = v.getUint32(o + 4, true);
      if (id(o) === "fmt ") rate = v.getUint32(o + 12, true);
      if (id(o) === "data") { ini = o + 8; fin = Math.min(audio.length, ini + tam); break; }
      o += 8 + tam + (tam % 2);
    }
  }
  const muestras = new Int16Array(Math.floor((fin - ini) / 2));
  for (let i = 0; i < muestras.length; i++) muestras[i] = v.getInt16(ini + i * 2, true);
  return { muestras, rate };
}
function aMp3(audio: Uint8Array) {
  const { muestras, rate } = pcmDe(audio);
  const enc = new Mp3Encoder(1, rate, 48), trozos: Uint8Array[] = [];
  for (let i = 0; i < muestras.length; i += 1152) { const b = enc.encodeBuffer(muestras.subarray(i, i + 1152)); if (b.length) trozos.push(b); }
  const f = enc.flush(); if (f.length) trozos.push(f);
  const out = new Uint8Array(trozos.reduce((a, b) => a + b.length, 0));
  let o = 0; for (const t of trozos) { out.set(t, o); o += t.length; }
  return out;
}

async function hablar(texto: string) {
  const t0 = Date.now();
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({
      model: TTS_MODELO,
      input: [{ type: "user_input", content: [{ type: "text", text: texto, annotations: [{ type: "speech_metadata", style: "cálido, cercano y natural, como un camarero amable" }] }] }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: VOZ }] },
    }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`Voz ${TTS_MODELO}: HTTP ${res.status} en ${Date.now() - t0} ms`);
  if (!res.ok) throw new ErrorIA(res.status, j?.error?.message || `Gemini (voz) respondió ${res.status}`);
  let datos = "";
  for (const s of j?.steps || []) for (const c of s?.content || []) if (c?.type === "audio" && c.data) datos = c.data;
  if (!datos) throw new Error("Gemini no ha devuelto audio");
  return aMp3(deBase64(datos));
}

/* Manda la respuesta como nota de voz (con el texto debajo). Si algo falla, devuelve false y se manda en texto. */
async function responderConVoz(chat: number, texto: string) {
  if (texto.length > 700) return false;   // respuestas largas, mejor por escrito
  try {
    tg("sendChatAction", { chat_id: chat, action: "record_voice" });
    const mp3 = await hablar(texto.replace(/\p{Extended_Pictographic}|️/gu, "").replace(/[ \t]{2,}/g, " ").trim());
    const form = new FormData();
    form.append("chat_id", String(chat));
    form.append("voice", new Blob([mp3], { type: "audio/mpeg" }), "porta-di-mare.mp3");
    form.append("caption", texto.slice(0, 1024));
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendVoice`, { method: "POST", body: form, signal: AbortSignal.timeout(20000) });
    const j = await res.json().catch(() => ({ ok: false }));
    if (!j.ok) throw new Error(`sendVoice: ${j.description || res.status}`);
    return true;
  } catch (e) {
    console.error("Voz:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return false;
  }
}

type MensajeTG = {
  chat: { id: number; type: string };
  from?: { username?: string; language_code?: string; first_name?: string };
  text?: string;
  voice?: { file_id: string; duration: number; mime_type?: string };
};

async function atenderTelegram(update: { message?: MensajeTG }) {
  const m = update.message;
  if (!m || m.chat.type !== "private" || (!m.text && !m.voice)) return;
  const chat = m.chat.id;
  const idioma = (m.from?.language_code || "es").slice(0, 2);
  const responde = (t: string) => tg("sendMessage", { chat_id: chat, text: t });

  /* Nota de voz: se pasa a texto y a partir de ahí es una conversación normal */
  let texto = "", porVoz = false;
  if (m.text) texto = m.text.trim().slice(0, MAX_CARACTERES);
  else if (m.voice) {
    if (m.voice.duration > 120) return responde("El audio es muy largo. ¿Me mandas uno de menos de 2 minutos o me lo escribes?");
    if (!GEMINI_API_KEY) return responde("Ahora mismo no puedo escuchar audios. ¿Me lo escribes, por favor?");
    tg("sendChatAction", { chat_id: chat, action: "typing" });
    try {
      texto = (await transcribir(await descargarDeTelegram(m.voice.file_id), m.voice.mime_type || "audio/ogg")).slice(0, MAX_CARACTERES);
    } catch (e) {
      console.error("Audio:", e instanceof Error ? `${e.name}: ${e.message}` : e);
      return responde("Ahora mismo no puedo escuchar audios. ¿Me lo escribes, por favor?");
    }
    if (!texto || texto.includes(INAUDIBLE)) return responde("No he entendido bien el audio. ¿Me lo repites o me lo escribes?");
    porVoz = true;
  }

  if (!porVoz && (/^\/start\b/.test(texto) || /^\/nueva\b/.test(texto))) {
    await bd(`telegram_mensajes?chat_id=eq.${chat}`, { method: "DELETE" });
    return responde(BIENVENIDA[idioma] || BIENVENIDA.es);
  }
  if (!porVoz && /^\/avisos\b/.test(texto)) {
    const usuario = (m.from?.username || "").toLowerCase();
    if (!TG_ADMIN || usuario !== TG_ADMIN) return responde("Este comando es solo para el restaurante.");
    await bd("ajustes?id=eq.1", { method: "PATCH", body: JSON.stringify({ telegram_aviso_chat: chat }) });
    return responde("✅ Avisos activados. A partir de ahora te escribiré aquí cada vez que entre una petición de reserva (web, chat o Telegram).");
  }

  /* Conversación: lo de las últimas 12 horas, como máximo 20 mensajes */
  const desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const previos = (await bd(`telegram_mensajes?select=role,content&chat_id=eq.${chat}&creada=gte.${encodeURIComponent(desde)}&order=id.desc&limit=20`)) as Texto[];
  const textos: Texto[] = [];
  for (const p of [...previos].reverse().concat([{ role: "user", content: texto }])) {
    const u = textos[textos.length - 1];
    if (u && u.role === p.role) u.content += "\n" + p.content; else textos.push({ role: p.role, content: p.content });
  }
  while (textos.length && textos[0].role !== "user") textos.shift();

  if (!porVoz) tg("sendChatAction", { chat_id: chat, action: "typing" });
  const estado: Estado = { reserva: null, origen: "Telegram" };
  let respuesta: string;
  try {
    respuesta = (await responder(textos, sistemaDeHoy(CANAL_TELEGRAM + (porVoz ? "\n" + CANAL_VOZ : "")), estado)).texto || "¿Me lo repites, por favor?";
  } catch (e) {
    console.error("Fallo del asistente (Telegram):", e instanceof Error ? `${e.name}: ${e.message}` : e);
    respuesta = "Ahora mismo no puedo responder. Llámanos al 633 45 06 54 y te atendemos.";
  }
  await bd("telegram_mensajes", { method: "POST", body: JSON.stringify([
    { chat_id: chat, role: "user", content: texto },
    { chat_id: chat, role: "assistant", content: respuesta },
  ]) });
  if (!(porVoz && (await responderConVoz(chat, respuesta)))) await responde(respuesta);

  /* Al reservar, un mensaje aparte con el código, fácil de encontrar y de reenviar */
  const codigo = estado.reserva?.codigo;
  if (codigo) {
    const r = estado.reserva!;
    const d = new Date(String(r.dia) + "T12:00:00Z");
    const ficha = `${DIAS_CORTOS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1} · ${r.hora} · ${r.personas} pax · ${r.nombre}`;
    const textoCodigo: Record<string, string> = {
      es: `🎟️ Código de reserva: ${codigo}\n${ficha}\nEstado: pendiente de confirmar.\n\nGuárdalo: escribiéndome este código puedes consultar, cambiar o anular tu reserva.`,
      ca: `🎟️ Codi de reserva: ${codigo}\n${ficha}\nEstat: pendent de confirmar.\n\nGuarda'l: escrivint-me aquest codi pots consultar, canviar o anul·lar la teva reserva.`,
      en: `🎟️ Booking code: ${codigo}\n${ficha}\nStatus: waiting for confirmation.\n\nKeep it: send me this code to check, change or cancel your booking.`,
    };
    await responde(textoCodigo[idioma] || textoCodigo.es);
  }
}

/* Aviso al restaurante de una petición nueva. Lo llama la base de datos al guardar una reserva «pendiente».
   Cada reserva se avisa una sola vez y solo en sus primeros 10 minutos: llamarlo de más no sirve para nada. */
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
async function chatDeAvisos() {
  const aj = (await bd("ajustes?select=telegram_aviso_chat&id=eq.1")) as { telegram_aviso_chat: number | null }[];
  return aj?.[0]?.telegram_aviso_chat || null;
}
async function avisarCambio(r: Record<string, unknown>, tipo: "cambiada" | "anulada") {
  if (!TG_TOKEN || !SERVICE_KEY) return;
  const chat = await chatDeAvisos();
  if (!chat) return;
  const lineas = tipo === "anulada"
    ? [`❌ Reserva ${r.codigo} anulada por el cliente`]
    : [`✏️ Reserva ${r.codigo} cambiada por el cliente (vuelve a estar por confirmar)`,
       `${DIAS_CORTOS[new Date(String(r.dia) + "T12:00:00Z").getUTCDay()]} ${Number(String(r.dia).slice(8, 10))}/${Number(String(r.dia).slice(5, 7))} · ${r.servicio} ${r.hora} · ${r.personas} pax`,
       `${r.nombre}`, r.notas ? `Notas: ${r.notas}` : ""];
  lineas.push(`Panel: ${PANEL}`);
  await tg("sendMessage", { chat_id: chat, text: lineas.filter(Boolean).join("\n"), link_preview_options: { is_disabled: true } });
}
async function avisar(id: string) {
  if (!TG_TOKEN || !/^[0-9a-f-]{36}$/i.test(id)) return "nada";
  const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const filas = (await bd(`reservas?id=eq.${id}&avisada=eq.false&estado=eq.pendiente&creada=gte.${encodeURIComponent(desde)}`,
    { method: "PATCH", body: JSON.stringify({ avisada: true }) })) as Record<string, string | number>[];
  const r = filas?.[0];
  if (!r) return "ya avisada o no válida";
  const aj = (await bd("ajustes?select=telegram_aviso_chat&id=eq.1")) as { telegram_aviso_chat: number | null }[];
  const chat = aj?.[0]?.telegram_aviso_chat;
  if (!chat) return "sin chat de avisos";
  const d = new Date(String(r.d) + "T12:00:00Z");
  const lineas = [
    `🔔 Nueva petición ${r.codigo} · vía ${r.origen}`,
    `${DIAS_CORTOS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1} · ${r.s} ${r.h} · ${r.p} pax`,
    `${r.n}${r.tel ? " · " + r.tel : ""}`,
    r.x ? `Notas: ${r.x}` : "",
    `Confírmala en el panel: ${PANEL}`,
  ].filter(Boolean);
  const res = await tg("sendMessage", { chat_id: chat, text: lineas.join("\n"), link_preview_options: { is_disabled: true } });
  return res.ok ? "avisado" : "Telegram no aceptó el aviso";
}

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;

  /* Conectar el bot (una vez): registra el webhook con un secreto derivado del token */
  if (q.get("telegram_setup") === "1") {
    if (!TG_TOKEN) return new Response("Falta TELEGRAM_BOT_TOKEN", { status: 400 });
    const r = await tg("setWebhook", { url: `${URL_FUNCION}?telegram=1`, secret_token: await secretoWebhook(), allowed_updates: ["message"], drop_pending_updates: true });
    await tg("setMyCommands", { commands: [{ command: "start", description: "Empezar de nuevo" }, { command: "nueva", description: "Nueva conversación" }] });
    const yo = await tg("getMe", {});
    return Response.json({ webhook: r.ok ? "conectado" : r.description, bot: yo?.result?.username || null });
  }

  /* Mensajes de Telegram: solo si traen el secreto del webhook */
  if (q.get("telegram") === "1") {
    if (!TG_TOKEN || req.headers.get("x-telegram-bot-api-secret-token") !== (await secretoWebhook())) return new Response("no", { status: 401 });
    try { await atenderTelegram(await req.json()); } catch (e) { console.error("Telegram:", e instanceof Error ? e.message : e); }
    return new Response("ok");   // siempre 200: si no, Telegram reintenta el mismo mensaje
  }

  /* Aviso de nueva petición (lo llama el disparador de la base de datos) */
  if (q.get("aviso") === "1" && req.method === "POST") {
    try {
      const b = await req.json();
      return Response.json({ resultado: await avisar(String(b?.id || "")) });
    } catch (e) {
      console.error("Aviso:", e instanceof Error ? e.message : e);
      return Response.json({ resultado: "error" }, { status: 500 });
    }
  }

  /* ——— Chat de la web ——— */
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Solo POST" });
  if (ORIGENES.length && !ORIGENES.includes(req.headers.get("origin") || "")) return json(req, 403, { error: "Origen no permitido" });
  if (!GEMINI_API_KEY && !DEEPSEEK_API_KEY) return json(req, 500, { error: "Falta la clave de la IA" });

  /* Solo se aceptan textos de cliente y asistente, alternos, terminando en el cliente */
  let entrada: { role: string; content: string }[];
  try {
    const body = await req.json();
    entrada = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return json(req, 400, { error: "JSON no válido" });
  }
  const textos: Texto[] = [];
  for (const m of entrada.slice(-MAX_MENSAJES)) {
    if ((m?.role !== "user" && m?.role !== "assistant") || typeof m.content !== "string") return json(req, 400, { error: "Mensaje no válido" });
    const t = m.content.trim().slice(0, MAX_CARACTERES);
    if (!t) continue;
    const ultimo = textos[textos.length - 1];
    if (ultimo && ultimo.role === m.role) ultimo.content += "\n" + t;
    else textos.push({ role: m.role, content: t });
  }
  while (textos.length && textos[0].role !== "user") textos.shift();
  if (!textos.length || textos[textos.length - 1].role !== "user") return json(req, 400, { error: "Falta el mensaje del cliente" });

  const estado: Estado = { reserva: null, origen: "Chat" };
  try {
    const { texto, motor } = await responder(textos, sistemaDeHoy(), estado);
    return json(req, 200, { reply: texto || "¿Me lo repites, por favor?", reserva: estado.reserva, motor });
  } catch (e) {
    console.error("Fallo del asistente:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return json(req, esSaturacion(e) ? 503 : 500, {
      error: esSaturacion(e) ? "El asistente está ocupado ahora mismo" : "El asistente no está disponible",
      reserva: estado.reserva,
    });
  }
});
