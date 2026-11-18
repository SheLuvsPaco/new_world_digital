/* Поправки (NS-H5CQ): behaviour fixes added on top of the original, minified scripts.
   Loaded after them on every page; each part only runs where its elements exist. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* 18. Homepage lens: the original shows it anywhere over the full-screen hero scene,
     including over the menu, the text and the buttons. Hide it outside the model area. */
  const scena = $('#geroi-scena');
  const leshta = $('.geroi__leshta');
  if (scena && leshta) {
    const poster = $('.geroi__poster', scena);
    const ratio = 4 / 3; // the model is framed like the 2048x1536 poster (object-fit: contain)
    const box = () => {
      const r = (poster || scena).getBoundingClientRect();
      let w = r.width, h = r.height;
      if (w / h > ratio) w = h * ratio; else h = w / ratio;
      return { l: r.left + (r.width - w) / 2, t: r.top + (r.height - h) / 2, r: r.left + (r.width + w) / 2, b: r.top + (r.height + h) / 2 };
    };
    // window listener runs after the original one on the scene, so it gets the last word
    addEventListener('pointermove', (e) => {
      if (!leshta.classList.contains('vidima')) return;
      const b = box();
      const inside = e.clientX > b.l && e.clientX < b.r && e.clientY > b.t && e.clientY < b.b;
      leshta.classList.toggle('van', !inside);
    }, { passive: true });
  }

  /* 20. Paint roller on the right: looks like a scroll handle but only jumped to the top
     on click. Dragging it now scrolls the page; a plain click still goes to the top. */
  const ryb = $('.ryb');
  const valyak = $('.ryb__valyak');
  if (ryb && valyak) {
    let drag = false, moved = false, startY = 0;
    valyak.setAttribute('aria-label', 'Нагоре');
    valyak.title = 'Влачете, за да превъртите, или натиснете за начало';
    valyak.addEventListener('pointerdown', (e) => {
      drag = true; moved = false; startY = e.clientY;
      valyak.setPointerCapture(e.pointerId);
      valyak.classList.add('vlachi');
      e.preventDefault();
    });
    valyak.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (Math.abs(e.clientY - startY) > 3) moved = true;
      if (!moved) return;
      const r = ryb.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      window.scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight));
    });
    const stop = () => { drag = false; valyak.classList.remove('vlachi'); };
    valyak.addEventListener('pointerup', stop);
    valyak.addEventListener('pointercancel', stop);
    // swallow the click that ends a drag so the original "go to top" handler does not fire
    valyak.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopImmediatePropagation(); moved = false; } }, true);
  }

  /* 21. Contact form: the red messages were not tied to their fields, so screen readers
     did not announce them. Link each message to its field while the field is in error. */
  const forma = $('[data-forma]');
  if (forma) {
    $$('.pole', forma).forEach((pole, i) => {
      const field = $('input, textarea', pole);
      const zab = $('.zab', pole);
      if (!field || !zab) return;
      zab.id = zab.id || `zab-${field.id || i}`;
      const sync = () => {
        const bad = pole.classList.contains('greshno');
        field.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad) field.setAttribute('aria-describedby', zab.id); else field.removeAttribute('aria-describedby');
      };
      new MutationObserver(sync).observe(pole, { attributes: true, attributeFilter: ['class'] });
      sync();
    });
    const saglasie = $('input[name="saglasie"]', forma);
    const zabS = $('.zab-saglasie', forma);
    if (saglasie && zabS) {
      zabS.id = zabS.id || 'zab-saglasie';
      new MutationObserver(() => {
        const bad = !zabS.hidden;
        saglasie.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad) saglasie.setAttribute('aria-describedby', zabS.id); else saglasie.removeAttribute('aria-describedby');
      }).observe(zabS, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  /* 22. Gallery viewer: keyboard focus stayed on the page behind the open photo.
     Move focus into the viewer, keep Tab inside it, make the page behind inert,
     and return focus to the photo that opened it. */
  const watchViewer = (uvel) => {
    let back = null;
    const behind = () => $$('body > *').filter((el) => el !== uvel && el.tagName !== 'SCRIPT');
    const opened = () => uvel.classList.contains('otvoreno');
    new MutationObserver(() => {
      if (opened()) {
        if (!back) back = document.activeElement;
        behind().forEach((el) => el.setAttribute('inert', ''));
        // the viewer fades in; an invisible button cannot take focus yet, so retry briefly
        const target = $('.uvel__zatv', uvel) || uvel;
        let tries = 0;
        const focusIt = () => { target.focus(); if (document.activeElement !== target && tries++ < 15) setTimeout(focusIt, 40); };
        focusIt();
      } else {
        behind().forEach((el) => el.removeAttribute('inert'));
        if (back && back.focus) back.focus();
        back = null;
      }
    }).observe(uvel, { attributes: true, attributeFilter: ['class'] });
    uvel.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !opened()) return;
      const items = $$('button', uvel);
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    });
  };
  const ready = $('.uvel');
  if (ready) watchViewer(ready);
  else if ($('[data-galeriya]')) {
    // the viewer is created by the original script; wait for it
    const mo = new MutationObserver(() => { const u = $('.uvel'); if (u) { mo.disconnect(); watchViewer(u); } });
    mo.observe(document.body, { childList: true });
  }
})();
