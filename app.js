/* Funciones comunes de las webs de prospección.
   - Horario: <body data-horario='{"1":[["9:00","14:00"]], ...}'>  (0 = domingo)
     · [data-abierto] muestra si está abierto ahora
     · tr[data-dia] marca el día de hoy
   - Galería: [data-galeria] img abre un visor
   - Menú móvil: [data-menu-btn] abre/cierra [data-menu]
   - Formularios a WhatsApp: <form data-wa="34600000000" data-intro="Hola, ...">
*/
(function () {
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function min(h) { var p = h.split(':'); return (+p[0]) * 60 + (+p[1]); }

  function estado(horario, ahora) {
    var d = ahora.getDay(), m = ahora.getHours() * 60 + ahora.getMinutes();
    var hoy = horario[d] || [];
    for (var i = 0; i < hoy.length; i++) {
      if (m >= min(hoy[i][0]) && m < min(hoy[i][1])) return { abierto: true, texto: 'Abierto ahora · cierra a las ' + hoy[i][1] };
    }
    for (var k = 0; k < 8; k++) {
      var dd = (d + k) % 7, tramos = horario[dd] || [];
      for (var j = 0; j < tramos.length; j++) {
        if (k === 0 && min(tramos[j][0]) <= m) continue;
        var cuando = k === 0 ? 'hoy' : k === 1 ? 'mañana' : 'el ' + DIAS[dd];
        return { abierto: false, texto: 'Cerrado ahora · abre ' + cuando + ' a las ' + tramos[j][0] };
      }
    }
    return { abierto: false, texto: 'Consulta el horario' };
  }

  var raw = document.body.getAttribute('data-horario');
  if (raw) {
    try {
      var h = JSON.parse(raw), e = estado(h, new Date());
      document.querySelectorAll('[data-abierto]').forEach(function (el) {
        el.textContent = e.texto;
        el.classList.add(e.abierto ? 'esta-abierto' : 'esta-cerrado');
      });
      var hoy = new Date().getDay();
      document.querySelectorAll('tr[data-dia]').forEach(function (tr) {
        if (tr.getAttribute('data-dia').split(',').indexOf(String(hoy)) > -1) {
          tr.classList.add('hoy');
          tr.setAttribute('aria-current', 'date');
        }
      });
    } catch (err) { /* horario mal formado: no se muestra el estado */ }
  }

  /* Menú móvil */
  var btn = document.querySelector('[data-menu-btn]'), menu = document.querySelector('[data-menu]');
  if (btn && menu) {
    btn.addEventListener('click', function () {
      var abierto = menu.classList.toggle('abierto');
      btn.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.classList.remove('abierto'); btn.setAttribute('aria-expanded', 'false'); });
    });
  }

  /* Visor de fotos */
  var imgs = Array.prototype.slice.call(document.querySelectorAll('[data-galeria] img'));
  if (imgs.length) {
    var dlg = document.createElement('dialog');
    dlg.className = 'visor';
    dlg.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button class="visor-ant" aria-label="Foto anterior"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2"/></svg></button>' +
      '<button class="visor-sig" aria-label="Foto siguiente"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.2"/></svg></button>' +
      '<button class="visor-cerrar" aria-label="Cerrar"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2.2"/></svg></button>';
    document.body.appendChild(dlg);
    var actual = 0, vImg = dlg.querySelector('img'), vCap = dlg.querySelector('figcaption');
    function ver(i) {
      actual = (i + imgs.length) % imgs.length;
      vImg.src = imgs[actual].currentSrc || imgs[actual].src;
      vImg.alt = imgs[actual].alt;
      vCap.textContent = imgs[actual].alt;
    }
    imgs.forEach(function (im, i) {
      im.tabIndex = 0;
      im.setAttribute('role', 'button');
      im.addEventListener('click', function () { ver(i); dlg.showModal(); });
      im.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ver(i); dlg.showModal(); } });
    });
    dlg.querySelector('.visor-ant').addEventListener('click', function () { ver(actual - 1); });
    dlg.querySelector('.visor-sig').addEventListener('click', function () { ver(actual + 1); });
    dlg.querySelector('.visor-cerrar').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft') ver(actual - 1);
      if (ev.key === 'ArrowRight') ver(actual + 1);
    });
  }

  /* Formularios para teléfono fijo: <form data-tel="+34937000000">
     Muestran el pedido resumido y un botón para llamar. */
  document.querySelectorAll('form[data-tel]').forEach(function (f) {
    var caja = document.createElement('div');
    caja.className = 'resumen-pedido';
    caja.setAttribute('role', 'status');
    caja.hidden = true;
    f.appendChild(caja);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!f.reportValidity()) return;
      var items = [];
      f.querySelectorAll('[name]').forEach(function (c) {
        if ((c.type === 'checkbox' || c.type === 'radio') && !c.checked) return;
        if (!c.value) return;
        items.push('<li><b>' + (c.getAttribute('data-etiqueta') || c.name) + ':</b> ' + c.value.replace(/</g, '&lt;') + '</li>');
      });
      var tel = f.getAttribute('data-tel');
      caja.innerHTML = '<p>' + (f.getAttribute('data-msg') || 'Tu pedido está listo. Llámanos y léenoslo:') + '</p><ul>' + items.join('') + '</ul>' +
        '<a class="llamar-pedido" href="tel:' + tel + '">' + (f.getAttribute('data-msg-boton') || 'Llamar ahora') + '</a>';
      caja.hidden = false;
      caja.scrollIntoView({ block: 'nearest' });
    });
  });

  /* Formularios que abren WhatsApp con el mensaje ya escrito */
  document.querySelectorAll('form[data-wa]').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!f.reportValidity()) return;
      var lineas = [f.getAttribute('data-intro') || 'Hola:'];
      f.querySelectorAll('[name]').forEach(function (c) {
        if ((c.type === 'checkbox' || c.type === 'radio') && !c.checked) return;
        if (!c.value) return;
        var etiqueta = c.getAttribute('data-etiqueta') || c.name;
        lineas.push('· ' + etiqueta + ': ' + c.value);
      });
      window.open('https://wa.me/' + f.getAttribute('data-wa') + '?text=' + encodeURIComponent(lineas.join('\n')), '_blank', 'noopener');
    });
  });
})();
