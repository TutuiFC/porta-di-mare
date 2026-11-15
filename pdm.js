/* Porta di Mare: idiomas (ES/CA/EN), carta desde carta.js, semana con hoy encendido y estado abierto/cerrado. */
(function () {
  var T = {
    es: {
      'nav.carta': 'Carta', 'nav.forno': 'Dal forno', 'nav.terrazza': 'Terrazza', 'nav.reserva': 'Reservar', 'nav.idioma': 'Idioma',
      'hero.linea': 'Cocina italiana con producto traído de Italia, pizza al horno de leña y terraza en la calle Enric Granados.',
      'hero.reservar': 'Reservar por WhatsApp',
      'semana': 'Esta semana',
      'carta.titulo': 'La carta', 'carta.tradizionali': 'Tradizionali', 'carta.calzone': 'Calzone', 'carta.supl': 'Suplementos de pizza',
      'carta.vegetal': 'Pizza vegetal, con verduras',
      'carta.nota': 'Antipasti, pasta y postres: en la carta del local. Precios con IVA.',
      'carta.alerg': 'Los productos pueden contener huevo, gluten, pescado, frutos de cáscara o lácteos. Consúltanos antes de pedir.',
      'forno.titulo': 'Dal forno', 'forno.texto': 'Las pizzas salen del horno de leña de la sala. Los platos, en mayólica azul.',
      'forno.nota': 'Platos fotografiados por los clientes.',
      'p.009': 'Margherita', 'p.068': 'Burrata', 'p.030': 'Spaghetti ai frutti di mare', 'p.097': 'Panna cotta',
      'p.005': 'Pizza con mortadela y pistacho', 'p.121': 'Carpaccio de tomate', 'p.052': 'Burrata', 'p.014': 'Tiramisù',
      'terr.titulo': 'Terrazza', 'terr.texto': 'Mesas fuera y dentro, hasta las once de la noche de miércoles a domingo.',
      'terr.grupos': 'Grupos y celebraciones', 'terr.grupos.t': 'Para cenas de grupo, cumpleaños o empresa, escríbenos y preparamos la mesa.',
      'op.titulo': '4,4 de 5 en Google · 702 opiniones', 'op.t1': 'Producto italiano: vitello tonnato, pizzas grandes, tiramisù.', 'op.t2': 'Servicio atento y ambiente tranquilo.', 'op.t3': 'Muchas opiniones en inglés: vienen también de fuera.', 'op.nota': 'Lo que más se repite en sus opiniones de Google',
      'res.titulo': 'Reservar mesa', 'res.texto': 'Rellena los datos y se abre WhatsApp con el mensaje escrito. Te confirmamos la mesa.',
      'f.nombre': 'Nombre', 'f.personas': 'Personas', 'f.dia': 'Día', 'f.servicio': 'Servicio', 'f.elige': 'Elige', 'f.comida': 'Comida', 'f.cena': 'Cena', 'f.hora': 'Hora', 'f.notas': 'Celebración, alergias o comentarios', 'f.enviar': 'Enviar por WhatsApp', 'f.intro': 'Hola Porta di Mare, quiero reservar:',
      'info.horario': 'Horario', 'info.donde': 'Dónde estamos', 'info.llamar': 'Llamar', 'info.como': 'Cómo llegar',
      'cerrado': 'Cerrado',
      'e.abierto': 'Abierto ahora', 'e.hasta': 'hasta las', 'e.cerrado': 'Cerrado ahora', 'e.abre': 'abrimos', 'e.hoy': 'hoy', 'e.manana': 'mañana', 'e.a': 'a las',
      'dias': ['el domingo', 'el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 'el sábado'],
      'd.corto': ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      'd.largo': ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      'pie.nota': 'Propuesta de web. La carta es la de una foto de Google Maps; platos, precios y textos pendientes de confirmar con el restaurante.',
      'title': 'Porta di Mare · Ristorante · Terrazza · Premià de Mar'
    },
    ca: {
      'nav.carta': 'Carta', 'nav.forno': 'Dal forno', 'nav.terrazza': 'Terrassa', 'nav.reserva': 'Reservar', 'nav.idioma': 'Idioma',
      'hero.linea': 'Cuina italiana amb producte portat d’Itàlia, pizza al forn de llenya i terrassa al carrer Enric Granados.',
      'hero.reservar': 'Reservar per WhatsApp',
      'semana': 'Aquesta setmana',
      'carta.titulo': 'La carta', 'carta.tradizionali': 'Tradizionali', 'carta.calzone': 'Calzone', 'carta.supl': 'Suplements de pizza',
      'carta.vegetal': 'Pizza vegetal, amb verdures',
      'carta.nota': 'Antipasti, pasta i postres: a la carta del local. Preus amb IVA.',
      'carta.alerg': 'Els productes poden contenir ou, gluten, peix, fruits amb closca o lactis. Consulta’ns abans de demanar.',
      'forno.titulo': 'Dal forno', 'forno.texto': 'Les pizzes surten del forn de llenya de la sala. Els plats, en majòlica blava.',
      'forno.nota': 'Plats fotografiats pels clients.',
      'p.009': 'Margherita', 'p.068': 'Burrata', 'p.030': 'Spaghetti ai frutti di mare', 'p.097': 'Panna cotta',
      'p.005': 'Pizza amb mortadel·la i festuc', 'p.121': 'Carpaccio de tomàquet', 'p.052': 'Burrata', 'p.014': 'Tiramisù',
      'terr.titulo': 'Terrassa', 'terr.texto': 'Taules a fora i a dins, fins a les onze de la nit de dimecres a diumenge.',
      'terr.grupos': 'Grups i celebracions', 'terr.grupos.t': 'Per a sopars de grup, aniversaris o d’empresa, escriu-nos i preparem la taula.',
      'op.titulo': '4,4 de 5 a Google · 702 opinions', 'op.t1': 'Producte italià: vitello tonnato, pizzes grans, tiramisù.', 'op.t2': 'Servei atent i ambient tranquil.', 'op.t3': 'Moltes opinions en anglès: també venen de fora.', 'op.nota': 'El que més es repeteix a les seves opinions de Google',
      'res.titulo': 'Reservar taula', 'res.texto': 'Omple les dades i s’obre WhatsApp amb el missatge escrit. Et confirmem la taula.',
      'f.nombre': 'Nom', 'f.personas': 'Persones', 'f.dia': 'Dia', 'f.servicio': 'Servei', 'f.elige': 'Tria', 'f.comida': 'Dinar', 'f.cena': 'Sopar', 'f.hora': 'Hora', 'f.notas': 'Celebració, al·lèrgies o comentaris', 'f.enviar': 'Enviar per WhatsApp', 'f.intro': 'Hola Porta di Mare, vull reservar:',
      'info.horario': 'Horari', 'info.donde': 'On som', 'info.llamar': 'Trucar', 'info.como': 'Com arribar',
      'cerrado': 'Tancat',
      'e.abierto': 'Obert ara', 'e.hasta': 'fins a les', 'e.cerrado': 'Tancat ara', 'e.abre': 'obrim', 'e.hoy': 'avui', 'e.manana': 'demà', 'e.a': 'a les',
      'dias': ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'],
      'd.corto': ['Dg', 'Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds'],
      'd.largo': ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'],
      'pie.nota': 'Proposta de web. La carta és la d’una foto de Google Maps; plats, preus i textos pendents de confirmar amb el restaurant.',
      'title': 'Porta di Mare · Ristorante · Terrazza · Premià de Mar'
    },
    en: {
      'nav.carta': 'Menu', 'nav.forno': 'Dal forno', 'nav.terrazza': 'Terrace', 'nav.reserva': 'Book', 'nav.idioma': 'Language',
      'hero.linea': 'Italian cooking with produce brought from Italy, wood-fired pizza and a terrace on Carrer Enric Granados.',
      'hero.reservar': 'Book on WhatsApp',
      'semana': 'This week',
      'carta.titulo': 'The menu', 'carta.tradizionali': 'Tradizionali', 'carta.calzone': 'Calzone', 'carta.supl': 'Pizza extras',
      'carta.vegetal': 'Vegetable pizza',
      'carta.nota': 'Antipasti, pasta and desserts: on the menu at the restaurant. Prices include VAT.',
      'carta.alerg': 'Dishes may contain egg, gluten, fish, nuts or dairy. Please ask us before ordering.',
      'forno.titulo': 'Dal forno', 'forno.texto': 'Pizzas come out of the wood-fired oven in the dining room, onto blue majolica plates.',
      'forno.nota': 'Dishes photographed by guests.',
      'p.009': 'Margherita', 'p.068': 'Burrata', 'p.030': 'Spaghetti ai frutti di mare', 'p.097': 'Panna cotta',
      'p.005': 'Pizza with mortadella and pistachio', 'p.121': 'Tomato carpaccio', 'p.052': 'Burrata', 'p.014': 'Tiramisù',
      'terr.titulo': 'Terrace', 'terr.texto': 'Tables outside and in, until eleven at night, Wednesday to Sunday.',
      'terr.grupos': 'Groups and celebrations', 'terr.grupos.t': 'For group dinners, birthdays or company meals, message us and we will set the table.',
      'op.titulo': '4.4 out of 5 on Google · 702 reviews', 'op.t1': 'Italian produce: vitello tonnato, big pizzas, tiramisù.', 'op.t2': 'Attentive service, a calm room.', 'op.t3': 'Many reviews in English: guests come from abroad too.', 'op.nota': 'What comes up most in their Google reviews',
      'res.titulo': 'Book a table', 'res.texto': 'Fill this in and WhatsApp opens with the message written. We will confirm your table.',
      'f.nombre': 'Name', 'f.personas': 'People', 'f.dia': 'Day', 'f.servicio': 'Service', 'f.elige': 'Choose', 'f.comida': 'Lunch', 'f.cena': 'Dinner', 'f.hora': 'Time', 'f.notas': 'Occasion, allergies or notes', 'f.enviar': 'Send on WhatsApp', 'f.intro': 'Hi Porta di Mare, I would like to book:',
      'info.horario': 'Opening hours', 'info.donde': 'Find us', 'info.llamar': 'Call', 'info.como': 'Directions',
      'cerrado': 'Closed',
      'e.abierto': 'Open now', 'e.hasta': 'until', 'e.cerrado': 'Closed now', 'e.abre': 'opens', 'e.hoy': 'today', 'e.manana': 'tomorrow', 'e.a': 'at',
      'dias': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      'd.corto': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      'd.largo': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      'pie.nota': 'Website proposal. The menu comes from a Google Maps photo; dishes, prices and copy to be confirmed with the restaurant.',
      'title': 'Porta di Mare · Ristorante · Terrazza · Premià de Mar'
    }
  };

  var H = { 0: [['12:00', '16:00'], ['20:00', '23:00']], 3: [['12:00', '16:00'], ['20:00', '23:00']], 4: [['12:00', '16:00'], ['20:00', '23:00']], 5: [['12:00', '16:00'], ['20:00', '23:00']], 6: [['12:00', '16:00'], ['20:00', '23:00']] };
  var ORDEN = [1, 2, 3, 4, 5, 6, 0];
  var quiet = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lang = 'es';

  function min(h) { var p = h.split(':'); return +p[0] * 60 + +p[1]; }
  function estado(t) {
    var d = new Date(), dia = d.getDay(), m = d.getHours() * 60 + d.getMinutes(), hoy = H[dia] || [];
    for (var i = 0; i < hoy.length; i++) if (m >= min(hoy[i][0]) && m < min(hoy[i][1])) return { abierto: true, texto: t['e.abierto'] + ' · ' + t['e.hasta'] + ' ' + hoy[i][1] };
    for (var k = 0; k < 8; k++) {
      var dd = (dia + k) % 7, tr = H[dd] || [];
      for (var j = 0; j < tr.length; j++) {
        if (k === 0 && min(tr[j][0]) <= m) continue;
        var cuando = k === 0 ? t['e.hoy'] : k === 1 ? t['e.manana'] : t.dias[dd];
        return { abierto: false, texto: t['e.cerrado'] + ' · ' + t['e.abre'] + ' ' + cuando + ' ' + t['e.a'] + ' ' + tr[j][0] };
      }
    }
    return { abierto: false, texto: t['e.cerrado'] };
  }

  function plato(it, t, i) {
    var li = document.createElement('li');
    li.style.setProperty('--i', i);
    var cab = document.createElement('p'); cab.className = 'plato-cab';
    var n = document.createElement('span'); n.className = 'plato-n'; n.textContent = it.n || it[lang];
    var pt = document.createElement('span'); pt.className = 'puntos'; pt.setAttribute('aria-hidden', 'true');
    var pr = document.createElement('span'); pr.className = 'precio'; pr.textContent = it.p + ' €';
    cab.appendChild(n);
    if (it.v) { var hoja = document.createElement('span'); hoja.className = 'vegetal'; hoja.setAttribute('role', 'img'); hoja.setAttribute('aria-label', t['carta.vegetal']); hoja.title = t['carta.vegetal']; cab.appendChild(hoja); }
    cab.appendChild(pt); cab.appendChild(pr); li.appendChild(cab);
    if (it.n) { var de = document.createElement('p'); de.className = 'plato-d'; de.textContent = it[lang]; li.appendChild(de); }
    return li;
  }
  function carta(t) {
    var C = window.CARTA; if (!C) return;
    ['pizzas', 'calzone', 'suplementos'].forEach(function (k) {
      document.querySelectorAll('[data-carta="' + k + '"]').forEach(function (ul) {
        var lim = +(ul.dataset.limite || 0), lista = lim ? C[k].slice(0, lim) : C[k];
        ul.textContent = '';
        lista.forEach(function (it, i) { ul.appendChild(plato(it, t, i)); });
      });
    });
  }
  function semana(t) {
    var hoy = new Date().getDay();
    document.querySelectorAll('[data-semana]').forEach(function (ol) {
      ol.textContent = '';
      ORDEN.forEach(function (d) {
        var li = document.createElement('li');
        li.textContent = t['d.corto'][d];
        li.setAttribute('aria-label', t['d.largo'][d] + (H[d] ? '' : ' · ' + t.cerrado));
        if (!H[d]) li.className = 'cerrado';
        if (d === hoy) { li.classList.add('hoy'); li.setAttribute('aria-current', 'date'); }
        ol.appendChild(li);
      });
    });
    document.querySelectorAll('[data-dia]').forEach(function (f) {
      var es = f.dataset.dia === String(hoy);
      f.classList.toggle('hoy', es);
      if (es) f.setAttribute('aria-current', 'date'); else f.removeAttribute('aria-current');
    });
  }

  function aplicar(nuevo, animar) {
    lang = T[nuevo] ? nuevo : 'es';
    var t = T[lang];
    document.documentElement.lang = lang;
    document.title = t.title;
    document.querySelectorAll('[data-t]').forEach(function (el) { if (t[el.dataset.t] != null) el.textContent = t[el.dataset.t]; });
    document.querySelectorAll('[data-t-attr]').forEach(function (el) {
      el.dataset.tAttr.split(';').forEach(function (par) { var p = par.split(':'); if (t[p[1]] != null) el.setAttribute(p[0], t[p[1]]); });
    });
    document.querySelectorAll('[data-dl]').forEach(function (el) { el.textContent = t['d.largo'][+el.dataset.dl]; });
    carta(t); semana(t);
    var e = estado(t);
    document.querySelectorAll('[data-estado]').forEach(function (el) { el.textContent = e.texto; el.classList.toggle('abierto', e.abierto); });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false'); });
    var wa = 'https://wa.me/34633450654?text=' + encodeURIComponent(t['f.intro']);
    document.querySelectorAll('[data-wa-link]').forEach(function (a) { a.href = wa; });
    if (animar && !quiet) {
      var r = document.documentElement; r.classList.remove('imprime'); void r.offsetWidth; r.classList.add('imprime');
    }
    try { localStorage.setItem('pdm-lang', lang); } catch (err) { /* sin almacenamiento */ }
  }

  var inicial = '';
  try { inicial = localStorage.getItem('pdm-lang') || ''; } catch (err) { inicial = ''; }
  if (!inicial) { var n = (navigator.language || 'es').slice(0, 2); inicial = n === 'ca' ? 'ca' : n === 'es' ? 'es' : 'en'; }
  aplicar(inicial, false);
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.lang !== lang) aplicar(b.dataset.lang, true); });
  });

  /* La petición también entra en la base de datos (Supabase) y aparece en el panel como «Por confirmar».
     Usa la única puerta pública, pedir_reserva(), que valida día y hora. Si falla, WhatsApp se abre igual. */
  var fr = document.querySelector('form[data-wa]'), SB = window.PDM_SUPABASE || {};
  if (fr && window.fetch && SB.url && SB.anonKey) fr.addEventListener('submit', function () {
    if (!fr.checkValidity()) return;
    var E = fr.elements;
    var r = { p_n: E.n.value.trim(), p_p: +E.p.value, p_d: E.d.value, p_s: E.s.selectedIndex === 1 ? 'Comida' : 'Cena',
      p_h: E.h.value, p_x: E.x.value.trim(), p_tel: '', p_origen: 'Web' };
    fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/pedir_reserva', {
      method: 'POST', keepalive: true, body: JSON.stringify(r),
      headers: { 'Content-Type': 'application/json', apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey }
    }).catch(function () { /* sin conexión: queda el WhatsApp */ });
  });
})();
