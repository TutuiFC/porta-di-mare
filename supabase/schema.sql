-- Porta di Mare · base de datos del libro de reservas (Supabase / Postgres)
-- Pégalo entero en Supabase → SQL Editor → New query → Run. Se puede volver a ejecutar sin romper nada.
--
-- Quién puede hacer qué:
--   · La web pública (clave «anon»): SOLO puede pedir una reserva con la función pedir_reserva().
--     Entra siempre como «pendiente». No puede leer, cambiar ni borrar ninguna reserva.
--   · El panel (usuario con email y contraseña creado en Authentication): lee y cambia todo.

-- ——— Tablas ———
create table if not exists public.reservas (
  id        uuid primary key default gen_random_uuid(),
  n         text not null check (char_length(n) between 1 and 80),          -- nombre
  p         int  not null check (p between 1 and 80),                       -- personas
  d         date not null,                                                  -- día
  s         text not null check (s in ('Comida', 'Cena')),                  -- servicio
  h         text not null check (h ~ '^\d{2}:\d{2}$'),                      -- hora HH:MM
  x         text not null default '' check (char_length(x) <= 300),         -- notas
  mesa      text not null default '' check (char_length(mesa) <= 20),
  tel       text not null default '' check (char_length(tel) <= 30),
  origen    text not null default 'Web' check (origen in ('Web', 'Chat', 'Teléfono', 'WhatsApp', 'En sala')),
  estado    text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'llegada', 'novino', 'anulada')),
  creada    timestamptz not null default now(),
  cambiada  timestamptz
);
create index if not exists reservas_d_idx on public.reservas (d);

create table if not exists public.ajustes (
  id     int primary key default 1 check (id = 1),
  aforo  int not null default 60 check (aforo between 1 and 300)            -- cubiertos por servicio
);
insert into public.ajustes (id) values (1) on conflict (id) do nothing;

-- ——— Permisos (Row Level Security) ———
alter table public.reservas enable row level security;
alter table public.ajustes  enable row level security;

drop policy if exists "panel lee reservas"    on public.reservas;
drop policy if exists "panel crea reservas"   on public.reservas;
drop policy if exists "panel cambia reservas" on public.reservas;
drop policy if exists "panel lee ajustes"     on public.ajustes;
drop policy if exists "panel cambia ajustes"  on public.ajustes;

create policy "panel lee reservas"    on public.reservas for select to authenticated using (true);
create policy "panel crea reservas"   on public.reservas for insert to authenticated with check (true);
create policy "panel cambia reservas" on public.reservas for update to authenticated using (true) with check (true);
create policy "panel lee ajustes"     on public.ajustes  for select to authenticated using (true);
create policy "panel cambia ajustes"  on public.ajustes  for update to authenticated using (true) with check (true);
-- Sin políticas para «anon»: la web pública no ve ninguna fila.

revoke all on public.reservas from anon;
revoke all on public.ajustes  from anon;

-- ——— La única puerta de la web pública y del chatbot ———
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
  if p_origen is null or p_origen not in ('Web', 'Chat') then p_origen := 'Web'; end if;
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
