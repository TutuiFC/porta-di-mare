-- Porta di Mare · código de reserva: el cliente lo recibe al reservar y con él puede consultar, cambiar o anular.
-- Ejecutar DESPUÉS de schema.sql y telegram.sql (Supabase → SQL Editor → pegar → Run). Se puede volver a ejecutar.
--
-- Consultar, cambiar y anular NO están abiertas a la web: solo las usa el asistente desde el servidor
-- (clave de servidor), así nadie puede ir probando códigos directamente contra la base de datos.

-- 1. Código de 6 caracteres sin letras que se confundan (sin 0/O, 1/I/L)
create or replace function public.nuevo_codigo() returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea; c text;
begin
  loop
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    c := '';
    for i in 0..5 loop
      c := c || substr(abc, 1 + get_byte(b, i) % length(abc), 1);
    end loop;
    exit when not exists (select 1 from public.reservas where codigo = c);
  end loop;
  return c;
end;
$$;

alter table public.reservas add column if not exists codigo text;
update public.reservas set codigo = public.nuevo_codigo() where codigo is null;
alter table public.reservas alter column codigo set default public.nuevo_codigo();
alter table public.reservas alter column codigo set not null;
create unique index if not exists reservas_codigo_idx on public.reservas (codigo);

-- 2. Reglas comunes de día, servicio y hora (las mismas para pedir y para cambiar)
create or replace function public.validar_reserva(p_p int, p_d date, p_s text, p_h text) returns void
language plpgsql
set search_path = public
as $$
declare
  ini text; fin text;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
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
end;
$$;
revoke all on function public.validar_reserva(int, date, text, text) from public, anon, authenticated;

-- 3. pedir_reserva devuelve ahora el código
create or replace function public.pedir_reserva(
  p_n text, p_p int, p_d date, p_s text, p_h text,
  p_x text default '', p_tel text default '', p_origen text default 'Web'
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  if p_origen is null or p_origen not in ('Web', 'Chat', 'Telegram') then p_origen := 'Web'; end if;
  if p_n is null or char_length(trim(p_n)) = 0 then raise exception 'Falta el nombre'; end if;
  perform public.validar_reserva(p_p, p_d, p_s, p_h);

  insert into public.reservas (n, p, d, s, h, x, tel, origen, estado)
  values (left(trim(p_n), 80), p_p, p_d, p_s, p_h,
          left(coalesce(trim(p_x), ''), 300), left(coalesce(trim(p_tel), ''), 30), p_origen, 'pendiente')
  returning codigo into v_codigo;
  return json_build_object('ok', true, 'codigo', v_codigo);
end;
$$;
revoke all on function public.pedir_reserva(text, int, date, text, text, text, text, text) from public;
grant execute on function public.pedir_reserva(text, int, date, text, text, text, text, text) to anon, authenticated;

-- 4. Consultar por código (lo justo para el cliente: sin mesa ni datos internos)
create or replace function public.limpiar_codigo(p text) returns text
language sql immutable
as $$ select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

create or replace function public.consultar_reserva(p_codigo text) returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('codigo', codigo, 'nombre', n, 'personas', p, 'dia', d, 'servicio', s, 'hora', h,
                           'notas', x, 'estado', estado)
  from public.reservas where codigo = public.limpiar_codigo(p_codigo);
$$;

-- 5. Cambiar día, hora, personas o notas. Vuelve a «pendiente»: el restaurante tiene que confirmarla otra vez.
create or replace function public.modificar_reserva(
  p_codigo text, p_d date default null, p_h text default null, p_p int default null, p_x text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservas;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
  nd date; nh text; np int; nx text; ns text;
begin
  select * into r from public.reservas where codigo = public.limpiar_codigo(p_codigo) for update;
  if not found then raise exception 'No hay ninguna reserva con ese código'; end if;
  if r.estado not in ('pendiente', 'confirmada') then raise exception 'Esta reserva ya no se puede cambiar (está %)', r.estado; end if;
  if r.d < hoy then raise exception 'Esta reserva ya ha pasado'; end if;

  nd := coalesce(p_d, r.d); nh := coalesce(nullif(trim(p_h), ''), r.h); np := coalesce(p_p, r.p);
  nx := left(coalesce(trim(p_x), r.x), 300);
  ns := case when nh < '17:00' then 'Comida' else 'Cena' end;
  if nd = r.d and nh = r.h and np = r.p and nx = r.x then raise exception 'No hay ningún cambio'; end if;
  perform public.validar_reserva(np, nd, ns, nh);

  update public.reservas
     set d = nd, h = nh, s = ns, p = np, x = nx, estado = 'pendiente', cambiada = now()
   where id = r.id;
  return json_build_object('id', r.id, 'codigo', r.codigo, 'nombre', r.n, 'personas', np, 'dia', nd, 'servicio', ns,
                           'hora', nh, 'notas', nx, 'estado', 'pendiente');
end;
$$;

-- 6. Anular
create or replace function public.anular_reserva(p_codigo text) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservas;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  select * into r from public.reservas where codigo = public.limpiar_codigo(p_codigo) for update;
  if not found then raise exception 'No hay ninguna reserva con ese código'; end if;
  if r.estado not in ('pendiente', 'confirmada') then raise exception 'Esta reserva ya no se puede anular (está %)', r.estado; end if;
  if r.d < hoy then raise exception 'Esta reserva ya ha pasado'; end if;
  update public.reservas set estado = 'anulada', cambiada = now() where id = r.id;
  return json_build_object('id', r.id, 'codigo', r.codigo, 'estado', 'anulada');
end;
$$;

-- Solo el servidor (la función del asistente) puede consultar, cambiar y anular por código
revoke all on function public.consultar_reserva(text) from public, anon, authenticated;
revoke all on function public.modificar_reserva(text, date, text, int, text) from public, anon, authenticated;
revoke all on function public.anular_reserva(text) from public, anon, authenticated;
grant execute on function public.consultar_reserva(text) to service_role;
grant execute on function public.modificar_reserva(text, date, text, int, text) to service_role;
grant execute on function public.anular_reserva(text) to service_role;
