/* Porta di Mare · asistente de reservas con IA.
   Habla con la función «chat» de Supabase (supabase/functions/chat), que usa Claude y guarda la petición
   en la base de datos; el panel la ve como «Por confirmar».
   Mientras supabase-config.js esté vacío, el asistente sale apagado: avisa de que no funciona y da el teléfono. */
(function () {
  'use strict';
  var SB = window.PDM_SUPABASE || {};
  var ACTIVO = !!(SB.url && SB.anonKey && window.fetch);
  var URL_CHAT = ACTIVO ? SB.url.replace(/\/$/, '') + '/functions/v1/chat' : '';
  var CLAVE = 'pdm-chat';

  var T = {
    es: { lanza: 'Reservar con el asistente', titulo: 'Asistente', sub: 'Reservas · Porta di Mare', cerrar: 'Cerrar el asistente',
      hola: '¡Hola! Soy el asistente de Porta di Mare. Te ayudo a pedir mesa o a resolver dudas sobre la carta y el horario. ¿Para qué día y cuántas personas?',
      atajos: ['Quiero reservar mesa', '¿Qué horario tenéis?', '¿Hay masa sin gluten?'], ph: 'Escribe tu mensaje…', enviar: 'Enviar',
      nota: 'Asistente con IA: puede equivocarse. La mesa queda confirmada cuando te escribimos o llamamos.',
      error: 'Ahora mismo no puedo responder. Llámanos al 633 45 06 54 o escríbenos por WhatsApp.', ticket: 'Petición enviada',
      tticket: 'Te confirmamos la mesa por teléfono o WhatsApp.', pax: 'personas', alt: 'O resérvalo hablando con el asistente',
      apagado: ['Actualmente no funciono. Si necesitas más información, llama al ', '.'], wa: 'Hola Porta di Mare, quiero reservar:',
      dias: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] },
    ca: { lanza: 'Reservar amb l’assistent', titulo: 'Assistent', sub: 'Reserves · Porta di Mare', cerrar: 'Tancar l’assistent',
      hola: 'Hola! Sóc l’assistent de Porta di Mare. T’ajudo a demanar taula o amb dubtes sobre la carta i l’horari. Per a quin dia i quantes persones?',
      atajos: ['Vull reservar taula', 'Quin horari teniu?', 'Hi ha massa sense gluten?'], ph: 'Escriu el teu missatge…', enviar: 'Enviar',
      nota: 'Assistent amb IA: es pot equivocar. La taula queda confirmada quan t’escrivim o et truquem.',
      error: 'Ara mateix no puc respondre. Truca’ns al 633 45 06 54 o escriu-nos per WhatsApp.', ticket: 'Petició enviada',
      tticket: 'Et confirmem la taula per telèfon o WhatsApp.', pax: 'persones', alt: 'O reserva parlant amb l’assistent',
      apagado: ['Ara mateix no funciono. Si necessites més informació, truca al ', '.'], wa: 'Hola Porta di Mare, vull reservar:',
      dias: ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'] },
    en: { lanza: 'Book with the assistant', titulo: 'Assistant', sub: 'Bookings · Porta di Mare', cerrar: 'Close the assistant',
      hola: 'Hi! I’m the Porta di Mare assistant. I can help you request a table or answer questions about the menu and opening hours. Which day, and how many people?',
      atajos: ['I’d like to book a table', 'What are your hours?', 'Do you have gluten-free dough?'], ph: 'Type your message…', enviar: 'Send',
      nota: 'AI assistant: it can make mistakes. Your table is confirmed once we message or call you.',
      error: 'I can’t reply right now. Call us on +34 633 45 06 54 or message us on WhatsApp.', ticket: 'Request sent',
      tticket: 'We’ll confirm your table by phone or WhatsApp.', pax: 'people', alt: 'Or book by chatting with the assistant',
      apagado: ['I’m not working at the moment. For more information, call ', '.'], wa: 'Hi Porta di Mare, I would like to book:',
      dias: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] }
  };
  function t() { var l = document.documentElement.lang; return T[l] || T.es; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  /* La conversación se guarda en la pestaña: si recargas, sigue ahí */
  var hilo = [];        // { role: 'user'|'assistant', content, reserva? }
  try { hilo = JSON.parse(sessionStorage.getItem(CLAVE) || '[]'); if (!Array.isArray(hilo)) hilo = []; } catch (e) { hilo = []; }
  function guarda() { try { sessionStorage.setItem(CLAVE, JSON.stringify(hilo.slice(-40))); } catch (e) { /* sin almacenamiento */ } }

  /* ——— Piezas ——— */
  var lanza = el('button', 'chat-lanza');
  lanza.type = 'button'; lanza.setAttribute('aria-expanded', 'false'); lanza.setAttribute('aria-controls', 'chat');
  lanza.appendChild(el('span', 'mascara medallon-mask')).setAttribute('aria-hidden', 'true');
  var lanzaT = lanza.appendChild(el('span'));

  var caja = el('section', 'chat'); caja.id = 'chat'; caja.hidden = true;
  caja.setAttribute('role', 'dialog'); caja.setAttribute('aria-labelledby', 'chat-t');
  var cab = caja.appendChild(el('div', 'chat-cab'));
  cab.appendChild(el('span', 'mascara medallon-mask')).setAttribute('aria-hidden', 'true');
  var cabT = cab.appendChild(el('div', 'chat-cab-t'));
  var titulo = cabT.appendChild(el('b')); titulo.id = 'chat-t';
  var sub = cabT.appendChild(el('span'));
  var cerrar = cab.appendChild(el('button', 'chat-cerrar'));
  cerrar.type = 'button';
  cerrar.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
  var lista = caja.appendChild(el('div', 'chat-hilo')); lista.setAttribute('aria-live', 'polite');
  var atajos = caja.appendChild(el('div', 'chat-atajos'));
  var form = caja.appendChild(el('form', 'chat-form'));
  var campo = form.appendChild(el('textarea')); campo.rows = 1; campo.maxLength = 1000; campo.name = 'm';
  var enviar = form.appendChild(el('button')); enviar.type = 'submit';
  var nota = caja.appendChild(el('p', 'chat-nota'));
  document.body.appendChild(lanza); document.body.appendChild(caja);

  /* El botón alternativo junto al formulario de reserva */
  var alt = ACTIVO ? document.querySelector('[data-abrir-chat]') : null;
  if (alt) alt.hidden = false;
  /* Apagado: sin campo para escribir ni atajos, solo el aviso */
  if (!ACTIVO) { form.hidden = true; nota.hidden = true; caja.classList.add('apagado'); }

  function textos() {
    var x = t();
    lanzaT.textContent = x.lanza; titulo.textContent = x.titulo; sub.textContent = x.sub;
    cerrar.setAttribute('aria-label', x.cerrar); campo.placeholder = x.ph; campo.setAttribute('aria-label', x.ph);
    enviar.textContent = x.enviar; nota.textContent = x.nota;
    if (alt) alt.textContent = x.alt;
    atajos.textContent = '';
    x.atajos.forEach(function (a) { var b = atajos.appendChild(el('button', null, a)); b.type = 'button'; b.dataset.atajo = a; });
    atajos.hidden = !ACTIVO || hilo.some(function (m) { return m.role === 'user'; });
  }
  textos();
  /* Al cambiar de idioma en la web, el asistente cambia también */
  new MutationObserver(function () { textos(); if (!ACTIVO || !hilo.length) pinta(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  function ticket(r) {
    var x = t(), d = new Date(r.dia + 'T12:00:00');
    var c = el('div', 'chat-ticket');
    c.appendChild(el('b', null, x.ticket));
    c.appendChild(el('p', null, x.dias[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1) + ' · ' + r.hora + ' · ' + r.personas + ' ' + x.pax + ' · ' + r.nombre));
    c.appendChild(el('span', null, x.tticket));
    return c;
  }
  function burbuja(m) {
    var b = el('div', 'chat-msg ' + (m.role === 'user' ? 'yo' : 'ia') + (m.error ? ' error' : ''), m.content);
    lista.appendChild(b);
    if (m.reserva) lista.appendChild(ticket(m.reserva));
  }
  function pinta() {
    lista.textContent = '';
    if (!ACTIVO) {
      var x = t(), b = el('div', 'chat-msg ia');
      var a = el('a', null, '633 45 06 54');
      a.href = 'https://wa.me/34633450654?text=' + encodeURIComponent(x.wa);
      a.target = '_blank'; a.rel = 'noopener';
      b.appendChild(document.createTextNode(x.apagado[0])); b.appendChild(a); b.appendChild(document.createTextNode(x.apagado[1]));
      lista.appendChild(b);
      return;
    }
    burbuja({ role: 'assistant', content: t().hola });
    hilo.forEach(burbuja);
    lista.scrollTop = lista.scrollHeight;
  }

  /* ——— Abrir y cerrar ——— */
  function abrir() {
    textos(); pinta();
    caja.hidden = false; lanza.setAttribute('aria-expanded', 'true');
    setTimeout(function () { (ACTIVO ? campo : cerrar).focus(); }, 30);
  }
  function cierra() { caja.hidden = true; lanza.setAttribute('aria-expanded', 'false'); lanza.focus(); }
  lanza.addEventListener('click', abrir);
  if (alt) alt.addEventListener('click', abrir);
  cerrar.addEventListener('click', cierra);
  caja.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') cierra(); });

  /* ——— Hablar ——— */
  var ocupado = false;
  function manda(texto) {
    texto = (texto || '').trim();
    if (!texto || ocupado) return;
    ocupado = true; enviar.disabled = true; atajos.hidden = true;
    hilo.push({ role: 'user', content: texto }); guarda();
    burbuja(hilo[hilo.length - 1]);
    campo.value = ''; ajusta();
    var esc = lista.appendChild(el('div', 'chat-escribe'));
    esc.innerHTML = '<i></i><i></i><i></i>';
    lista.scrollTop = lista.scrollHeight;

    var mensajes = hilo.filter(function (m) { return !m.error; }).map(function (m) { return { role: m.role, content: m.content }; });
    fetch(URL_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey },
      body: JSON.stringify({ messages: mensajes })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok || !j.reply) throw new Error(j.error || 'Error'); return j; });
    }).then(function (j) {
      hilo.push({ role: 'assistant', content: j.reply, reserva: j.reserva || null });
    }, function () {
      hilo.push({ role: 'assistant', content: t().error, error: true });
    }).then(function () {
      guarda(); esc.remove(); burbuja(hilo[hilo.length - 1]);
      lista.scrollTop = lista.scrollHeight;
      ocupado = false; enviar.disabled = false; campo.focus();
    });
  }
  form.addEventListener('submit', function (ev) { ev.preventDefault(); manda(campo.value); });
  campo.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); manda(campo.value); }
  });
  function ajusta() { campo.style.height = 'auto'; campo.style.height = Math.min(campo.scrollHeight, 120) + 'px'; }
  campo.addEventListener('input', ajusta);
  atajos.addEventListener('click', function (ev) { var b = ev.target.closest('[data-atajo]'); if (b) manda(b.dataset.atajo); });
})();
