/* Porta di Mare · libro de reservas. Agenda en lista por día y hora.
   Las reservas viven en Supabase (supabase/schema.sql); la conexión está en supabase-config.js.
   Lo que llega desde el formulario de la web o desde el asistente entra aquí como «Por confirmar». */
(function () {
  'use strict';
  var CLAVE_VISTA = 'pdm-vista';
  var SERV = { Comida: ['12:00', '16:00'], Cena: ['20:00', '23:00'] };
  var ABIERTO = { 0: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
  var DL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var DC = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var ESTADO = { pendiente: 'Por confirmar', confirmada: 'Confirmada', llegada: 'Ha llegado', novino: 'No vino', anulada: 'Anulada' };
  var ACC = {
    pendiente: [['confirmar', 'Confirmar', 1], ['anular', 'Anular']],
    confirmada: [['llegada', 'Ha llegado', 1], ['novino', 'No vino'], ['anular', 'Anular']],
    llegada: [['confirmar', 'Deshacer']],
    novino: [['confirmar', 'Recuperar']],
    anulada: [['confirmar', 'Recuperar']]
  };
  var NUEVO = { confirmar: 'confirmada', llegada: 'llegada', novino: 'novino', anular: 'anulada' };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function deIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function suma(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function min(h) { var p = h.split(':'); return +p[0] * 60 + +p[1]; }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function hoy() { return iso(new Date()); }
  function abierto(s) { return !!ABIERTO[deIso(s).getDay()]; }
  /* El primer día con servicio desde s (incluido); nunca antes de hoy */
  function siguienteAbierto(s) {
    var d = deIso(s < hoy() ? hoy() : s);
    for (var i = 0; i < 7 && !ABIERTO[d.getDay()]; i++) d = suma(d, 1);
    return iso(d);
  }
  function corto(s) { var d = deIso(s); return DC[d.getDay()] + ' ' + d.getDate(); }
  function largo(s) { var d = deIso(s); return DL[d.getDay()] + ' ' + d.getDate() + ' de ' + MES[d.getMonth()]; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    catch (err) { return null; }
    return null;
  }
  function dur(r) { return r.p >= 7 ? 120 : 90; }
  function fin(r) { var m = min(r.h); return Math.min(m + dur(r), r.s === 'Comida' ? 16 * 60 : 23 * 60 + 30); }
  function lunesDe(s) { var d = deIso(s); return suma(d, -((d.getDay() + 6) % 7)); }
  function textoSemana(s) {
    var l = lunesDe(s), dom = suma(l, 6);
    return l.getMonth() === dom.getMonth()
      ? 'Semana del ' + l.getDate() + ' al ' + dom.getDate() + ' de ' + MES[dom.getMonth()]
      : 'Semana del ' + l.getDate() + ' de ' + MES[l.getMonth()] + ' al ' + dom.getDate() + ' de ' + MES[dom.getMonth()];
  }

  /* ——— Datos: todo vive en Supabase (tablas reservas y ajustes) ——— */
  var lista = [], ajustes = { aforo: 60 };
  var CFG = window.PDM_SUPABASE || {};
  var sb = CFG.url && CFG.anonKey && window.supabase ? window.supabase.createClient(CFG.url, CFG.anonKey) : null;
  var CAMPOS = 'id,n,p,d,s,h,x,mesa,tel,origen,estado,creada,cambiada';
  /* Convierte la respuesta de Supabase en datos, o en un error: http 401 = sin sesión,
     otro número = la base de datos lo ha rechazado, sin número = no hay conexión */
  function q(promesa) {
    return Promise.resolve(promesa).then(function (r) {
      if (!r.error) return r.data;
      var e = new Error(r.error.message || 'Error'), st = r.status || r.error.status || 0;
      if (st === 401 || st === 403 || r.error.code === 'PGRST301' || r.error.code === '42501') e.http = 401;
      else if (st >= 400) e.http = st;
      throw e;
    });
  }
  function cargar() {
    if (!sb) { pantalla('sin-bd'); return Promise.reject(new Error('Supabase sin configurar')); }
    return sb.auth.getSession().then(function (r) {
      if (!r.data || !r.data.session) { var e = new Error('Sin sesión'); e.http = 401; throw e; }
      return Promise.all([
        q(sb.from('reservas').select(CAMPOS).gte('d', iso(suma(new Date(), -120))).order('d').order('h').limit(5000)),
        q(sb.from('ajustes').select('aforo').eq('id', 1).maybeSingle())
      ]);
    }).then(function (res) {
      lista = res[0] || [];
      if (res[1]) ajustes = res[1];
      pantalla('panel');
      return lista;
    }, function (e) { pantalla(e.http === 401 ? 'acceso' : 'sin-bd'); throw e; });
  }
  function aforo() { return +ajustes.aforo > 0 ? +ajustes.aforo : 60; }
  function busca(id) { return lista.filter(function (x) { return x.id === id; })[0]; }
  function cambia(r) { for (var i = 0; i < lista.length; i++) if (lista[i].id === r.id) { lista[i] = r; return; } lista.push(r); }

  /* Qué se enseña: el panel, la pantalla de acceso o el aviso de que no hay base de datos */
  var modo = 'cargando';
  function pantalla(m) {
    var antes = modo; modo = m;
    var b = document.body.classList;
    b.remove('cargando');
    b.toggle('sin-bd', m === 'sin-bd');
    b.toggle('sin-sesion', m === 'acceso');
    $('[data-sin-bd]').hidden = m !== 'sin-bd';
    $('[data-sin-config]').hidden = !!sb;
    $('[data-acceso]').hidden = m !== 'acceso';
    $('[data-salir]').hidden = m !== 'panel';
    if (m === 'acceso' && antes !== 'acceso') {
      [dlgF, dlgN].forEach(function (d) { if (d.open) d.close(); });
      lista = [];
      setTimeout(function () { var c = $('[data-login] [name="email"]'); $('[data-login] [name="clave"]').value = ''; c.focus(); }, 30);
    }
  }
  function sinBaseDatos() { pantalla('sin-bd'); }
  /* Aviso breve cuando algo no se ha podido guardar */
  var tAviso;
  function avisoError(e) {
    if (e && e.http === 401) { pantalla('acceso'); return; }
    var t = $('[data-aviso-bd]');
    t.textContent = 'No se ha guardado: ' + (e && e.http ? e.message : 'no hay conexión con la base de datos') + '.';
    t.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(function () { t.hidden = true; }, 6000);
    if (!e || !e.http) sinBaseDatos();
  }

  function delDia(s, serv) { return lista.filter(function (r) { return r.d === s && (!serv || r.s === serv); }); }
  function cuenta(rs) { return rs.reduce(function (t, r) { return t + (r.estado === 'anulada' || r.estado === 'novino' ? 0 : +r.p || 0); }, 0); }

  /* ——— Estado de la vista ——— */
  var sel = hoy();
  var vista = store(CLAVE_VISTA) || (window.matchMedia('(max-width:760px)').matches ? 'dia' : 'semana');
  var $ = function (q) { return document.querySelector(q); };

  /* ——— Cabecera del día y tabla de pino ——— */
  function pintarDia() {
    var dif = Math.round((deIso(sel) - deIso(hoy())) / 864e5);
    $('[data-dia-rel]').textContent = dif === 0 ? 'Hoy' : dif === 1 ? 'Mañana' : dif === -1 ? 'Ayer' : dif > 0 ? 'Dentro de ' + dif + ' días' : 'Hace ' + (-dif) + ' días';
    $('[data-dia-titulo]').textContent = largo(sel);
    var est = $('[data-dia-estado]'), ab = abierto(sel);
    est.textContent = ab ? 'Comida ' + SERV.Comida.join('–') + ' · Cena ' + SERV.Cena.join('–') : 'Cerrado · lunes y martes no hay servicio';
    est.classList.toggle('cerrado', !ab);
    $('[data-cifra="Comida"]').textContent = cuenta(delDia(sel, 'Comida'));
    $('[data-cifra="Cena"]').textContent = cuenta(delDia(sel, 'Cena'));
    var pend = delDia(sel).filter(function (r) { return r.estado === 'pendiente'; }).length;
    $('[data-cifra="pend"]').textContent = pend;
    $('[data-cifra-pend-caja]').classList.toggle('aviso', pend > 0);
  }

  function pintarSemana() {
    var lunes = lunesDe(sel), ol = $('[data-dias]'), h = hoy();
    $('[data-mes]').textContent = textoSemana(sel);
    ol.textContent = '';
    for (var i = 0; i < 7; i++) {
      var d = suma(lunes, i), s = iso(d), ab = !!ABIERTO[d.getDay()], c = cuenta(delDia(s));
      var li = el('li'), b = el('button');
      b.type = 'button'; b.dataset.dia = s;
      b.appendChild(el('span', 'd', DC[d.getDay()]));
      b.appendChild(el('span', 'num', d.getDate()));
      b.appendChild(el('span', 'pax', ab ? c + ' pax' : 'Cerrado'));
      if (!ab) b.classList.add('cerrado');
      if (s === h) { b.classList.add('hoy'); b.setAttribute('aria-current', 'date'); }
      b.setAttribute('aria-pressed', s === sel ? 'true' : 'false');
      b.setAttribute('aria-label', largo(s) + (ab ? ', ' + c + ' cubiertos' : ', cerrado') + (s === h ? ', hoy' : ''));
      li.appendChild(b); ol.appendChild(li);
    }
  }

  /* ——— La agenda en lista: un bloque por día, dentro comida y cena, una fila por reserva ——— */
  var ORD = { pendiente: 0, confirmada: 0, llegada: 0, novino: 1, anulada: 1 };

  function fila(r, nuevoId) {
    var li = el('li'), b = el('button', 'fr fr-' + r.estado + (r.id === nuevoId ? ' nuevo' : ''));
    b.type = 'button'; b.dataset.ev = r.id;
    var hora = el('span', 'fr-hora'); hora.appendChild(el('b', null, r.h)); hora.appendChild(el('span', null, hhmm(fin(r))));
    b.appendChild(hora);
    var mk = el('span', 'fr-marca muestra ev-' + r.estado); mk.setAttribute('aria-hidden', 'true'); b.appendChild(mk);
    var cu = el('span', 'fr-cuerpo');
    cu.appendChild(el('span', 'fr-n', r.n));
    var det = [];
    if (r.mesa) det.push('Mesa ' + r.mesa);
    if (r.x) det.push(r.x);
    if (r.origen) det.push('Vía ' + r.origen);
    if (det.length) cu.appendChild(el('span', 'fr-d', det.join(' · ')));
    b.appendChild(cu);
    b.appendChild(el('span', 'fr-pax', r.p + ' pax'));
    b.appendChild(el('span', 'sello fr-sello est-' + r.estado, ESTADO[r.estado]));
    b.setAttribute('aria-label', r.h + ', ' + r.n + ', ' + r.p + ' personas, ' + ESTADO[r.estado] + (r.x ? ', ' + r.x : ''));
    li.appendChild(b);
    return li;
  }

  function pintarAgenda(nuevoId) {
    var dias = [];
    if (vista === 'dia') dias = [sel];
    else for (var i = 0; i < 7; i++) dias.push(iso(suma(lunesDe(sel), i)));
    var ag = $('[data-agenda]'), g = $('[data-grid]'), h = hoy(), af = aforo();
    var ahora = new Date(), mAhora = ahora.getHours() * 60 + ahora.getMinutes();
    ag.classList.toggle('vista-dia', vista === 'dia');
    ag.classList.toggle('vista-semana', vista === 'semana');
    $('[data-agenda-titulo]').textContent = vista === 'dia' ? largo(sel) : textoSemana(sel);
    document.querySelectorAll('[data-vista]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.vista === vista ? 'true' : 'false'); });
    g.textContent = '';

    var ol = el('ol', 'lista');
    dias.forEach(function (s) {
      var d = deIso(s), ab = abierto(s), li = el('li', 'l-dia');
      if (s === h) li.classList.add('hoy');
      if (!ab) li.classList.add('cerrado');

      var fecha = el(vista === 'semana' ? 'button' : 'div', 'l-fecha');
      if (vista === 'semana') { fecha.type = 'button'; fecha.dataset.irDia = s; fecha.setAttribute('aria-label', 'Ver solo ' + largo(s)); }
      fecha.appendChild(el('span', 'l-num', d.getDate()));
      fecha.appendChild(el('span', 'l-d', DC[d.getDay()] + ' · ' + MES[d.getMonth()].slice(0, 3)));
      if (s === h) fecha.appendChild(el('span', 'l-hoy', 'Hoy'));
      li.appendChild(fecha);

      var cuerpo = el('div', 'l-cuerpo');
      if (!ab) {
        cuerpo.appendChild(el('p', 'l-cerrado', 'Cerrado · ' + DL[d.getDay()].toLowerCase() + ' no hay servicio'));
      } else {
        ['Comida', 'Cena'].forEach(function (sv) {
          var rs = delDia(s, sv).sort(function (a, b) { return (ORD[a.estado] - ORD[b.estado]) || a.h.localeCompare(b.h); });
          var n = cuenta(rs), sec = el('section', 'l-serv');
          var cab = el('div', 'l-serv-cab');
          cab.appendChild(el('h3', 'l-serv-t', sv));
          cab.appendChild(el('span', 'l-serv-h', SERV[sv].join('–')));
          var oc = el('span', 'l-ocupa' + (n >= af * 0.9 ? ' lleno' : ''));
          oc.appendChild(el('b', null, n)); oc.appendChild(document.createTextNode(' / ' + af + ' pax'));
          var bar = el('span', 'l-barra'), bi = el('i'); bi.style.width = Math.min(100, n / af * 100) + '%'; bar.appendChild(bi);
          bar.setAttribute('aria-hidden', 'true');
          cab.appendChild(oc); cab.appendChild(bar);
          sec.appendChild(cab);

          var lr = el('ol', 'l-res');
          if (!rs.length) lr.appendChild(el('li', 'l-vacio', 'Sin reservas.'));
          var puesta = false, rango = SERV[sv];
          var enServicio = s === h && mAhora >= min(rango[0]) && mAhora < min(rango[1]) + 30;
          rs.forEach(function (r) {
            if (enServicio && !puesta && ORD[r.estado] === 0 && min(r.h) > mAhora) {
              var a = el('li', 'l-ahora'); a.appendChild(el('span', null, 'Ahora · ' + hhmm(mAhora))); lr.appendChild(a); puesta = true;
            }
            lr.appendChild(fila(r, nuevoId));
          });
          sec.appendChild(lr);
          cuerpo.appendChild(sec);
        });
      }
      li.appendChild(cuerpo);
      ol.appendChild(li);
    });
    g.appendChild(ol);
  }

  function pintarPendientes() {
    var h = hoy(), ol = $('[data-pendientes]');
    var ps = lista.filter(function (r) { return r.estado === 'pendiente' && r.d >= h; })
      .sort(function (a, b) { return a.d.localeCompare(b.d) || a.h.localeCompare(b.h); });
    $('#t-pend').textContent = ps.length ? 'Por confirmar · ' + ps.length : 'Por confirmar';
    ol.textContent = '';
    if (!ps.length) { ol.appendChild(el('li', 'pend-vacio', 'Nada pendiente. Todo contestado.')); return; }
    ps.slice(0, 10).forEach(function (r) {
      var li = el('li'), b = el('button');
      b.type = 'button'; b.dataset.ev = r.id; b.dataset.irA = r.d;
      b.appendChild(el('span', 'pend-f', corto(r.d) + ' · ' + r.s + ' · ' + r.h));
      b.appendChild(el('span', 'pend-n', r.n + ' · ' + r.p + ' pax'));
      if (r.x) b.appendChild(el('span', null, r.x));
      li.appendChild(b); ol.appendChild(li);
    });
  }

  function pintar(nuevoId) { pintarDia(); pintarSemana(); pintarAgenda(nuevoId); pintarPendientes(); if (dlgF.open) pintarFicha(); }
  function anuncia(t) { var a = $('[data-anuncio]'); a.textContent = ''; setTimeout(function () { a.textContent = t; }, 30); }

  /* ——— Ficha de una reserva ——— */
  var dlgF = $('[data-ficha]'), fichaId = null;
  function dato(dl, k, v) { if (!v && v !== 0) return; dl.appendChild(el('dt', null, k)); dl.appendChild(el('dd', null, v)); }
  function pintarFicha() {
    var r = busca(fichaId); if (!r) { dlgF.close(); return; }
    $('[data-ficha-hora]').textContent = r.h + ' – ' + hhmm(fin(r));
    $('[data-ficha-n]').textContent = r.n;
    $('[data-ficha-cuando]').textContent = largo(r.d) + ' · ' + r.s;
    var dl = $('[data-ficha-datos]'); dl.textContent = '';
    dato(dl, 'Personas', r.p);
    dato(dl, 'Mesa', r.mesa);
    dato(dl, 'Teléfono', r.tel);
    dato(dl, 'Notas', r.x);
    dato(dl, 'Vía', r.origen);
    var acc = $('[data-ficha-acc]'); acc.textContent = '';
    acc.appendChild(el('span', 'sello est-' + r.estado, ESTADO[r.estado] || r.estado));
    (ACC[r.estado] || []).forEach(function (a) {
      var b = el('button', 'accion' + (a[2] ? ' principal' : ''), a[1]);
      b.type = 'button'; b.dataset.accion = a[0]; b.dataset.id = r.id;
      acc.appendChild(b);
    });
    if (r.tel) {
      var num = r.tel.replace(/\D/g, ''); if (num.length === 9) num = '34' + num;
      var wa = el('a', 'accion wa', 'WhatsApp');
      wa.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent('Hola ' + r.n + ', te confirmamos la mesa en Porta di Mare: ' + largo(r.d).toLowerCase() + ' a las ' + r.h + ', ' + r.p + ' personas. ¡Hasta pronto!');
      wa.target = '_blank'; wa.rel = 'noopener';
      var tel = el('a', 'accion', 'Llamar'); tel.href = 'tel:+' + num;
      acc.appendChild(wa); acc.appendChild(tel);
    }
  }
  function abrirFicha(id) { fichaId = id; pintarFicha(); if (!dlgF.open) dlgF.showModal(); }

  /* ——— Nueva reserva ——— */
  var dlgN = $('[data-dlg-nueva]'), form = $('[data-nueva]');
  function abrirNueva(d, h) {
    form.reset();
    var E = form.elements;
    E.d.value = d; E.h.value = h || '';
    if (h) E.s.value = min(h) < 17 * 60 ? 'Comida' : 'Cena';
    [E.d, E.h].forEach(function (c) { c.setCustomValidity(''); });
    dlgN.showModal();
    E.n.focus();
  }
  form.elements.h.addEventListener('change', function () {
    if (this.value) form.elements.s.value = min(this.value) < 17 * 60 ? 'Comida' : 'Cena';
  });
  form.addEventListener('input', function (ev) { if (ev.target.setCustomValidity) ev.target.setCustomValidity(''); });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var E = form.elements, rango = SERV[E.s.value];
    E.d.setCustomValidity(E.d.value && !abierto(E.d.value) ? 'Ese día está cerrado: lunes y martes no hay servicio.' : '');
    E.h.setCustomValidity(E.h.value && (min(E.h.value) < min(rango[0]) || min(E.h.value) >= min(rango[1]))
      ? 'La ' + E.s.value.toLowerCase() + ' es de ' + rango[0] + ' a ' + rango[1] + '.' : '');
    if (!form.reportValidity()) return;
    var datos = { n: E.n.value.trim(), p: +E.p.value, d: E.d.value, s: E.s.value, h: E.h.value,
      x: E.x.value.trim(), mesa: E.mesa.value.trim(), tel: E.tel.value.trim(), origen: E.origen.value, estado: 'confirmada' };
    var boton = form.querySelector('[type="submit"]'); boton.disabled = true;
    q(sb.from('reservas').insert(datos).select(CAMPOS).single()).then(function (r) {
      cambia(r);
      dlgN.close();
      sel = r.d; pintar(r.id);
      anuncia('Apuntada: ' + r.n + ', ' + r.p + ' personas, ' + largo(r.d) + ' a las ' + r.h);
    }, avisoError).then(function () { boton.disabled = false; });
  });

  /* Cerrar las ventanas pulsando fuera */
  [dlgF, dlgN].forEach(function (d) { d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); }); });

  /* ——— Clics ——— */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-cerrar')) { t.closest('dialog').close(); return; }
    if (t.dataset.irA) { sel = t.dataset.irA; pintar(); abrirFicha(t.dataset.ev); return; }
    if (t.dataset.ev) { abrirFicha(t.dataset.ev); return; }
    if (t.dataset.dia) { sel = t.dataset.dia; pintar(); return; }
    if (t.dataset.irDia) { sel = t.dataset.irDia; vista = 'dia'; store(CLAVE_VISTA, vista); pintar(); return; }
    if (t.dataset.vista) { vista = t.dataset.vista; store(CLAVE_VISTA, vista); pintar(); return; }
    if (t.dataset.paso) { sel = iso(suma(deIso(sel), +t.dataset.paso)); pintar(); return; }
    if (t.hasAttribute('data-hoy')) { sel = hoy(); pintar(); return; }
    if (t.hasAttribute('data-abrir-nueva')) { abrirNueva(siguienteAbierto(sel), ''); return; }
    if (t.dataset.accion) {
      if (!busca(t.dataset.id)) return;
      t.disabled = true;
      q(sb.from('reservas').update({ estado: NUEVO[t.dataset.accion], cambiada: new Date().toISOString() })
        .eq('id', t.dataset.id).select(CAMPOS).single()).then(function (r) {
        cambia(r); pintar();
        anuncia(r.n + ': ' + ESTADO[r.estado].toLowerCase());
      }, function (e) { t.disabled = false; avisoError(e); });
      return;
    }
    if (t.hasAttribute('data-reintentar')) { cargar().then(function () { pintar(); }, function () {}); return; }
  });

  /* ——— Aforo ——— */
  var afIn = $('[data-aforo-input]');
  afIn.addEventListener('change', function () {
    if (!(+afIn.value > 0)) return;
    q(sb.from('ajustes').update({ aforo: +afIn.value }).eq('id', 1).select('aforo').single()).then(function (a) { ajustes = a; pintar(); }, avisoError);
  });

  /* ——— Entrar y salir ——— */
  var login = $('[data-login]'), loginError = $('[data-login-error]');
  login.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var c = login.elements.clave, b = login.querySelector('[type="submit"]');
    loginError.textContent = '';
    if (!sb) { sinBaseDatos(); return; }
    b.disabled = true;
    sb.auth.signInWithPassword({ email: login.elements.email.value.trim(), password: c.value }).then(function (r) {
      if (r.error) {
        var e = new Error(/invalid/i.test(r.error.message) ? 'Email o contraseña incorrectos' : /rate|many/i.test(r.error.message) ? 'Demasiados intentos. Espera un poco' : r.error.message);
        e.http = r.error.status || 400; throw e;
      }
      c.value = '';
      return cargar().then(function () { afIn.value = aforo(); pintar(); });
    }).catch(function (e) {
      if (e.http) { loginError.textContent = e.message + '.'; c.select(); }
      else sinBaseDatos();
    }).then(function () { b.disabled = false; });
  });
  $('[data-salir]').addEventListener('click', function () {
    var fuera = function () { pantalla('acceso'); };
    sb.auth.signOut().then(fuera, fuera);
  });

  /* Cada 15 segundos se mira si han entrado peticiones nuevas desde la web */
  setInterval(function () {
    if (document.hidden || dlgN.open || modo === 'acceso') return;
    var antes = lista.length;
    cargar().then(function () {
      pintar();
      if (lista.length > antes) anuncia('Nueva petición de reserva');
    }, function () {});
  }, 15000);

  /* La línea de «ahora» avanza sola */
  setInterval(function () { if (lista.length) pintarAgenda(); }, 60000);

  /* Si la sesión caduca o se cierra en otra pestaña, vuelve a pedir acceso */
  if (sb) sb.auth.onAuthStateChange(function (evento) { if (evento === 'SIGNED_OUT') pantalla('acceso'); });

  cargar().then(function () { afIn.value = aforo(); pintar(); }, function () {});
})();
