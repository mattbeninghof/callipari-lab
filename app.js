/* Callipari Lab: views and interaction. Depends on engine.js (window.Engine). */
(function () {
  'use strict';
  const E = window.Engine;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const main = $('#main');
  const NS = 'http://www.w3.org/2000/svg';
  const FIFTHS = Array.from({ length: 12 }, (_, i) => (i * 7) % 12);
  const famVar = (f) => `var(--${f === 'other' ? 'muted' : f})`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Remembered per-viewer settings. Storage can be unavailable; everything still works without it.
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cl:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cl:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 1800);
  }

  const fromId = (id) => { const [r, q] = id.split(':'); return E.chord(+r, q); };
  const noteNames = (c) => c.pcs.map((p) => E.name(p)).join(' ');

  function pill(c, opts = {}) {
    const seq = opts.seq ? ` data-seq="${opts.seq}"` : '';
    const small = opts.small != null ? `<small>${esc(opts.small)}</small>` : '';
    return `<button class="chordpill f-${c.family}" data-chord="${c.id}"${seq} title="${esc(c.name + ': ' + noteNames(c))}">${esc(c.name)}${small}</button>`;
  }

  function rootSelect(id, value) {
    return `<select id="${id}" aria-label="Root">${E.BOOK.map((n, i) => `<option value="${i}"${i === +value ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
  }
  function qualSelect(id, value, list = ['maj', 'min', 'dim', 'aug', 'dom7']) {
    return `<select id="${id}" aria-label="Chord type">${list.map((q) => `<option value="${q}"${q === value ? ' selected' : ''}>${E.QUALITIES[q].label}</option>`).join('')}</select>`;
  }
  function seg(name, options, value) {
    return `<div class="seg" role="group" aria-label="${esc(name)}">${options.map(([v, l]) => `<button class="chip" data-seg="${name}" data-v="${v}" aria-pressed="${v === value}">${l}</button>`).join('')}</div>`;
  }

  const legend = `<div class="legend">
    <span class="f-maj"><i></i>Major</span><span class="f-min"><i></i>Minor</span>
    <span class="f-dom"><i></i>Dominant</span><span class="f-dim"><i></i>Diminished</span>
    <span class="f-aug"><i></i>Augmented</span></div>`;

  // Global audio delegation: any element with data-chord plays; data-seq plays a sequence of ids.
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-chord],[data-seq]');
    if (!el || el.closest('svg') && !el.matches('.node')) return;
    if (!E.audioOk()) { toast('Audio is not available in this browser'); return; }
    if (el.dataset.seq) E.playSequence(el.dataset.seq.split(' ').map(fromId), { gap: +(el.dataset.gap || 0.85) });
    else E.playChord(fromId(el.dataset.chord));
    const ring = el.querySelector('circle,rect');
    if (ring) { ring.classList.remove('pulse'); void ring.getBoundingClientRect(); ring.classList.add('pulse'); }
  });

  /* ---------- SVG helpers ---------- */
  function polar(cx, cy, r, deg) {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function svgNode(c, x, y, r = 22, extra = '') {
    const fs = c.name.length > 3 ? 11 : c.name.length > 2 ? 13 : 15;
    return `<g class="node" tabindex="0" role="button" aria-label="${esc(c.name)}" data-chord="${c.id}" ${extra}>
      <circle cx="${x}" cy="${y}" r="${r}" fill="#0a0a0c" stroke="${famVar(c.family)}" stroke-width="2"/>
      <text x="${x}" y="${y + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${famVar(c.family)}">${esc(c.name)}</text></g>`;
  }
  // Line between two circles, trimmed to their edges, optionally with an arrowhead.
  function link(x1, y1, x2, y2, { r1 = 22, r2 = 22, cls = 'edge', arrow = false, bend = 0 } = {}) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const ax = x1 + ux * (r1 + 3), ay = y1 + uy * (r1 + 3);
    const bx = x2 - ux * (r2 + (arrow ? 6 : 3)), by = y2 - uy * (r2 + (arrow ? 6 : 3));
    const mx = (ax + bx) / 2 - uy * bend, my = (ay + by) / 2 + ux * bend;
    return `<path class="${cls}" d="M${ax.toFixed(1)},${ay.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}"${arrow ? ' marker-end="url(#arr)"' : ''}/>`;
  }
  const defs = `<defs><marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="rgba(255,255,255,.75)"/></marker>
    <marker id="arrh" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="#8be05a"/></marker></defs>`;
  const cross = (cx, cy) => `<path d="M${cx - 9},${cy} H${cx + 9} M${cx},${cy - 9} V${cy + 9}" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>`;

  // Keyboard activation for SVG nodes.
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.node')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });

  /* ---------- Spot illustrations (hand-drawn style) ---------- */
  const ART = {
    wheel: `<svg viewBox="0 0 360 360" aria-hidden="true" class="art-wheel">
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M180 22c88 -2 158 70 157 158c1 86 -70 158 -158 157c-87 1 -158 -71 -157 -158C21 92 93 24 180 22z" stroke="#c9a77a" stroke-width="2.4" fill="#17140f"/>
        <path d="M180 48c73 0 132 58 131 132c1 73 -59 133 -132 131c-72 1 -131 -58 -131 -132c0 -72 59 -131 132 -131z" stroke="#6b5a42" stroke-width="1.2" stroke-dasharray="2 6"/>
        ${FIFTHS.map((pc, i) => { const [x, y] = polar(180, 180, 112, i * 30); const f = ['maj', 'min', 'dom', 'dim', 'aug'][i % 5]; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17" stroke="var(--${f})" stroke-width="2.2" fill="#0d0c0a"/><text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--${f})" stroke="none">${E.BOOK[pc]}</text>`; }).join('')}
        <path d="M180 180 L180 82" stroke="#8be05a" stroke-width="2.6"/>
        <path d="M171 96 L180 80 L190 95" stroke="#8be05a" stroke-width="2.6"/>
        <path d="M160 170c-14 -16 -26 -8 -24 4c2 10 14 12 24 4M200 170c14 -16 26 -8 24 4c-2 10 -14 12 -24 4M163 190c-10 12 -2 22 8 18M197 190c10 12 2 22 -8 18" stroke="#d8c09a" stroke-width="2"/>
        <circle cx="180" cy="180" r="9" fill="#d8c09a" stroke="#8a7350" stroke-width="2"/>
        <path d="M278 300c14 10 30 12 44 4" stroke="#8be05a" stroke-width="2" stroke-dasharray="1 5"/>
        <path d="M60 318c-6 -10 -2 -20 6 -24" stroke="#c9a77a" stroke-width="1.6"/>
      </g></svg>`,
    harmony: `<svg viewBox="0 0 80 54" aria-hidden="true" fill="none" stroke-linecap="round"><circle cx="18" cy="27" r="11" stroke="var(--maj)" stroke-width="2"/><circle cx="60" cy="14" r="9" stroke="var(--dom)" stroke-width="2"/><circle cx="60" cy="40" r="9" stroke="var(--min)" stroke-width="2"/><path d="M50 16 L31 24M50 38 L31 30" stroke="#fff" stroke-width="1.4"/><path d="M35 20 L30 24 L36 27" stroke="#fff" stroke-width="1.4"/></svg>`,
    stairs: `<svg viewBox="0 0 80 54" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 48 H22 V38 H36 V28 H50 V18 H64 V8 H76" stroke="#fff" stroke-width="1.8"/><circle cx="14" cy="42" r="4" stroke="var(--maj)" stroke-width="2"/><circle cx="43" cy="22" r="4" stroke="var(--min)" stroke-width="2"/><circle cx="70" cy="3" r="2.5" fill="var(--hand)" stroke="none"/><path d="M20 30c8 -10 14 -14 22 -16" stroke="var(--hand)" stroke-width="1.6" stroke-dasharray="2 4"/></svg>`,
    squares: `<svg viewBox="0 0 80 54" aria-hidden="true" fill="none"><rect x="4" y="18" width="16" height="16" rx="3" stroke="#fff" stroke-width="1.8"/><rect x="32" y="12" width="16" height="16" rx="3" fill="#e9e9ee" stroke="#fff" stroke-width="1.8"/><rect x="60" y="22" width="16" height="16" rx="3" fill="#26262c" stroke="#77777f" stroke-width="1.8"/><text x="26" y="44" font-size="9" fill="var(--muted)" font-family="monospace">1</text><text x="52" y="46" font-size="9" fill="var(--maj)" font-family="monospace">½</text></svg>`,
    waves: `<svg viewBox="0 0 80 54" aria-hidden="true" fill="none" stroke-linecap="round"><path d="M2 27c6 -14 12 -14 18 0s12 14 18 0 12 -14 18 0 12 14 18 0" stroke="var(--dom)" stroke-width="2"/><path d="M2 27c3 -8 6 -8 9 0s6 8 9 0 6 -8 9 0 6 8 9 0 6 -8 9 0 6 8 9 0 6 -8 9 0 6 8 9 0" stroke="var(--min)" stroke-width="1.4" opacity=".8"/><circle cx="72" cy="10" r="4" stroke="var(--hand)" stroke-width="1.8"/></svg>`,
    voices: `<svg viewBox="0 0 80 54" aria-hidden="true" fill="none" stroke-linecap="round" stroke-width="2"><path d="M4 10 C20 4 30 16 44 8 S70 6 76 12" stroke="var(--dom)"/><path d="M4 22 C18 26 32 18 48 22 S68 26 76 22" stroke="var(--aug)"/><path d="M4 34 C22 30 34 38 50 32 S68 30 76 34" stroke="var(--min)"/><path d="M4 48 C16 48 22 42 36 44 S62 50 76 46" stroke="var(--maj)"/></svg>`,
    guitar: `<svg viewBox="0 0 160 120" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M38 70c-16 -6 -26 8 -20 22c6 14 26 18 38 10c8 -6 10 -2 18 0c12 2 20 -10 14 -20c-4 -8 -12 -8 -16 -6c-6 2 -6 -4 -2 -8c6 -8 -2 -18 -12 -14c-8 4 -10 10 -20 16z" stroke="#c9a77a" stroke-width="2" fill="#17140f"/><circle cx="52" cy="84" r="7" stroke="#6b5a42" stroke-width="1.6"/><path d="M62 72 L132 22" stroke="#c9a77a" stroke-width="5"/><path d="M128 18l12 -8 6 6 -9 11z" stroke="#c9a77a" stroke-width="2"/><path d="M64 76 L134 26M60 70 L130 20" stroke="#fff" stroke-width=".6" opacity=".6"/><path d="M98 92c10 -2 18 2 22 10" stroke="var(--hand)" stroke-width="1.6" stroke-dasharray="2 5"/><circle cx="124" cy="106" r="5" stroke="var(--maj)" stroke-width="1.8"/></svg>`,
    lion: `<svg viewBox="0 0 160 120" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="80" cy="58" r="36" stroke="var(--dom)" stroke-width="2" stroke-dasharray="4 5"/><circle cx="80" cy="60" r="20" stroke="#d8c09a" stroke-width="2" fill="#17140f"/><circle cx="73" cy="56" r="1.8" fill="#d8c09a"/><circle cx="87" cy="56" r="1.8" fill="#d8c09a"/><path d="M76 66c2 3 6 3 8 0" stroke="#d8c09a" stroke-width="1.6"/><path d="M30 104c30 -8 70 -8 100 0" stroke="var(--hand)" stroke-width="1.6" stroke-dasharray="2 5"/></svg>`,
  };

  /* ---------- Views ---------- */
  const VIEWS = {};

  VIEWS.home = () => {
    const books = [
      ['Volume 1', 'Illustrated Harmony', 'Circles of fifths, chains of dominants and a near-to-far ladder of every chord.', 'harmony', '#/circle', 'Open the Mandala'],
      ['Volume 2', 'Illustrated Harmony 2', 'Neo-Riemannian moves, the Magic Glue Index and Bartók axes.', 'stairs', '#/plr', 'Grow the PLR tree'],
      ['Scales', 'Illustrated Modes', 'Fourteen modes on one map, linked when they differ by a single note.', 'squares', '#/modes', 'Explore the Modal Map'],
      ['Color', 'Illustrated Chord Extensions', 'Which 9ths, 11ths and 13ths each chord can wear, plus polychords and harmonics.', 'waves', '#/extensions', 'Try the Extension Board'],
      ['Voices', 'Arrangements Illustrated', 'From block chords to four independent lines, with a rule checker.', 'voices', '#/voices', 'Open Four Voices'],
    ];
    return `<section class="view">
      <div class="hero">
        <div class="stack">
          <span class="kicker">A playable companion</span>
          <h1>Follow the arrows. Hear the chords.</h1>
          <p class="lede">Brian Callipari's books turn harmony into diagrams: colored circles, arrows and squares you can read like a map. Callipari Lab makes those maps <em>playable</em>. Click any chord to hear it, rotate the circle to change key, and build your own connections.</p>
          <div class="row"><a class="btn primary" href="#/circle">Start with the circle</a><a class="btn" href="#/proximity">Near and far from C</a></div>
        </div>
        ${ART.wheel}
      </div>
      <div class="card tight">${legend}</div>
      <div class="books">${books.map(([vol, t, d, art, href, go]) => `<a class="book" href="${href}">${ART[art]}<span class="vol">${vol}</span><h3>${t}</h3><p>${d}</p><span class="go">${go} →</span></a>`).join('')}</div>
      <div class="card"><div class="stack">
        <h3>The Magic Glue</h3>
        <p class="sub">The idea behind all five books: any chord can follow any other if the melody holds them together. Lean on the notes two chords share, move the rest by small steps, and the strangest pairs start to make sense. Try it: loop two chords that have nothing in common and hum over them.</p>
        <div class="row">${pill(E.chord(0, 'min'), { seq: '0:min 8:min 0:min 8:min' })}<span class="arrow">⇄</span>${pill(E.chord(8, 'min'), { seq: '0:min 8:min 0:min 8:min' })}<span class="sub">Cm ⇄ Abm, played as a loop</span></div>
      </div></div>
    </section>`;
  };

  /* Circle (Mandala) */
  VIEWS.circle = () => {
    const st = { layer: store.get('circle.layer', 'keys'), home: store.get('circle.home', 0), sel: null };
    const html = `<section class="view">
      <div class="head"><span class="kicker">Illustrated Harmony · The circle</span><h2>The Mandala</h2>
      <p class="lede">The rotating cardboard circle, rebuilt. Roots are spaced by fifths; the chord types change with each layer. Turn the home key and everything transposes.</p></div>
      <div class="card tight row between">${seg('layer', [['keys', 'Keys'], ['dominants', 'Chain of dominants'], ['tritone', 'Tritone subs'], ['dim', 'Dim axes'], ['aug', 'Aug cycles']], st.layer)}
        <label class="field">Home at the top ${rootSelect('home', st.home)}</label></div>
      <div class="grid2"><div class="card"><svg id="mandala" class="diagram" viewBox="0 0 640 640" role="img" aria-label="Circle diagram"></svg>${legend}</div>
      <div class="stack" id="side"></div></div></section>`;
    return { html, mount: (root) => {
      const draw = () => {
        const cx = 320, cy = 320;
        const ang = (pc) => (((pc - st.home) * 7) % 12 + 12) % 12 * 30;
        let s = defs + cross(cx, cy);
        let nodes = '';
        const L = st.layer;
        if (L === 'keys') {
          for (let pc = 0; pc < 12; pc++) {
            const a = ang(pc);
            const [x1, y1] = polar(cx, cy, 160, a), [x2, y2] = polar(cx, cy, 255, a);
            s += link(x1, y1, x2, y2, { cls: 'edge dotted', r1: 24, r2: 24 });
            nodes += svgNode(E.chord(pc, 'maj'), x1, y1, 24) + svgNode(E.chord(pc + 9, 'min'), x2, y2, 24);
            const [x3, y3] = polar(cx, cy, 160, a + 30);
            s += link(x1, y1, x3, y3, { r1: 24, r2: 24, bend: -10 });
          }
        } else if (L === 'dominants') {
          for (let pc = 0; pc < 12; pc++) {
            const a = ang(pc);
            const [dx, dy] = polar(cx, cy, 255, a);
            const [tx, ty] = polar(cx, cy, 165, ang(pc + 5) + 15);
            const [nx, ny] = polar(cx, cy, 255, ang(pc + 5));
            s += link(dx, dy, tx, ty, { arrow: true, r1: 24, r2: 22 });
            s += link(dx, dy, nx, ny, { arrow: true, r1: 24, r2: 24, bend: 14, cls: 'edge' });
            nodes += svgNode(E.chord(pc, 'dom7'), dx, dy, 24);
            nodes += svgNode(E.chord(pc + 5, 'maj'), tx, ty, 22);
          }
        } else if (L === 'tritone') {
          for (let pc = 0; pc < 12; pc++) {
            const a = ang(pc);
            const [ix, iy] = polar(cx, cy, 160, a), [ox, oy] = polar(cx, cy, 262, a);
            s += link(ix, iy, ox, oy, { cls: 'edge hand', r1: 24, r2: 24 });
            nodes += svgNode(E.chord(pc, 'dom7'), ix, iy, 24) + svgNode(E.chord(pc + 6, 'dom7'), ox, oy, 24);
          }
        } else {
          const q = L === 'dim' ? 'dim7' : 'aug';
          const step = L === 'dim' ? 3 : 4;
          for (let k = 0; k < step; k++) {
            const members = Array.from({ length: 12 / step }, (_, i) => (st.home + k + i * step) % 12);
            const pts = members.map((pc) => polar(cx, cy, 225, ang(pc)));
            s += `<path class="edge" style="stroke:${famVar(L)};opacity:.45" d="M${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L')} Z"/>`;
          }
          for (let pc = 0; pc < 12; pc++) { const [x, y] = polar(cx, cy, 225, ang(pc)); nodes += svgNode(E.chord(pc, q), x, y, 25); }
        }
        $('#mandala', root).innerHTML = s + nodes;
        side();
      };
      const side = () => {
        const notes = {
          keys: ['Keys and their relatives', 'Inner ring: major chords spaced by fifths. Outer ring: each relative minor, joined by a dotted line. Neighbors share six of seven scale notes, which makes them easy keys to move between.'],
          dominants: ['Chain of dominants', 'Each yellow dominant points at the chord a fifth below and at the next dominant in the chain: G7 → C7 → F7… Follow the outer ring for a long, predictable fall; jump inward to land.'],
          tritone: ['Tritone substitutes', 'Opposite dominants hold the same tritone, so they can stand in for each other. G7 and Db7 both contain B and F; either one leads to C.'],
          dim: ['Diminished axes', 'There are only three diminished seventh chords. Each square is one chord with four names, a portal between keys a minor third apart.'],
          aug: ['Augmented cycles', 'Four augmented chords cover all twelve notes. Each triangle is one chord with three names, a hub between keys a major third apart.'],
        }[st.layer];
        const c = st.sel ? fromId(st.sel) : null;
        let detail = `<div class="empty">${ART.lion}<p>Click any chord on the circle to hear it and see where it leads.</p></div>`;
        if (c) {
          const br = E.bridgesTo(c).slice(0, 5);
          detail = `<div class="stack"><div class="row between"><h3>${esc(c.name)}</h3><span class="notes-mini">${noteNames(c)}</span></div>
            <p class="sub">Ways in:</p>
            ${br.map((b) => `<div class="row">${b.chords.map((x) => pill(x)).join('<span class="arrow">→</span>')}<span class="arrow">→</span>${pill(c)}<button class="btn" data-seq="${b.chords.map((x) => x.id).concat(c.id).join(' ')}" aria-label="Play ${esc(b.kind)}">▶ ${esc(b.kind)}</button></div>`).join('')}
          </div>`;
        }
        $('#side', root).innerHTML = `<div class="card"><h3>${notes[0]}</h3><p class="sub">${notes[1]}</p></div><div class="card">${detail}</div>`;
      };
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-seg="layer"]');
        if (b) { st.layer = b.dataset.v; store.set('circle.layer', st.layer); $$('[data-seg="layer"]', root).forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); }
        const n = e.target.closest('#mandala .node');
        if (n) { st.sel = n.dataset.chord; side(); }
      });
      $('#home', root).addEventListener('change', (e) => { st.home = +e.target.value; store.set('circle.home', st.home); draw(); });
      draw();
    } };
  };

  /* Proximity ladder */
  VIEWS.proximity = () => {
    const st = { root: store.get('prox.root', 0), q: store.get('prox.q', 'maj') };
    const html = `<section class="view">
      <div class="head"><span class="kicker">Illustrated Harmony · Near and far</span><h2>Proximity Ladder</h2>
      <p class="lede">Instead of tension and rest, think <em>near and far</em>. Every chord is ranked by how much it shares with home: common notes first, then the dominant's tritone, then chords that share nothing at all. Click a chord to hear home, then it.</p></div>
      <div class="card tight row"><label class="field">Home chord <span class="row">${rootSelect('pr', st.root)}${qualSelect('pq', st.q, ['maj', 'min'])}</span></label>
      <span class="sub" id="pinfo"></span></div>
      <div class="card"><div class="ladder" id="ladder"></div></div></section>`;
    return { html, mount: (root) => {
      const draw = () => {
        const home = E.chord(st.root, st.q);
        const tri = [E.name(home.root + 5), E.name(home.root + 11)];
        $('#pinfo', root).innerHTML = `Notes ${noteNames(home)} · tritone ${tri.join(' + ')} · ${legend}`;
        const groups = new Map();
        for (const r of E.proximityRange(home)) {
          if (!groups.has(r.tier)) groups.set(r.tier, { label: r.label, items: [] });
          groups.get(r.tier).items.push(r);
        }
        const desc = { 1: 'Itself', 2: 'Several common notes', 6: 'Contain both tritone notes', 9: 'Share a note with the home scale only', 10: 'Nothing in common' };
        $('#ladder', root).innerHTML = Array.from(groups.entries()).map(([tier, g]) => `
          <div class="tier"><div class="tier-label"><b>${tier}. ${esc(g.label)}</b><small>${desc[tier] || 'One common note'}</small>
            <div class="meter" style="width:${Math.max(8, 100 - (tier - 1) * 10)}%;margin-top:6px"></div></div>
            <div class="row">${g.items.map((r) => pill(r.chord, { seq: home.id + ' ' + r.chord.id + ' ' + home.id, small: E.shared(home, r.chord).map((p) => E.name(p)).join(' ') || '·' })).join('')}</div></div>`).join('');
      };
      ['#pr', '#pq'].forEach((s) => $(s, root).addEventListener('change', () => { st.root = +$('#pr', root).value; st.q = $('#pq', root).value; store.set('prox.root', st.root); store.set('prox.q', st.q); draw(); }));
      draw();
    } };
  };

  /* Bridge finder */
  VIEWS.bridges = () => {
    const st = store.get('bridge', { ar: 0, aq: 'maj', br: 8, bq: 'min' });
    const html = `<section class="view">
      <div class="head"><span class="kicker">Harmony 1 and 2 · Getting there</span><h2>Bridge Finder</h2>
      <p class="lede">Know your target chord, then build any bridge that reaches it. Pick two chords to see how much glue they share and the routes between them.</p></div>
      <div class="card tight row">
        <label class="field">From <span class="row">${rootSelect('ar', st.ar)}${qualSelect('aq', st.aq, ['maj', 'min', 'dim', 'aug'])}</span></label>
        <span class="arrow" style="padding-top:18px">→</span>
        <label class="field">To <span class="row">${rootSelect('br', st.br)}${qualSelect('bq', st.bq, ['maj', 'min', 'dim', 'aug'])}</span></label>
        <button class="btn" id="swap" style="margin-top:18px">Swap</button>
        <button class="btn" id="rand" style="margin-top:18px">Surprise me</button></div>
      <div id="bout" class="stack"></div></section>`;
    return { html, mount: (root) => {
      const draw = () => {
        Object.assign(st, { ar: +$('#ar', root).value, aq: $('#aq', root).value, br: +$('#br', root).value, bq: $('#bq', root).value });
        store.set('bridge', st);
        const a = E.chord(st.ar, st.aq), b = E.chord(st.br, st.bq);
        const out = $('#bout', root);
        if (a.id === b.id) {
          out.innerHTML = `<div class="card empty">${ART.lion}<h3>Same chord twice</h3><p>By default, the best chord to play after ${esc(a.name)} is another ${esc(a.name)}. Pick a different target to see some bridges.</p></div>`;
          return;
        }
        const g = E.glueIndex(a, b, a.root);
        const common = E.shared(a, b);
        const path = (a.quality === 'maj' || a.quality === 'min') && (b.quality === 'maj' || b.quality === 'min') ? E.nrPath(a, b) : null;
        let walk = [a];
        if (path) path.forEach((op) => walk.push(E.NR[op].fn(walk[walk.length - 1])));
        const ax = E.bartokAxes(a.root);
        const sameAxis = Object.entries(ax).find(([, v]) => v.includes(a.root) && v.includes(b.root));
        const ideas = E.bridgeBetween(a, b);
        out.innerHTML = `
          <div class="grid2">
            <div class="card stack"><h3>The glue</h3>
              <div class="row">${pill(a, { seq: `${a.id} ${b.id} ${a.id} ${b.id}`, small: noteNames(a) })}<span class="arrow">⇄</span>${pill(b, { seq: `${a.id} ${b.id} ${a.id} ${b.id}`, small: noteNames(b) })}</div>
              <div><div class="row between"><span class="sub">Magic Glue Index</span><b>${Math.round(g.value * 100)}%</b></div>
              <div style="height:8px;border-radius:8px;background:var(--panel-2);overflow:hidden;margin-top:6px"><div class="meter" style="height:8px;width:${Math.max(3, g.value * 100)}%"></div></div>
              <p class="sub" style="margin-top:6px">${esc(g.label)}.</p></div>
              <p class="callout">${common.length ? `Hold <b>${common.map((p) => E.name(p)).join(' and ')}</b> in the melody and the change will feel natural.` : 'No common notes. Let the melody move by half steps into the new chord, or use a bridge below.'}</p>
              ${sameAxis ? `<p class="callout">Both roots sit on the same <b>Bartók ${sameAxis[0]} axis</b> (${sameAxis[1].map((p) => E.name(p)).join(', ')}), so the jump can stand in for staying put.</p>` : ''}
            </div>
            <div class="card stack"><h3>Neo-Riemannian walk</h3>
              ${path ? `<p class="sub">${path.length} move${path.length === 1 ? '' : 's'}, each changing a single note.</p>
                <div class="row">${walk.map((c, i) => (i ? `<span class="arrow" title="${E.NR[path[i - 1]].label}">${path[i - 1]}</span>` : '') + pill(c)).join('')}</div>
                <button class="btn" data-seq="${walk.map((c) => c.id).join(' ')}">▶ Play the walk</button>` : `<p class="sub">P, L and R only move between major and minor triads. Pick major or minor chords at both ends to get a walk.</p>`}
            </div>
          </div>
          <div class="card stack"><h3>Bridges into ${esc(b.name)}</h3>
            <p class="sub">Ranked by how many notes the first bridge chord shares with ${esc(a.name)}.</p>
            ${ideas.map((br) => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)">${pill(a)}<span class="arrow">→</span>${br.chords.map((x) => pill(x)).join('<span class="arrow">→</span>')}<span class="arrow">→</span>${pill(b)}
              <span class="sub" style="margin-left:auto">${esc(br.kind)} · glue ${br.glue}</span>
              <button class="btn" data-seq="${[a, ...br.chords, b].map((x) => x.id).join(' ')}" aria-label="Play ${esc(br.kind)}">▶</button></div>`).join('')}
          </div>`;
      };
      $$('select', root).forEach((s) => s.addEventListener('change', draw));
      $('#swap', root).addEventListener('click', () => {
        const [ar, aq] = [$('#ar', root).value, $('#aq', root).value];
        $('#ar', root).value = $('#br', root).value; $('#aq', root).value = $('#bq', root).value;
        $('#br', root).value = ar; $('#bq', root).value = aq; draw();
      });
      $('#rand', root).addEventListener('click', () => {
        const qs = ['maj', 'min'];
        $('#ar', root).value = Math.floor(Math.random() * 12); $('#br', root).value = Math.floor(Math.random() * 12);
        $('#aq', root).value = qs[Math.random() * 2 | 0]; $('#bq', root).value = qs[Math.random() * 2 | 0]; draw();
      });
      draw();
    } };
  };

  /* PLR tree and Bartók axes */
  VIEWS.plr = () => {
    const st = { root: store.get('plr.root', 0), q: store.get('plr.q', 'maj'), walk: [] , axis: store.get('plr.axis', 0) };
    const html = `<section class="view">
      <div class="head"><span class="kicker">Illustrated Harmony 2 · Neighbors and axes</span><h2>PLR Tree</h2>
      <p class="lede">Three moves, each changing one note: <em>P</em> swaps major and minor, <em>R</em> goes to the relative, <em>L</em> moves the root by a leading tone. Grow them out from any chord and every major and minor triad appears within five steps.</p></div>
      <div class="card tight row between"><label class="field">Start <span class="row">${rootSelect('xr', st.root)}${qualSelect('xq', st.q, ['maj', 'min'])}</span></label>
        <span class="legend"><span style="color:var(--hand)"><i></i>Your walk</span><span>Ring = number of moves away</span></span></div>
      <div class="grid2">
        <div class="card"><svg id="tree" class="diagram" viewBox="0 0 640 640" role="img" aria-label="PLR generations"></svg></div>
        <div class="stack">
          <div class="card stack"><h3>Walk it</h3><p class="sub">Apply moves one at a time and play the result.</p>
            <div class="row">${Object.entries(E.NR).map(([k, v]) => `<button class="btn" data-op="${k}" title="${esc(v.label)}">${k}</button>`).join('')}</div>
            <div class="row" id="walk"></div>
            <div class="row"><button class="btn primary" id="playwalk">▶ Play walk</button><button class="btn" id="clearwalk">Reset</button></div>
            <p class="sub" style="font-size:12px">N, S and H are compound moves: Nebenverwandt, Slide and the hexatonic pole.</p></div>
          <div class="card stack"><h3>Bartók axes</h3><p class="sub">The opposite of glue: jump to any chord on the same axis. The two tritone pairs on each axis share a function.</p>
            <label class="field">Tonic ${rootSelect('axr', st.axis)}</label>
            <div id="axes" class="stack"></div></div>
        </div></div></section>`;
    return { html, mount: (root) => {
      const draw = () => {
        const start = E.chord(st.root, st.q);
        if (!st.walk.length || st.walk[0].id !== start.id) st.walk = [start];
        const gens = E.plrGenerations(start, 5);
        const cx = 320, cy = 320, R = [0, 78, 146, 212, 262, 296];
        const pos = new Map([[start.id, [cx, cy, 0]]]);
        let s = defs, nodes = '';
        const adiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
        gens.forEach((g, gi) => {
          if (!gi) return;
          s += `<circle cx="${cx}" cy="${cy}" r="${R[gi]}" fill="none" stroke="#1e1e24" stroke-dasharray="2 6"/>`;
          const items = g.map((c) => ({ c, pa: gi === 1 ? 0 : pos.get(c.from)[2] })).sort((x, y) => x.pa - y.pa);
          const n = items.length;
          // Spread evenly, then rotate the ring so each chord sits as close as possible to its parent.
          let best = 0, bestCost = Infinity;
          for (let off = 0; off < 360; off += 3) {
            const cost = items.reduce((sum, it, i) => sum + adiff(off + (i * 360) / n, it.pa), 0);
            if (cost < bestCost) { bestCost = cost; best = off; }
          }
          items.forEach((it, i) => {
            const a = gi === 1 ? (i * 120) : best + (i * 360) / n;
            const [x, y] = polar(cx, cy, R[gi], a);
            pos.set(it.c.id, [x, y, a]);
          });
        });
        gens.forEach((g, gi) => g.forEach((c) => {
          const [x, y] = pos.get(c.id);
          if (c.from) { const [px, py] = pos.get(c.from); s += link(px, py, x, y, { r1: 21, r2: 21 }); }
          nodes += svgNode(c, x, y, 21);
        }));
        const walkIds = st.walk.map((c) => c.id);
        for (let i = 1; i < st.walk.length; i++) {
          const p = pos.get(st.walk[i - 1].id), q = pos.get(st.walk[i].id);
          if (p && q) s += link(p[0], p[1], q[0], q[1], { cls: 'edge hand', r1: 21, r2: 21, arrow: false, bend: 18 });
        }
        $('#tree', root).innerHTML = s + nodes.replace(/data-chord="([^"]+)"/g, (m, id) => (walkIds.includes(id) ? m + ' style="filter:drop-shadow(0 0 6px #8be05a)"' : m));
        $('#walk', root).innerHTML = st.walk.map((c, i) => (i ? '<span class="arrow">→</span>' : '') + pill(c)).join('');
        drawAxes();
      };
      const drawAxes = () => {
        const ax = E.bartokAxes(st.axis);
        $('#axes', root).innerHTML = Object.entries(ax).map(([fn, pcs]) => `<div><div class="row between"><b style="text-transform:capitalize">${fn}</b>
          <button class="btn" data-seq="${pcs.map((p) => p + ':maj').join(' ')}">▶</button></div>
          <div class="row" style="margin-top:6px">${pcs.map((p) => pill(E.chord(p, 'maj'))).join('')}</div></div>`).join('') +
          `<button class="btn" id="axjump">▶ Core progression with axis jumps</button>`;
        $('#axjump', root).addEventListener('click', () => {
          const pick = (arr) => arr[1 + ((Math.random() * 3) | 0)];
          const seq = [E.chord(st.axis, 'maj'), E.chord(pick(ax.subdominant), 'maj'), E.chord(pick(ax.dominant), 'dom7'), E.chord(st.axis, 'maj')];
          E.playSequence(seq, { gap: 0.9 });
          toast(seq.map((c) => c.name).join(' → '));
        });
      };
      root.addEventListener('click', (e) => {
        const op = e.target.closest('[data-op]');
        if (op) { const last = st.walk[st.walk.length - 1]; const n = E.NR[op.dataset.op].fn(last); st.walk.push(n); E.playChord(n); draw(); }
        const n = e.target.closest('#tree .node');
        if (n) {
          const target = fromId(n.dataset.chord), start = E.chord(st.root, st.q);
          const path = E.nrPath(start, target) || [];
          st.walk = [start];
          path.forEach((o) => st.walk.push(E.NR[o].fn(st.walk[st.walk.length - 1])));
          draw();
        }
      });
      $('#playwalk', root).addEventListener('click', () => E.playSequence(st.walk, { gap: 0.8 }));
      $('#clearwalk', root).addEventListener('click', () => { st.walk = []; draw(); });
      ['#xr', '#xq'].forEach((sel) => $(sel, root).addEventListener('change', () => { st.root = +$('#xr', root).value; st.q = $('#xq', root).value; store.set('plr.root', st.root); store.set('plr.q', st.q); st.walk = []; draw(); }));
      $('#axr', root).addEventListener('change', (e) => { st.axis = +e.target.value; store.set('plr.axis', st.axis); drawAxes(); });
      draw();
    } };
  };

  /* Modal map */
  const MODE_POS = {
    lydian2: [0, 1.5], lydian: [1, 1.5], lydianb7: [2, 0.4], ionian: [2, 2.6],
    dorian4: [3, 0], mixolydian: [3, 1.5], melodic: [3, 3],
    dorian: [4, 0.8], mixob13: [4, 2.1], harmonic: [4, 3.3],
    dorianb2: [5, 0.2], mixob9b13: [5, 1.5], aeolian: [5, 2.8], phrygian: [6, 1.5],
  };
  VIEWS.modes = () => {
    const st = { root: store.get('modes.root', 0), sel: store.get('modes.sel', 'lydian') };
    const html = `<section class="view">
      <div class="head"><span class="kicker">Illustrated Modes · Modal cartography</span><h2>Modal Map</h2>
      <p class="lede">Fourteen modes with a major or minor tonic, from the major, melodic minor and harmonic minor families. Two modes are linked when they differ by <em>one note</em>. Brightest on the left, darkest on the right.</p></div>
      <div class="card tight row between"><label class="field">Tonic ${rootSelect('mr', st.root)}</label>
        <div class="row" id="modechips"></div></div>
      <div class="card"><svg id="map" class="diagram" viewBox="0 0 800 410" role="img" aria-label="Modal map"></svg></div>
      <div id="mdetail" class="grid2"></div></section>`;
    return { html, mount: (root) => {
      const keys = Object.keys(E.SCALES);
      const X = (c) => 58 + c * 114, Y = (r) => 38 + r * 103;
      const draw = () => {
        const links = E.modeLinks();
        let s = '', labels = '';
        for (const [a, b] of links) {
          const [ax, ay] = MODE_POS[a], [bx, by] = MODE_POS[b];
          const on = a === st.sel || b === st.sel;
          const d = E.modeDiff(a, b)[0], d2 = E.modeDiff(b, a)[0];
          s += `<line x1="${X(ax)}" y1="${Y(ay)}" x2="${X(bx)}" y2="${Y(by)}" stroke="${on ? '#8be05a' : 'rgba(255,255,255,.22)'}" stroke-width="${on ? 2.2 : 1.2}"/>`;
          if (on && Math.hypot(X(ax) - X(bx), Y(ay) - Y(by)) > 140) { const mx = (X(ax) + X(bx)) / 2, my = (Y(ay) + Y(by)) / 2; labels += `<rect x="${mx - 24}" y="${my - 10}" width="48" height="20" rx="10" fill="#0a0a0c" stroke="#8be05a"/><text x="${mx}" y="${my + 4}" text-anchor="middle" font-size="11" fill="#8be05a" font-weight="700">${E.name(st.root + d)}→${E.name(st.root + d2)}</text>`; }
        }
        for (const k of keys) {
          const [c, r] = MODE_POS[k], x = X(c), y = Y(r);
          const minor = E.isMinorMode(k), col = minor ? 'var(--min)' : 'var(--maj)';
          const on = k === st.sel;
          s += `<g class="node" tabindex="0" role="button" aria-label="${E.SCALES[k].label}" data-mode="${k}">
            <rect x="${x - 50}" y="${y - 24}" width="100" height="48" rx="10" fill="#0a0a0c"/>
            <rect x="${x - 50}" y="${y - 24}" width="100" height="48" rx="10" fill="${on ? col : '#0a0a0c'}" fill-opacity="${on ? 0.2 : 1}" stroke="${col}" stroke-width="${on ? 3 : 1.6}"/>
            <text x="${x}" y="${y - 2}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${col}">${E.SCALES[k].label.replace(' minor', '')}</text>
            <text x="${x}" y="${y + 14}" text-anchor="middle" font-size="10" fill="#8d8d96">${E.SCALES[k].parent} · ${E.name(st.root)}${minor ? 'm' : ''}</text></g>`;
        }
        $('#map', root).innerHTML = s + labels;
        $('#modechips', root).innerHTML = keys.map((k) => `<button class="chip ${E.isMinorMode(k) ? 'c-min' : 'c-maj'}" data-mode="${k}" aria-pressed="${k === st.sel}">${E.SCALES[k].label}</button>`).join('');
        detail();
      };
      const detail = () => {
        const k = st.sel, sc = E.SCALES[k], ref = E.SCALES[E.referenceOf(k)].iv;
        const notes = E.scaleNotes(st.root, k), steps = E.steps(sc.iv);
        const chars = E.characteristic(k);
        const kit = E.modeKit(st.root, k);
        const harm = E.harmonize(st.root, k);
        const tonic = harm[0];
        const tension = chars.length ? { pcs: tonic.pcs.concat(chars.map((c) => (st.root + c) % 12)) } : null;
        const neighbors = E.modeLinks().filter((l) => l.includes(k)).map((l) => l[0] === k ? l[1] : l[0]);
        const sqs = sc.iv.map((iv, i) => {
          const isChar = !ref.includes(iv);
          const cls = !isChar ? '' : ref[i] < iv ? 'up' : 'down';
          return `<button class="sq ${cls}" data-note="${notes[i]}" title="${isChar ? 'Characteristic note' : 'Shared with ' + E.SCALES[E.referenceOf(k)].label}">${E.name(notes[i])}</button>${`<span class="step${steps[i] === 1 ? ' half' : ''}">${steps[i] === 1 ? '½' : steps[i] === 2 ? '1' : '1½'}</span>`}`;
        }).join('');
        $('#mdetail', root).innerHTML = `
          <div class="card stack"><div class="row between"><h3>${E.name(st.root)} ${sc.label}</h3><span class="sub">${{ Maj: 'Major family', ME: 'Melodic minor family', Ar: 'Harmonic minor family' }[sc.parent]}</span></div>
            <div class="squares">${sqs}</div>
            <p class="sub">Raised squares are notes sharper than ${E.SCALES[E.referenceOf(k)].label}; sunken squares are flatter. Those are the notes that give the mode its color.</p>
            <div class="row"><button class="btn primary" id="pscale">▶ Scale</button>
            ${tension ? `<button class="btn" id="ptension">▶ Tension chord (${esc(tonic.name)} + ${chars.map((c) => E.name(st.root + c)).join(', ')})</button>` : ''}</div>
            <div><p class="sub" style="margin-bottom:6px">All seven chords</p><div class="row">${harm.map((c) => pill(c)).join('')}</div></div>
          </div>
          <div class="card stack"><h3>Composing kit</h3>
            <p class="sub">Drop diminished chords, chords holding a tritone and chords the reference mode also has. What stays points straight at the mode's color.</p>
            <div class="row">${kit.map((c) => pill(c)).join('')}</div>
            <button class="btn" data-seq="${kit.map((c) => c.id).concat(kit[0].id).join(' ')}" data-gap="1.1">▶ Play the kit</button>
            <p class="sub" style="margin-top:8px">One note away</p>
            <div class="row">${neighbors.map((n) => `<button class="chip" data-mode="${n}">${E.SCALES[n].label} <span style="color:var(--hand)">${E.name(st.root + E.modeDiff(k, n)[0])}→${E.name(st.root + E.modeDiff(n, k)[0])}</span></button>`).join('')}</div>
          </div>`;
        const pscale = $('#pscale', root);
        pscale.addEventListener('click', () => E.playScale(notes, st.root, { name: E.name(st.root) + ' ' + sc.label }));
        const pt = $('#ptension', root);
        if (pt) pt.addEventListener('click', () => E.playMidi(tension.pcs.map((p, i) => 48 + ((p - st.root + 12) % 12) + (i > 2 ? 12 : 0) + st.root % 12), { name: tonic.name + '(add ' + chars.map((c) => E.name(st.root + c)).join(', ') + ')', root: st.root }));
      };
      root.addEventListener('click', (e) => {
        const m = e.target.closest('[data-mode]');
        if (m) { st.sel = m.dataset.mode; store.set('modes.sel', st.sel); draw(); E.playScale(E.scaleNotes(st.root, st.sel), st.root, { gap: 0.16, name: E.name(st.root) + ' ' + E.SCALES[st.sel].label }); }
        const sq = e.target.closest('[data-note]');
        if (sq) E.playMidi([60 + ((+sq.dataset.note - st.root + 12) % 12) + st.root % 12], { strum: 0, vel: 0.3, name: E.name(+sq.dataset.note), root: +sq.dataset.note });
      });
      $('#mr', root).addEventListener('change', (e) => { st.root = +e.target.value; store.set('modes.root', st.root); draw(); });
      draw();
    } };
  };

  /* Extensions */
  VIEWS.extensions = () => {
    const st = { key: store.get('ext.key', 0), deg: 0, on: [], lower: store.get('ext.lower', '0:maj'), fund: 0 };
    const html = `<section class="view">
      <div class="head"><span class="kicker">Illustrated Chord Extensions · Seasoning</span><h2>Extension Board</h2>
      <p class="lede">Triads are the recipe; 9ths, 11ths and 13ths are the seasoning. Each chord in the key gets a row of nine teeth. A tooth lights up when it stays in the key, isn't a half step above a chord tone, and doesn't make a tritone with the third.</p></div>
      <div class="card tight row"><label class="field">Key ${rootSelect('ek', st.key)}</label><span class="legend"><span style="color:var(--hand)"><i></i>Available</span><span><i style="opacity:.4"></i>Blocked (hover for why)</span></span></div>
      <div class="card" id="saw"></div>
      <div class="grid2"><div class="card stack" id="web"></div><div class="card stack" id="harm"></div></div>
      <div class="card stack" id="poly"></div></section>`;
    return { html, mount: (root) => {
      const diatonic = () => E.harmonize(st.key, 'ionian').map((c, i) => (i === 4 ? E.chord(c.root, 'dom7') : c)).filter((c) => c.family !== 'dim');
      const drawSaw = () => {
        const chords = diatonic();
        $('#saw', root).innerHTML = `<p class="sub" style="margin-bottom:8px">Click a tooth to hear the chord with that extension. Click a chord to open it in the interval web.</p><div class="stack saw">${chords.map((c, i) => {
          const teeth = E.extensionStatus(c, st.key);
          return `<div class="row" style="padding:6px 0;${i ? 'border-top:1px solid var(--line)' : ''}">
            <span style="width:72px" data-pick="${i}">${pill(c)}</span>
            ${teeth.map((t) => `<button class="chip" data-tooth="${i}:${t.iv}" ${t.ok ? `style="border-color:var(--hand);color:var(--hand)"` : `style="opacity:.35" title="${esc(t.reason)}"`} aria-label="${esc(c.name)} add ${t.label}${t.ok ? '' : ', blocked: ' + esc(t.reason)}">${t.label}</button>`).join('')}</div>`;
        }).join('')}</div>`;
      };
      const drawWeb = () => {
        const c = diatonic()[st.deg];
        const pcs = Array.from(new Set(c.pcs.concat(st.on.map((iv) => (c.root + iv) % 12))));
        const cx = 160, cy = 150, r = 105;
        const pos = (pc) => polar(cx, cy, r, ((pc - c.root + 12) % 12) * 30);
        const web = E.intervalWeb(pcs);
        let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e1e24"/>`;
        for (const e of web) {
          const [x1, y1] = pos(e.a), [x2, y2] = pos(e.b);
          const col = e.kind === 'b9' ? 'var(--maj)' : e.kind === 'tritone' ? 'var(--dom)' : 'rgba(255,255,255,.28)';
          s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${e.kind === 'ok' ? 1 : 2.4}"/>`;
        }
        for (let i = 0; i < 12; i++) {
          const pc = (c.root + i) % 12, [x, y] = pos(pc), inn = pcs.includes(pc), tone = c.pcs.includes(pc);
          s += `<circle cx="${x}" cy="${y}" r="${inn ? 15 : 3}" fill="${inn ? '#0a0a0c' : '#2a2a32'}" stroke="${inn ? (tone ? famVar(c.family) : 'var(--hand)') : 'none'}" stroke-width="2"/>`;
          if (inn) s += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#eee">${E.name(pc)}</text>`;
        }
        const clashes = web.filter((w) => w.kind !== 'ok');
        $('#web', root).innerHTML = `<div class="row between"><h3>Interval web</h3>${pill(c)}</div>
          <p class="sub">Every note connected to every other. Pink lines are half-step clashes (b9), yellow are tritones.</p>
          <svg class="diagram" viewBox="0 0 320 300" style="max-width:360px;margin:0 auto">${s}</svg>
          <div class="row">${E.EXT_TEETH.filter((t) => t.iv !== 10).map((t) => `<button class="chip" data-add="${t.iv}" aria-pressed="${st.on.includes(t.iv)}">${t.label}</button>`).join('')}</div>
          <div class="row"><button class="btn primary" id="pweb">▶ Play</button><span class="sub">${clashes.length ? clashes.map((w) => `${E.name(w.a)}–${E.name(w.b)} ${w.kind}`).join(', ') : 'No clashes'}</span></div>`;
        $('#pweb', root).addEventListener('click', () => {
          const base = E.voice(c, 48);
          const ext = st.on.slice().sort((a, b) => a - b).map((iv) => 48 + (c.root % 12) + 12 + iv + (base[0] - 48 - (c.root % 12)));
          E.playMidi(base.concat(ext), { name: c.name + (st.on.length ? '(add ' + E.EXT_TEETH.filter((t) => st.on.includes(t.iv)).map((t) => t.label).join(', ') + ')' : ''), root: c.root, chord: st.on.length ? null : c });
        });
      };
      const drawHarm = () => {
        const hs = E.harmonics(st.fund, 16);
        const W = 300, H = 150, bw = W / 16;
        const bars = hs.map((h, i) => `<rect x="${i * bw + 2}" y="${H - (H - 20) / h.n}" width="${bw - 4}" height="${(H - 20) / h.n}" rx="2" fill="${Math.abs(h.cents) > 15 ? 'var(--maj)' : 'var(--dom)'}" opacity=".85"/>
          <text x="${i * bw + bw / 2}" y="${H + 14}" text-anchor="middle" font-size="9" fill="#bbb">${E.name(h.pc)}</text>
          <text x="${i * bw + bw / 2}" y="${H + 26}" text-anchor="middle" font-size="8" fill="#666">${h.cents > 0 ? '+' : ''}${h.cents}</text>`).join('');
        $('#harm', root).innerHTML = `<div class="row between"><h3>Inside one note</h3><label class="field">Fundamental ${rootSelect('hf', st.fund)}</label></div>
          <p class="sub">The first sixteen harmonics, loudness falling as 1/n. The 9th and the #11 are already hiding in a single low note. Pink bars sit more than 15 cents away from the piano's tuning.</p>
          <svg class="diagram" viewBox="0 0 300 180">${bars}</svg>
          <div class="row"><button class="btn primary" id="ph">▶ Play the stack</button><span class="sub">Numbers under each bar are cents off equal temperament.</span></div>`;
        $('#hf', root).addEventListener('change', (e) => { st.fund = +e.target.value; drawHarm(); });
        $('#ph', root).addEventListener('click', () => { const f0 = E.freq(36 + st.fund); E.playFreqs(hs.map((h) => ({ f: f0 * h.n, level: 1 / h.n }))); });
      };
      const drawPoly = () => {
        const lower = fromId(st.lower);
        const rows = E.allChords(['maj', 'min', 'dim', 'aug']).filter((u) => u.id !== lower.id).map((u) => ({ u, ...E.polychord(lower, u) })).sort((a, b) => a.tension - b.tension || a.u.root - b.u.root);
        const opts = E.allChords(['maj', 'min']).map((c) => `<option value="${c.id}"${c.id === st.lower ? ' selected' : ''}>${c.name}</option>`).join('');
        const bucket = (t) => (t === 0 ? 'Smooth' : t <= 2 ? 'Spicy' : t <= 4 ? 'Hot' : 'Fire');
        const groups = {};
        rows.forEach((r) => (groups[bucket(r.tension)] = groups[bucket(r.tension)] || []).push(r));
        $('#poly', root).innerHTML = `<div class="row between"><h3>Polychord calculator</h3><label class="field">Lower triad <select id="pl">${opts}</select></label></div>
          <p class="sub">Stack a second triad on top. Ranked by clashes between the two layers: each half step counts double, each tritone once.</p>
          ${Object.entries(groups).map(([g, list]) => `<div class="tier"><div class="tier-label"><b>${g}</b><small>${list.length} chords</small></div><div class="row">${list.map((r) => `<button class="chordpill f-${r.u.family}" data-poly="${r.u.id}" title="${r.b9} b9, ${r.tt} tritone">${esc(r.u.name)}<small>/${esc(lower.name)}</small></button>`).join('')}</div></div>`).join('')}`;
        $('#pl', root).addEventListener('change', (e) => { st.lower = e.target.value; store.set('ext.lower', st.lower); drawPoly(); });
      };
      root.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tooth]');
        if (t) { const [i, iv] = t.dataset.tooth.split(':').map(Number); const c = diatonic()[i]; const v = E.voice(c, 48); E.playMidi(v.concat(v[0] + 12 + iv), { name: c.name + '(add ' + E.EXT_TEETH.find((t) => t.iv === iv).label + ')', root: c.root }); }
        const p = e.target.closest('[data-pick]');
        if (p) { st.deg = +p.dataset.pick; st.on = []; drawWeb(); }
        const a = e.target.closest('[data-add]');
        if (a) { const iv = +a.dataset.add; st.on = st.on.includes(iv) ? st.on.filter((x) => x !== iv) : st.on.concat(iv); drawWeb(); }
        const pc = e.target.closest('[data-poly]');
        if (pc) { const lo = E.voice(fromId(st.lower), 48), up = E.voice(fromId(pc.dataset.poly), 62); E.playMidi(lo.concat(up), { strum: 0.03, name: fromId(pc.dataset.poly).name + ' / ' + fromId(st.lower).name, root: fromId(st.lower).root }); }
      });
      $('#ek', root).addEventListener('change', (e) => { st.key = +e.target.value; store.set('ext.key', st.key); drawSaw(); drawWeb(); });
      drawSaw(); drawWeb(); drawHarm(); drawPoly();
    } };
  };

  /* Four voices */
  const PRESETS = [
    ['The DJ problem', 'Cmaj7 G G7 Cmaj7'],
    ['Pop loop', 'C G Am F C'],
    ['Minor cadence', 'Am Dm E7 Am'],
    ['Secondary dominants', 'C E7 Am D7 G7 C'],
    ['Borrowed from minor', 'C Ab Bb C'],
  ];
  VIEWS.voices = () => {
    const st = { prog: store.get('voices.prog', 'C E7 Am D7 G7 C'), mode: 'led', mute: [] };
    const html = `<section class="view">
      <div class="head"><span class="kicker">Arrangements Illustrated · Vertical to horizontal</span><h2>Four Voices</h2>
      <p class="lede">Block chords stacked one after another sound like a DJ trying records. Four independent melodies sound like an arrangement. Type a progression and compare the two, with each voice in its own color.</p></div>
      <div class="card tight stack">
        <div class="row"><label class="field" style="flex:1;min-width:220px">Progression <input id="prog" value="${esc(st.prog)}" spellcheck="false" autocomplete="off" style="background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-family:var(--mono)"></label>
        <div style="padding-top:18px">${seg('vmode', [['block', 'Block chords'], ['led', 'Voice-led']], st.mode)}</div></div>
        <div class="row">${PRESETS.map(([n, p]) => `<button class="chip" data-preset="${esc(p)}">${n}</button>`).join('')}</div></div>
      <div id="vout"></div></section>`;
    return { html, mount: (root) => {
      const parse = () => {
        const toks = st.prog.trim().split(/[\s,|-]+/).filter(Boolean);
        const chords = toks.map((t) => E.parseChord(t));
        return { toks, chords, bad: toks.filter((t, i) => !chords[i]) };
      };
      const blockRows = (chords) => chords.map((c) => { const v = E.voice(c, 48); const four = v.length >= 4 ? v.slice(0, 4) : v.concat(v[0] + 12); four.sort((a, b) => a - b); return { b: four[0], t: four[1], a: four[2], s: four[3] }; });
      const draw = () => {
        const { toks, chords, bad } = parse();
        const out = $('#vout', root);
        if (!toks.length) { out.innerHTML = `<div class="card empty">${ART.guitar}<h3>No chords yet</h3><p>Type a few chord names above, like <b>C Am F G7</b>, or pick a preset.</p></div>`; return; }
        if (bad.length) { out.innerHTML = `<div class="card flag bad">Can't read ${bad.map((b) => `<b>${esc(b)}</b>`).join(', ')}. Try names like C, F#m, Bb7, Bdim, Caug, Cmaj7, Dm7 or Bm7b5.</div>`; return; }
        const rows = st.mode === 'led' ? E.satb(chords) : blockRows(chords);
        const issues = E.satbCheck(rows);
        const all = rows.flatMap((r) => [r.s, r.a, r.t, r.b]);
        const lo = Math.min(...all) - 2, hi = Math.max(...all) + 2;
        const W = 720, H = 300, colW = (W - 60) / rows.length;
        const y = (m) => 20 + (hi - m) / (hi - lo) * (H - 40);
        const VC = { s: 'var(--dom)', a: 'var(--aug)', t: 'var(--min)', b: 'var(--maj)' };
        const role = (c, m) => { const iv = (m - c.root + 120) % 12; return { 0: 'R', 3: 'b3', 4: '3', 6: 'b5', 7: '5', 8: '#5', 9: '6', 10: 'b7', 11: '7', 2: '9', 5: '4' }[iv] || ''; };
        let s = '';
        for (let m = lo; m <= hi; m++) if (m % 12 === 0) s += `<line x1="40" x2="${W}" y1="${y(m)}" y2="${y(m)}" stroke="#1e1e24"/><text x="4" y="${y(m) + 4}" font-size="10" fill="#555">C${m / 12 - 1}</text>`;
        for (const v of ['b', 't', 'a', 's']) {
          const pts = rows.map((r, i) => [60 + i * colW + colW / 2, y(r[v])]);
          s += `<path d="M${pts.map((p) => p.join(',')).join(' L')}" fill="none" stroke="${VC[v]}" stroke-width="1.6" opacity="${st.mute.includes(v) ? 0.12 : 0.55}"/>`;
          rows.forEach((r, i) => {
            const [px, py] = pts[i];
            s += `<g opacity="${st.mute.includes(v) ? 0.2 : 1}"><rect x="${px - 26}" y="${py - 10}" width="52" height="20" rx="6" fill="#0a0a0c" stroke="${VC[v]}" stroke-width="1.8"/><text x="${px}" y="${py + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${VC[v]}">${E.name(r[v])} <tspan fill="#8d8d96" font-weight="500">${role(chords[i], r[v])}</tspan></text></g>`;
          });
        }
        chords.forEach((c, i) => {
          const bad = issues.some((x) => x.at === i);
          s += `<text x="${60 + i * colW + colW / 2}" y="${H + 18}" text-anchor="middle" font-size="14" font-weight="700" fill="${famVar(c.family)}">${esc(c.name)}${bad ? ' •' : ''}</text>`;
        });
        const moved = ['s', 'a', 't', 'b'].map((v) => rows.slice(1).reduce((sum, r, i) => sum + Math.abs(r[v] - rows[i][v]), 0));
        out.innerHTML = `<div class="stack">
          <div class="card stack"><svg class="roll" viewBox="0 0 ${W} ${H + 30}" role="img" aria-label="Four voice piano roll">${s}</svg>
            <div class="row"><button class="btn primary" id="vplay">▶ Play</button>
            ${[['s', 'Soprano'], ['a', 'Alto'], ['t', 'Tenor'], ['b', 'Bass']].map(([v, n]) => `<button class="chip v-${v}" data-mute="${v}" aria-pressed="${!st.mute.includes(v)}" style="${!st.mute.includes(v) ? `background:${VC[v]};border-color:${VC[v]};color:#000` : ''}">${n}</button>`).join('')}</div></div>
          <div class="card stack"><h3>Rule check</h3>
            ${issues.length ? issues.map((x) => `<div class="flag ${x.kind}"><b>${esc(chords[x.at - (x.text.startsWith('Voices') ? 0 : 1)]?.name || '')} → ${esc(chords[x.at].name)}</b> · ${esc(x.text)}</div>`).join('') : '<div class="flag ok">Clean: no crossings, no parallel fifths or octaves, no big leaps.</div>'}
            <p class="sub">Semitones moved: ${['Soprano', 'Alto', 'Tenor', 'Bass'].map((n, i) => `${n} ${moved[i]}`).join(' · ')}</p>
            <p class="callout">${st.mode === 'led' ? 'Each voice takes the nearest chord tone and common tones are held, so the inner voices barely move.' : 'Root-position blocks: every voice jumps with the bass. Switch to Voice-led to hear the difference.'}</p></div></div>`;
        $('#vplay', root).addEventListener('click', () => {
          const gap = 0.95;
          const t0 = 0;
          rows.forEach((r, i) => setTimeout(() => E.playMidi(['s', 'a', 't', 'b'].filter((v) => !st.mute.includes(v)).map((v) => r[v]), { dur: gap * 1.5, strum: 0.012, chord: chords[i] }), (t0 + i * gap) * 1000));
        });
      };
      $('#prog', root).addEventListener('input', (e) => { st.prog = e.target.value; store.set('voices.prog', st.prog); draw(); });
      root.addEventListener('click', (e) => {
        const p = e.target.closest('[data-preset]');
        if (p) { st.prog = p.dataset.preset; $('#prog', root).value = st.prog; store.set('voices.prog', st.prog); draw(); }
        const m = e.target.closest('[data-seg="vmode"]');
        if (m) { st.mode = m.dataset.v; $$('[data-seg="vmode"]', root).forEach((x) => x.setAttribute('aria-pressed', x === m)); draw(); }
        const mu = e.target.closest('[data-mute]');
        if (mu) { const v = mu.dataset.mute; st.mute = st.mute.includes(v) ? st.mute.filter((x) => x !== v) : st.mute.concat(v); draw(); }
      });
      draw();
    } };
  };


  /* ---------- Keys and tab dock ---------- */
  const dock = (() => {
    const el = $('#dock');
    const st = { info: null, alt: 0, view: store.get('dock.view', 'both'), open: store.get('dock.open', true) };
    const WHITE = [0, 2, 4, 5, 7, 9, 11];

    function piano(midi, fam) {
      const notes = midi.slice().sort((a, b) => a - b);
      let lo = notes.length ? notes[0] - (notes[0] % 12) : 48;
      let hi = notes.length ? notes[notes.length - 1] + (11 - (notes[notes.length - 1] % 12)) : 71;
      if (hi - lo < 23) hi = lo + 23;
      const whites = [];
      for (let m = lo; m <= hi; m++) if (WHITE.includes(m % 12)) whites.push(m);
      const ww = 300 / whites.length, H = 92, bh = 56;
      const col = famVar(fam);
      let s = '';
      whites.forEach((m, i) => {
        const on = notes.includes(m);
        s += `<g class="key" data-key="${m}"><rect x="${i * ww}" y="0" width="${ww - 1}" height="${H}" rx="3" fill="${on ? col : '#e9e9ee'}" stroke="#0a0a0c"/>
          ${on ? `<text x="${i * ww + ww / 2}" y="${H - 8}" text-anchor="middle" font-size="${Math.min(10, ww * 0.55)}" font-weight="700" fill="#000">${E.name(m)}</text>` : m % 12 === 0 ? `<text x="${i * ww + ww / 2}" y="${H - 8}" text-anchor="middle" font-size="8" fill="#888">C${m / 12 - 1}</text>` : ''}</g>`;
      });
      whites.forEach((m, i) => {
        const b = m + 1;
        if (b > hi || WHITE.includes(b % 12)) return;
        const on = notes.includes(b);
        const x = (i + 1) * ww - ww * 0.32;
        s += `<g class="key" data-key="${b}"><rect x="${x}" y="0" width="${ww * 0.62}" height="${bh}" rx="2" fill="${on ? col : '#1a1a20'}" stroke="#0a0a0c"/>
          ${on ? `<text x="${x + ww * 0.31}" y="${bh - 6}" text-anchor="middle" font-size="${Math.min(8, ww * 0.45)}" font-weight="700" fill="#000">${E.name(b)}</text>` : ''}</g>`;
      });
      return `<svg class="piano" viewBox="0 0 300 ${H}" role="img" aria-label="Piano keys: ${notes.map((m) => E.name(m)).join(' ')}">${s}</svg>`;
    }

    function fretboardMap(pcs, root) {
      // Every place the notes live on the first twelve frets, for scales and big stacks.
      const W = 300, H = 92, fw = W / 13, sh = H / 7;
      let s = `<rect x="${fw - 3}" y="${sh - 2}" width="3" height="${sh * 5 + 4}" fill="#ccc"/>`;
      for (let f = 1; f <= 12; f++) s += `<line x1="${fw * (f + 1)}" x2="${fw * (f + 1)}" y1="${sh}" y2="${sh * 6}" stroke="#3a3a44"/>`;
      [3, 5, 7, 9].forEach((f) => (s += `<circle cx="${fw * (f + 0.5)}" cy="${H - 4}" r="2" fill="#55555e"/>`));
      s += `<circle cx="${fw * 12.5 - 4}" cy="${H - 4}" r="2" fill="#55555e"/><circle cx="${fw * 12.5 + 4}" cy="${H - 4}" r="2" fill="#55555e"/>`;
      E.TUNING.forEach((open, i) => {
        const y = sh * (6 - i);
        s += `<line x1="${fw}" x2="${W}" y1="${y}" y2="${y}" stroke="#77777f" stroke-width="${1 + (5 - i) * 0.15}"/>`;
        for (let f = 0; f <= 12; f++) {
          const pc = (open + f) % 12;
          if (!pcs.includes(pc)) continue;
          const x = f === 0 ? fw / 2 : fw * (f + 0.5);
          const isRoot = pc === ((root % 12) + 12) % 12;
          s += `<circle cx="${x}" cy="${y}" r="${sh * 0.42}" fill="${isRoot ? 'var(--hand)' : '#0a0a0c'}" stroke="var(--hand)" stroke-width="1.4"/>`;
        }
      });
      return `<svg class="fretmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Notes on the fretboard">${s}</svg>`;
    }

    function chordBox(shape, fam, root) {
      const W = 118, H = 140, left = 18, top = 26, sw = (W - left - 10) / 5, fh = 21;
      const fretted = shape.frets.filter((f) => f > 0);
      const hi = fretted.length ? Math.max(...fretted) : 0;
      const start = hi <= 5 ? 1 : Math.min(...fretted);
      const col = famVar(fam);
      let s = start === 1 ? `<rect x="${left - 1}" y="${top - 4}" width="${sw * 5 + 2}" height="4" fill="#eee"/>` : `<text x="${left - 5}" y="${top + fh * 0.65}" text-anchor="end" font-size="10" fill="#8d8d96">${start}</text>`;
      for (let f = 0; f <= 5; f++) s += `<line x1="${left}" x2="${left + sw * 5}" y1="${top + f * fh}" y2="${top + f * fh}" stroke="#55555e"/>`;
      for (let i = 0; i < 6; i++) s += `<line x1="${left + i * sw}" x2="${left + i * sw}" y1="${top}" y2="${top + fh * 5}" stroke="#9a9aa3" stroke-width="${1 + (5 - i) * 0.12}"/>`;
      if (shape.barre && shape.barre.fret >= start) {
        const y = top + (shape.barre.fret - start + 0.5) * fh;
        s += `<rect x="${left + shape.barre.from * sw - 7}" y="${y - 7}" width="${(shape.barre.to - shape.barre.from) * sw + 14}" height="14" rx="7" fill="${col}" opacity=".9"/>`;
      }
      shape.frets.forEach((f, i) => {
        const x = left + i * sw;
        if (f < 0) s += `<text x="${x}" y="${top - 10}" text-anchor="middle" font-size="11" fill="#8d8d96">×</text>`;
        else if (f === 0) s += `<circle cx="${x}" cy="${top - 14}" r="4" fill="none" stroke="#ddd" stroke-width="1.4"/>`;
        else {
          const y = top + (f - start + 0.5) * fh;
          const pc = (E.TUNING[i] + f) % 12;
          const isRoot = pc === ((root % 12) + 12) % 12;
          s += `<circle cx="${x}" cy="${y}" r="7.5" fill="${isRoot ? col : '#0a0a0c'}" stroke="${col}" stroke-width="2"/>`;
        }
        if (f >= 0) s += `<text x="${x}" y="${top + fh * 5 + 13}" text-anchor="middle" font-size="8.5" fill="#8d8d96">${E.name(E.TUNING[i] + f)}</text>`;
      });
      return `<svg class="chordbox" viewBox="0 0 ${W} ${H}" role="img" aria-label="Guitar shape ${shape.frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}">${s}</svg>`;
    }

    function render() {
      el.dataset.open = st.open;
      el.dataset.view = st.view;
      const head = (title, fam, sub) => `<div class="dock-head">
          <button class="dock-toggle" aria-expanded="${st.open}" aria-controls="dock-body">${st.open ? 'Hide' : 'Keys &amp; tab'}</button>
          <b class="f-${fam || 'other'}">${esc(title)}</b><span class="notes-mini">${esc(sub || '')}</span>
          <span class="dock-views">${['both', 'piano', 'guitar'].map((v) => `<button class="chip" data-dview="${v}" aria-pressed="${st.view === v}">${{ both: 'Both', piano: 'Piano', guitar: 'Guitar' }[v]}</button>`).join('')}</span></div>`;
      const info = st.info;
      if (!info) {
        el.innerHTML = head('Keys & tab', 'other', '') + `<div class="dock-body" id="dock-body"><p class="sub dock-empty">Play any chord and its piano keys and a guitar shape show up here.</p></div>`;
        return;
      }
      const pcs = Array.from(new Set((info.chord ? info.chord.pcs : info.midi).map((m) => ((m % 12) + 12) % 12)));
      const root = info.chord ? info.chord.root : info.root != null ? info.root : Math.min(...info.midi) % 12;
      const known = info.chord || (info.scale ? null : E.identify(pcs, Math.min(...info.midi)));
      const name = info.name || (known ? known.name : pcs.map((p) => E.name(p)).join(' '));
      const fam = known ? known.family : 'hand';
      const shapes = info.scale || pcs.length > 5 ? [] : E.guitarShapes(pcs, root);
      const alt = Math.min(st.alt, Math.max(0, shapes.length - 1));
      const sub = info.scale ? pcs.map((p) => E.name(p)).join(' ') : info.midi.slice().sort((a, b) => a - b).map((m) => E.name(m)).join(' ');
      let guitar;
      if (shapes.length) {
        const sh = shapes[alt];
        guitar = `<div class="guitar">${chordBox(sh, fam, root)}<div class="alts">
          <button class="btn" data-alt="-1" aria-label="Previous shape" ${alt === 0 ? 'disabled' : ''}>‹</button>
          <span class="notes-mini">${sh.frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}<br>${alt + 1} of ${shapes.length}</span>
          <button class="btn" data-alt="1" aria-label="Next shape" ${alt >= shapes.length - 1 ? 'disabled' : ''}>›</button></div></div>`;
      } else guitar = `<div class="guitar wide">${fretboardMap(pcs, root)}<span class="notes-mini">${info.scale ? 'Scale notes on the neck, root filled' : 'No comfortable single shape; here is every note on the neck'}</span></div>`;
      el.innerHTML = head(name, fam, sub) + `<div class="dock-body" id="dock-body"><div class="pianowrap">${piano(info.midi, fam)}</div>${guitar}</div>`;
    }

    E.onPlay = (info) => {
      // Single notes clicked on a scale don't replace the shown chord or scale.
      if (info.midi.length === 1 && st.info && !info.chord) return;
      const same = st.info && JSON.stringify(st.info.midi) === JSON.stringify(info.midi);
      st.info = info;
      if (!same) st.alt = 0;
      render();
    };
    el.addEventListener('click', (e) => {
      if (e.target.closest('.dock-toggle')) { st.open = !st.open; store.set('dock.open', st.open); render(); }
      const v = e.target.closest('[data-dview]');
      if (v) { st.view = v.dataset.dview; store.set('dock.view', st.view); render(); }
      const a = e.target.closest('[data-alt]');
      if (a && st.info) {
        st.alt = Math.max(0, st.alt + +a.dataset.alt);
        render();
        const pcs = Array.from(new Set((st.info.chord ? st.info.chord.pcs : st.info.midi).map((m) => ((m % 12) + 12) % 12)));
        const root = st.info.chord ? st.info.chord.root : st.info.root != null ? st.info.root : Math.min(...st.info.midi) % 12;
        const sh = E.guitarShapes(pcs, root)[st.alt];
        if (sh) E.playMidi(sh.midi, { strum: 0.045, quiet: true });
      }
      const k = e.target.closest('[data-key]');
      if (k) E.playMidi([+k.dataset.key], { strum: 0, vel: 0.3, quiet: true });
    });
    render();
    return { render };
  })();

  /* ---------- Router ---------- */
  const TITLES = { home: 'Callipari Lab', circle: 'The Mandala', proximity: 'Proximity Ladder', bridges: 'Bridge Finder', plr: 'PLR Tree', modes: 'Modal Map', extensions: 'Extension Board', voices: 'Four Voices' };
  function route() {
    const key = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
    const view = VIEWS[key] ? key : 'home';
    $$('.nav a').forEach((a) => (a.getAttribute('href') === '#/' + view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    try {
      const out = VIEWS[view]();
      const v = typeof out === 'string' ? { html: out } : out;
      main.innerHTML = v.html;
      if (v.mount) v.mount(main.firstElementChild);
    } catch (err) {
      console.error(err);
      main.innerHTML = `<section class="view"><div class="card empty">${ART.guitar}<h3>A string snapped</h3><p>Something went wrong drawing this page. Reload, or head back to the <a href="#/">start</a>.</p></div></section>`;
    }
    document.title = view === 'home' ? 'Callipari Lab' : TITLES[view] + ' · Callipari Lab';
    $('.side').classList.remove('open');
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  $('.menu-btn').addEventListener('click', () => { const s = $('.side'); s.classList.toggle('open'); $('.menu-btn').setAttribute('aria-expanded', s.classList.contains('open')); });
  route();
})();
