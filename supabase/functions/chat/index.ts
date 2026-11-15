// Porta di Mare · asistente de reservas (Supabase Edge Function, Deno).
// La web le manda la conversación; Claude responde y, cuando el cliente confirma los datos,
// llama a la herramienta crear_reserva, que guarda la petición como «pendiente» en la base de datos.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  la clave de la API de Anthropic (obligatoria; nunca va en la web)
//   ALLOWED_ORIGIN     opcional: dominios que pueden usar el chat, separados por comas
//                      (p. ej. https://tuusuario.github.io). Sin él, cualquiera.
//   CHAT_MODEL         opcional: modelo de Claude (por defecto claude-opus-5-5)
// SUPABASE_URL y SUPABASE_ANON_KEY los pone Supabase solo.

import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { betaTool } from "npm:@anthropic-ai/sdk@1.8.0/helpers/beta/json-schema";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const MODEL = Deno.env.get("CHAT_MODEL") || "claude-opus-5-5";
// Si el modelo rechaza una petición por seguridad, la API la reintenta en otro modelo (solo Opus/Sonnet 5.5).
const CON_FALLBACK = MODEL === "claude-opus-5-5" || MODEL === "claude-sonnet-5-5";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ORIGENES = (Deno.env.get("ALLOWED_ORIGIN") || "").split(",").map((s) => s.trim()).filter(Boolean);

// Límites para que nadie gaste la clave con conversaciones eternas
const MAX_MENSAJES = 30;
const MAX_CARACTERES = 1000;

/* Lo que sabe el asistente. Fijo, para que la caché de Claude lo reaproveche entre peticiones. */
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
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_n: r.nombre, p_p: r.personas, p_d: r.dia, p_s: r.servicio, p_h: r.hora, p_x: r.notas || "", p_tel: r.telefono, p_origen: "Chat" }),
  });
  if (res.ok) return { ok: true as const };
  const err = await res.json().catch(() => ({}));
  return { ok: false as const, error: String(err.message || "No se ha podido guardar la reserva") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Solo POST" });
  if (ORIGENES.length && !ORIGENES.includes(req.headers.get("origin") || "")) return json(req, 403, { error: "Origen no permitido" });

  /* Solo se aceptan textos de usuario y asistente, alternos, terminando en el usuario */
  let entrada: { role: string; content: string }[];
  try {
    const body = await req.json();
    entrada = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return json(req, 400, { error: "JSON no válido" });
  }
  const mensajes: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of entrada.slice(-MAX_MENSAJES)) {
    if ((m?.role !== "user" && m?.role !== "assistant") || typeof m.content !== "string") return json(req, 400, { error: "Mensaje no válido" });
    const texto = m.content.trim().slice(0, MAX_CARACTERES);
    if (!texto) continue;
    const ultimo = mensajes[mensajes.length - 1];
    if (ultimo && ultimo.role === m.role) ultimo.content += "\n" + texto;
    else mensajes.push({ role: m.role, content: texto });
  }
  while (mensajes.length && mensajes[0].role !== "user") mensajes.shift();
  if (!mensajes.length || mensajes[mensajes.length - 1].role !== "user") return json(req, 400, { error: "Falta el mensaje del cliente" });

  let reserva: Record<string, unknown> | null = null;
  const crearReserva = betaTool({
    name: "crear_reserva",
    description: "Guarda la petición de reserva en el libro del restaurante como pendiente de confirmar. Úsala una sola vez y solo después de que el cliente haya confirmado explícitamente el resumen.",
    inputSchema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre de quien reserva" },
        personas: { type: "integer", description: "Número de personas, de 1 a 80" },
        dia: { type: "string", description: "Fecha en formato AAAA-MM-DD" },
        servicio: { type: "string", enum: ["Comida", "Cena"], description: "Comida (12:00-16:00) o Cena (20:00-23:00)" },
        hora: { type: "string", description: "Hora de llegada en formato HH:MM, 24 h" },
        telefono: { type: "string", description: "Teléfono de contacto" },
        notas: { type: "string", description: "Celebración, alergias, terraza, trona… Cadena vacía si no hay" },
      },
      required: ["nombre", "personas", "dia", "servicio", "hora", "telefono", "notas"],
      additionalProperties: false,
    },
    run: async (input) => {
      if (reserva) return "Ya se ha guardado una reserva en esta conversación. No guardes otra.";
      const r = await pedirReserva(input as Parameters<typeof pedirReserva>[0]);
      if (!r.ok) return `ERROR: ${r.error}. La reserva NO se ha guardado.`;
      reserva = { nombre: input.nombre, personas: input.personas, dia: input.dia, servicio: input.servicio, hora: input.hora };
      return "Petición guardada como pendiente. El restaurante la confirmará por teléfono o WhatsApp.";
    },
  });

  const hoy = hoyEnMadrid();
  try {
    const final = await client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 4000,
      max_iterations: 4,
      output_config: { effort: "low" },
      ...(CON_FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      system: [
        { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Hoy es ${hoy.dia}, ${hoy.iso} (hora de Madrid).` },
      ],
      tools: [{ ...crearReserva, strict: true }],
      messages: mensajes,
    });

    if (final.stop_reason === "refusal") {
      return json(req, 200, { reply: "Perdona, con eso no puedo ayudarte. Para cualquier duda, llámanos al 633 45 06 54.", reserva });
    }
    const texto = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return json(req, 200, { reply: texto || (reserva ? "¡Listo! Hemos recibido tu petición." : "¿Me lo repites, por favor?"), reserva });
  } catch (e) {
    console.error(e);
    const ocupado = e instanceof Anthropic.RateLimitError || (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500);
    return json(req, ocupado ? 503 : 500, {
      error: ocupado ? "El asistente está ocupado ahora mismo" : "El asistente no está disponible",
      reserva,
    });
  }
});
