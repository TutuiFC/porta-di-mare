-- Porta di Mare · reservas de EJEMPLO para enseñar el panel lleno (opcional).
-- Borra TODAS las reservas y crea unas inventadas alrededor de hoy. No lo ejecutes con reservas reales.
-- Supabase → SQL Editor → New query → pegar → Run.

delete from public.reservas;

do $$
declare
  comida text[][] := array[
    ['13:00','Jordi Puig','2','','4'], ['13:30','Família Roca','6','Trona para un niño','10'], ['13:45','Laura Martín','4','',''],
    ['14:00','Pere Vidal','3','Terraza si puede ser','T2'], ['14:15','Sophie Laurent','2','',''], ['14:30','Anna Ferrer','2','Celíaca: sin gluten','']];
  cena text[][] := array[
    ['20:30','Marc Serra','2','Aniversario','7'], ['20:45','Elena Rius','2','Alergia a frutos secos',''], ['21:00','Núria Casals','4','','T4'],
    ['21:00','Tom Baker','5','',''], ['21:15','Carla Gómez','2','Terraza','T1'], ['21:30','Cena de empresa','14','Menú de grupo, preguntar postres','12-14'],
    ['22:00','Oriol Martí','3','','']];
  origenes text[] := array['Teléfono','WhatsApp','Teléfono','En sala'];
  hoy date := (now() at time zone 'Europe/Madrid')::date;
  off int; dia date; si int; i int; fila text[]; est text; lista text[][];
begin
  for off in -7..14 loop
    dia := hoy + off;
    continue when extract(isodow from dia) in (1, 2);
    for si in 0..1 loop
      lista := case when si = 0 then comida else cena end;
      for i in 1..array_length(lista, 1) loop
        continue when ((i - 1) * 2 + off + si) % 3 = 0 and not (off = 0 and si = 1);
        if off < 0 then est := case when ((i - 1) + off) % 5 = 0 then 'novino' else 'llegada' end;
        elsif off = 0 then est := case when si = 0 then 'llegada' when (i - 1) % 3 = 1 then 'pendiente' else 'confirmada' end;
        else est := case when off <= 6 and ((i - 1) + off) % 5 = 0 then 'pendiente' else 'confirmada' end;
        end if;
        insert into public.reservas (n, p, d, s, h, x, mesa, origen, estado)
        values (lista[i][2], lista[i][3]::int, dia, case when si = 0 then 'Comida' else 'Cena' end, lista[i][1], lista[i][4], lista[i][5],
                case when est = 'pendiente' then 'Web' else origenes[abs((i - 1) + off) % 4 + 1] end, est);
      end loop;
    end loop;
  end loop;
end $$;
