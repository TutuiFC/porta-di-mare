# Porta di Mare · poner en marcha reservas, panel y asistente

La web se publica en **GitHub Pages** (solo archivos). Las reservas viven en **Supabase** (base de datos en la nube, plan gratuito) y el asistente usa **Claude** a través de una función de Supabase, para que la clave de la IA nunca esté en la web.

```
Formulario de la web ──┐
                       ├─► pedir_reserva()  ─►  tabla «reservas»  ◄── panel.html (con email y contraseña)
Asistente (chat.js) ───► función «chat» (Claude)
```

## 1. Crear el proyecto de Supabase

1. Entra en <https://supabase.com>, crea una cuenta y un proyecto nuevo (región: Europa).
2. **SQL Editor → New query**: pega todo `supabase/schema.sql` y pulsa **Run**.
3. (Opcional, para enseñar el panel lleno) ejecuta también `supabase/ejemplo.sql`. **Borra todas las reservas**: no lo uses con datos reales.

## 2. Crear el usuario del panel

1. **Authentication → Users → Add user → Create new user**: email y contraseña del jefe. Marca «Auto Confirm User».
2. **Authentication → Sign In / Providers → Email**: desactiva **Allow new users to sign up**, para que nadie más pueda crearse una cuenta.

## 3. Conectar la web

En **Project Settings → API Keys** copia la *Project URL* y la clave **anon public** en `supabase-config.js`. Si ves claves nuevas `sb_publishable_…`, abre la pestaña **Legacy API keys** y usa la *anon* de ahí (empieza por `eyJ`): es la que funciona con todo lo de esta carpeta.

```js
window.PDM_SUPABASE = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...'
};
```

La clave *anon* es pública a propósito: con las reglas de `schema.sql` solo sirve para pedir reservas. **Nunca** pongas ahí la clave *service_role* ni la de Anthropic.

## 4. Publicar el asistente (función «chat»)

Necesitas la CLI de Supabase (<https://supabase.com/docs/guides/cli>). En la carpeta `web`:

```bash
supabase login
supabase link --project-ref xxxxxxxx
supabase secrets set ANTHROPIC_API_KEY=tu-clave-de-anthropic
supabase secrets set ALLOWED_ORIGIN=https://tuusuario.github.io
supabase functions deploy chat --no-verify-jwt
```

`--no-verify-jwt` deja que la web llame al asistente sin iniciar sesión (es público, como el formulario); lo que lo protege es `ALLOWED_ORIGIN` y los límites de la función.

- `ANTHROPIC_API_KEY`: la clave de <https://console.anthropic.com>. Se guarda en Supabase, nunca en la web ni en GitHub.
- `ALLOWED_ORIGIN`: el dominio de tu GitHub Pages (sin barra final). Así otras webs no pueden usar tu asistente ni gastar tu clave.
- Modelo: por defecto `claude-opus-5-5`. Para gastar menos, `supabase secrets set CHAT_MODEL=claude-haiku-5-5` y vuelve a desplegar.

También se puede hacer sin CLI desde el panel de Supabase: **Edge Functions → Deploy a new function → Via Editor**, nombre `chat`, pegar `supabase/functions/chat/index.ts`, desactivar **Verify JWT** en sus ajustes, y poner los secretos en **Edge Functions → Secrets**.

## 5. Publicar en GitHub Pages

1. Sube el contenido de esta carpeta `web` a un repositorio de GitHub.
2. **Settings → Pages → Deploy from a branch** → rama `main`, carpeta `/ (root)`.
3. La web queda en `https://tuusuario.github.io/repositorio/` y el panel en `.../panel.html`.

No subas `_copia_antes_rediseno/`, `.impeccable/`, `DESIGN.md` ni `PRODUCT.md` si no quieres que se vean: en GitHub Pages todo lo que está en el repositorio es público.

## Cómo funciona cada pieza

| Pieza | Archivo | Qué hace |
|---|---|---|
| Base de datos | `supabase/schema.sql` | Tablas `reservas` y `ajustes`, reglas de acceso y la función `pedir_reserva()`, que valida día, horario y límites |
| Formulario | `pdm.js` | Al enviar, guarda la petición como «Por confirmar» y abre WhatsApp como siempre |
| Asistente | `chat.js`, `chat.css`, `supabase/functions/chat/index.ts` | Conversa en ES/CA/EN, pide nombre, personas, día, hora y teléfono, resume, y al confirmar guarda la petición (vía «Chat») |
| Panel | `panel.html`, `panel.js` | Entra con email y contraseña de Supabase; lee y cambia reservas; mira si hay peticiones nuevas cada 15 s |

## Límites y costes a tener en cuenta

- Cada mensaje del asistente es una llamada a la API de Anthropic, que se paga por uso. La función limita las conversaciones a 30 mensajes de 1000 caracteres. Pon un límite de gasto en la consola de Anthropic.
- La función `pedir_reserva()` es pública: alguien podría llenar el libro de peticiones falsas. Si pasa, se puede añadir un captcha (p. ej. Cloudflare Turnstile).
- El panel carga las reservas de los últimos 120 días hacia delante.
