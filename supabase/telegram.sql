-- Porta di Mare · ampliación para el bot de Telegram y los avisos al restaurante.
-- Ejecutar DESPUÉS de schema.sql (Supabase → SQL Editor → pegar → Run). Se puede volver a ejecutar.

-- 1. Las reservas pueden llegar también «vía Telegram», y se marca cuáles ya se han avisado
alter table public.reservas drop constraint if exists reservas_origen_check;
alter table public.reservas add constraint reservas_origen_check
  check (origen in ('Web', 'Chat', 'Telegram', 'Teléfono', 'WhatsApp', 'En sala'));
alter table public.reservas add column if not exists avisada boolean not null default false;

-- 2. El chat de Telegram del restaurante donde llegan los avisos (lo rellena el bot con /avisos)
alter table public.ajustes add column if not exists telegram_aviso_chat bigint;

-- 3. Conversaciones del bot (privadas: solo la función del servidor puede leerlas)
create table if not exists public.telegram_mensajes (
  id       bigserial primary key,
  chat_id  bigint not null,
  role     text not null check (role in ('user', 'assistant')),
  content  text not null check (char_length(content) <= 4000),
  creada   timestamptz not null default now()
);
create index if not exists telegram_mensajes_chat_idx on public.telegram_mensajes (chat_id, id);
alter table public.telegram_mensajes enable row level security;
revoke all on public.telegram_mensajes from anon, authenticated;

-- 4. La puerta pública acepta también el origen «Telegram»
create or replace function public.pedir_reserva(
  p_n text, p_p int, p_d date, p_s text, p_h text,
  p_x text default '', p_tel text default '', p_origen text default 'Web'
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ini text; fin text;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  if p_origen is null or p_origen not in ('Web', 'Chat', 'Telegram') then p_origen := 'Web'; end if;
  if p_n is null or char_length(trim(p_n)) = 0 then raise exception 'Falta el nombre'; end if;
  if p_p is null or p_p < 1 or p_p > 80 then raise exception 'Personas entre 1 y 80'; end if;
  if p_d is null then raise exception 'Falta el día'; end if;
  if p_d < hoy then raise exception 'Ese día ya ha pasado'; end if;
  if p_d > hoy + 180 then raise exception 'Solo se puede reservar hasta seis meses vista'; end if;
  if extract(isodow from p_d) in (1, 2) then raise exception 'Ese día está cerrado: lunes y martes no hay servicio'; end if;
  ini := case p_s when 'Comida' then '12:00' when 'Cena' then '20:00' end;
  fin := case p_s when 'Comida' then '16:00' when 'Cena' then '23:00' end;
  if ini is null then raise exception 'El servicio tiene que ser Comida o Cena'; end if;
  if p_h is null or p_h !~ '^\d{2}:\d{2}$' then raise exception 'Hora no válida'; end if;
  if p_h < ini or p_h >= fin then raise exception 'La % es de % a %', lower(p_s), ini, fin; end if;

  insert into public.reservas (n, p, d, s, h, x, tel, origen, estado)
  values (left(trim(p_n), 80), p_p, p_d, p_s, p_h,
          left(coalesce(trim(p_x), ''), 300), left(coalesce(trim(p_tel), ''), 30), p_origen, 'pendiente');
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.pedir_reserva(text, int, date, text, text, text, text, text) from public;
grant execute on function public.pedir_reserva(text, int, date, text, text, text, text, text) to anon, authenticated;

-- 5. Al entrar una petición «pendiente», la base de datos avisa a la función (que manda el Telegram).
--    La función solo avisa una vez por reserva y solo en sus primeros minutos.
create extension if not exists pg_net with schema extensions;

create or replace function public.avisar_reserva() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'pendiente' then
    perform net.http_post(
      url := 'https://gpqgzlpsareumgbxqjwn.supabase.co/functions/v1/chat?aviso=1',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
end;
$$;
revoke all on function public.avisar_reserva() from public, anon, authenticated;

drop trigger if exists reservas_aviso on public.reservas;
create trigger reservas_aviso after insert on public.reservas
  for each row execute function public.avisar_reserva();
