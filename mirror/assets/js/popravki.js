/* Поправки (NS-H5CQ): behaviour fixes added on top of the original, minified scripts.
   Loaded after them on every page; each part only runs where its elements exist. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* 18. Homepage hero: the original hid the cursor and showed the lens anywhere over the
     full-screen scene (menu, headline, buttons). The model's real on-screen area is taken
     from the 3D room labels (.bel3d), which the original code pins to points inside the
     apartment and moves every frame. Cursor hidden + lens shown only over that area;
     the yellow glow follows it too. */
  const scena = $('#geroi-scena');
  const leshta = $('.geroi__leshta');
  if (scena) {
    setTimeout(() => scena.classList.add('kasno'), 8000); // show the photo only if the 3D is very late
    // the labels sit inside the floor; the model extends this far beyond them (calibrated)
    const PAD = { l: .33, r: .33, t: .45, b: .65 };
    const model = () => {
      const pts = $$('.bel3d', scena)
        .map((e) => [parseFloat(e.style.getPropertyValue('--x')), parseFloat(e.style.getPropertyValue('--y'))])
        .filter(([x, y]) => isFinite(x) && isFinite(y));
      if (pts.length < 3) return null;
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const [x, y] of pts) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
      const w = r - l, h = b - t, s = scena.getBoundingClientRect();
      l = s.left + l - w * PAD.l; r = s.left + r + w * PAD.r; t = s.top + t - h * PAD.t; b = s.top + b + h * PAD.b;
      return { cx: (l + r) / 2, cy: (t + b) / 2, hw: (r - l) / 2, hh: (b - t) / 2, s };
    };
    // the apartment is a diamond in a rectangle: use an ellipse so the empty corners do not count
    const onModel = (x, y) => {
      const m = model();
      if (!m) return false;
      const dx = (x - m.cx) / m.hw, dy = (y - m.cy) / m.hh;
      return dx * dx + dy * dy <= 1.2;
    };
    // window listener runs after the original one on the scene, so it gets the last word
    addEventListener('pointermove', (e) => {
      const inside = onModel(e.clientX, e.clientY);
      scena.classList.toggle('na-modela', inside);
      if (leshta) leshta.classList.toggle('van', !inside);
    }, { passive: true });
    scena.addEventListener('pointerleave', () => scena.classList.remove('na-modela'));
    // glow position/size follow the model
    let raf = 0;
    const glow = () => {
      raf = 0;
      const m = model();
      if (!m) return;
      const st = scena.style;
      st.setProperty('--gx', `${m.cx - m.s.left}px`);
      st.setProperty('--gy', `${m.cy - m.s.top}px`);
      st.setProperty('--gw', `${m.hw * 1.9}px`);
      st.setProperty('--gh', `${m.hh * 1.8}px`);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(glow); };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    setInterval(queue, 700); // the 3D code moves the model after loading and on resize
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
