// Porta di Mare · asistente de reservas (Supabase Edge Function, Deno) con Google Gemini.
// La web le manda la conversación; Gemini responde y, cuando el cliente confirma los datos,
// llama a la herramienta crear_reserva, que guarda la petición como «pendiente» en la base de datos.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY   la clave de Google AI Studio (obligatoria; nunca va en la web)
//   ALLOWED_ORIGIN   opcional: dominios que pueden usar el chat, separados por comas
//                    (p. ej. https://tuusuario.github.io). Sin él, cualquiera.
//   GEMINI_MODEL     opcional: modelo de Gemini (por defecto gemini-3.5-flash-lite)
// SUPABASE_URL y las claves internas (SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY) los pone Supabase solo.

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODELO = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Clave para llamar a pedir_reserva(): la anon clásica si existe; si no, la de servidor que Supabase
// pone en la función (nunca sale de aquí). Las dos pasan por las mismas validaciones de la base de datos.
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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
async function pedirReserva(r: { nombre: string; personas: number; dia: string; servicio: string; hora: string; telefono: string; notas: string }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pedir_reserva`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_n: r.nombre, p_p: r.personas, p_d: r.dia, p_s: r.servicio, p_h: r.hora, p_x: r.notas || "", p_tel: r.telefono, p_origen: "Chat" }),
  });
  if (res.ok) return { ok: true as const };
  const err = await res.json().catch(() => ({}));
  return { ok: false as const, error: String(err.message || "No se ha podido guardar la reserva") };
}

/* ——— Gemini ——— */
type Parte = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown; thought?: boolean; [k: string]: unknown };
type Contenido = { role: "user" | "model"; parts: Parte[] };

const HERRAMIENTAS = [{
  functionDeclarations: [{
    name: "crear_reserva",
    description: "Guarda la petición de reserva en el libro del restaurante como pendiente de confirmar. Úsala una sola vez y solo después de que el cliente haya confirmado explícitamente el resumen.",
    parameters: {
      type: "OBJECT",
      properties: {
        nombre: { type: "STRING", description: "Nombre de quien reserva" },
        personas: { type: "INTEGER", description: "Número de personas, de 1 a 80" },
        dia: { type: "STRING", description: "Fecha en formato AAAA-MM-DD" },
        servicio: { type: "STRING", format: "enum", enum: ["Comida", "Cena"], description: "Comida (12:00-16:00) o Cena (20:00-23:00)" },
        hora: { type: "STRING", description: "Hora de llegada en formato HH:MM, 24 h" },
        telefono: { type: "STRING", description: "Teléfono de contacto" },
        notas: { type: "STRING", description: "Celebración, alergias, terraza, trona… Cadena vacía si no hay" },
      },
      required: ["nombre", "personas", "dia", "servicio", "hora", "telefono", "notas"],
    },
  }],
}];

class ErrorGemini extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

async function gemini(contenidos: Contenido[], sistema: string) {
  const t0 = Date.now();
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    signal: AbortSignal.timeout(25000),   // si Gemini no contesta en 25 s, se corta y se avisa
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistema }] },
      contents: contenidos,
      tools: HERRAMIENTAS,
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`Gemini ${MODELO}: HTTP ${res.status} en ${Date.now() - t0} ms`);
  if (!res.ok) throw new ErrorGemini(res.status, j?.error?.message || `Gemini respondió ${res.status}`);
  return j as { candidates?: { content?: Contenido; finishReason?: string }[] };
}

function texto(c?: Contenido) {
  return (c?.parts || []).filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Solo POST" });
  if (ORIGENES.length && !ORIGENES.includes(req.headers.get("origin") || "")) return json(req, 403, { error: "Origen no permitido" });
  if (!GEMINI_API_KEY) return json(req, 500, { error: "Falta la clave de Gemini" });

  /* Solo se aceptan textos de cliente y asistente, alternos, terminando en el cliente */
  let entrada: { role: string; content: string }[];
  try {
    const body = await req.json();
    entrada = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return json(req, 400, { error: "JSON no válido" });
  }
  const contenidos: Contenido[] = [];
  for (const m of entrada.slice(-MAX_MENSAJES)) {
    if ((m?.role !== "user" && m?.role !== "assistant") || typeof m.content !== "string") return json(req, 400, { error: "Mensaje no válido" });
    const t = m.content.trim().slice(0, MAX_CARACTERES);
    if (!t) continue;
    const rol = m.role === "user" ? "user" : "model";
    const ultimo = contenidos[contenidos.length - 1];
    if (ultimo && ultimo.role === rol) ultimo.parts[0].text += "\n" + t;
    else contenidos.push({ role: rol, parts: [{ text: t }] });
  }
  while (contenidos.length && contenidos[0].role !== "user") contenidos.shift();
  if (!contenidos.length || contenidos[contenidos.length - 1].role !== "user") return json(req, 400, { error: "Falta el mensaje del cliente" });

  const hoy = hoyEnMadrid();
  const sistema = `${SISTEMA}\n\nHoy es ${hoy.dia}, ${hoy.iso} (hora de Madrid).`;
  let reserva: Record<string, unknown> | null = null;

  try {
    /* Bucle corto: Gemini puede pedir guardar la reserva y luego contestar al cliente */
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const r = await gemini(contenidos, sistema);
      const cand = r.candidates?.[0];
      if (!cand?.content) {
        return json(req, 200, { reply: "Perdona, con eso no puedo ayudarte. Para cualquier duda, llámanos al 633 45 06 54.", reserva });
      }
      // Se devuelve tal cual a Gemini en la siguiente vuelta (incluye sus firmas de razonamiento)
      contenidos.push({ role: "model", parts: cand.content.parts || [] });
      const llamadas = (cand.content.parts || []).filter((p) => p.functionCall);
      if (!llamadas.length) {
        const t = texto(cand.content);
        return json(req, 200, { reply: t || (reserva ? "¡Listo! Hemos recibido tu petición." : "¿Me lo repites, por favor?"), reserva });
      }
      const respuestas: Parte[] = [];
      for (const p of llamadas) {
        const fc = p.functionCall!;
        let resultado: string;
        if (fc.name !== "crear_reserva") resultado = "ERROR: herramienta desconocida.";
        else if (reserva) resultado = "Ya se ha guardado una reserva en esta conversación. No guardes otra.";
        else {
          const a = fc.args || {};
          const datos = {
            nombre: String(a.nombre ?? ""), personas: Math.round(Number(a.personas)), dia: String(a.dia ?? ""),
            servicio: String(a.servicio ?? ""), hora: String(a.hora ?? ""), telefono: String(a.telefono ?? ""), notas: String(a.notas ?? ""),
          };
          const g = await pedirReserva(datos);
          if (g.ok) {
            reserva = { nombre: datos.nombre, personas: datos.personas, dia: datos.dia, servicio: datos.servicio, hora: datos.hora };
            resultado = "Petición guardada como pendiente. El restaurante la confirmará por teléfono o WhatsApp.";
          } else resultado = `ERROR: ${g.error}. La reserva NO se ha guardado.`;
        }
        respuestas.push({ functionResponse: { name: fc.name, response: { resultado } } });
      }
      contenidos.push({ role: "user", parts: respuestas });
    }
    return json(req, 200, { reply: reserva ? "¡Listo! Hemos recibido tu petición." : "Perdona, ¿me lo puedes repetir?", reserva });
  } catch (e) {
    console.error("Fallo del asistente:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    const ocupado = (e instanceof ErrorGemini && (e.status === 429 || e.status >= 500)) || (e instanceof Error && e.name === "TimeoutError");
    return json(req, ocupado ? 503 : 500, {
      error: ocupado ? "El asistente está ocupado ahora mismo" : "El asistente no está disponible",
      reserva,
    });
  }
});
