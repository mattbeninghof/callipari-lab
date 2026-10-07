/* Callipari Lab engine: pitch math, chord and scale logic, and a small Web Audio synth.
   Works in the browser (window.Engine) and in Node (module.exports) for tests. */
(function (root) {
  'use strict';

  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  // Spelling used in the books' circle diagrams: flats on the left side, F# at the bottom.
  const BOOK = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  const mod = (n, m = 12) => ((n % m) + m) % m;
  const name = (pc, spelling = BOOK) => spelling[mod(pc)];

  function parseNote(str) {
    const m = /^([A-Ga-g])([#b]*)$/.exec(String(str).trim());
    if (!m) return null;
    let pc = SHARP.indexOf(m[1].toUpperCase());
    for (const ch of m[2]) pc += ch === '#' ? 1 : -1;
    return mod(pc);
  }

  // Chord qualities, keyed the way the books color them.
  const QUALITIES = {
    maj: { label: 'Major', suffix: '', iv: [0, 4, 7], family: 'maj' },
    min: { label: 'Minor', suffix: 'm', iv: [0, 3, 7], family: 'min' },
    dim: { label: 'Diminished', suffix: '°', iv: [0, 3, 6], family: 'dim' },
    aug: { label: 'Augmented', suffix: '+', iv: [0, 4, 8], family: 'aug' },
    dom7: { label: 'Dominant 7', suffix: '7', iv: [0, 4, 7, 10], family: 'dom' },
    dim7: { label: 'Diminished 7', suffix: '°7', iv: [0, 3, 6, 9], family: 'dim' },
    m7b5: { label: 'Half-diminished', suffix: 'ø', iv: [0, 3, 6, 10], family: 'dim' },
    maj7: { label: 'Major 7', suffix: 'maj7', iv: [0, 4, 7, 11], family: 'maj' },
    min7: { label: 'Minor 7', suffix: 'm7', iv: [0, 3, 7, 10], family: 'min' },
    sus2: { label: 'Sus 2', suffix: 'sus2', iv: [0, 2, 7], family: 'sus' },
    sus4: { label: 'Sus 4', suffix: 'sus4', iv: [0, 5, 7], family: 'sus' },
  };

  function chord(root, quality = 'maj') {
    const q = QUALITIES[quality];
    const r = mod(root);
    return {
      root: r,
      quality,
      family: q.family,
      pcs: q.iv.map((i) => mod(r + i)),
      name: name(r) + q.suffix,
      id: r + ':' + quality,
    };
  }

  function parseChord(str) {
    const m = /^([A-G][#b]?)(.*)$/.exec(String(str).trim());
    if (!m) return null;
    const root = parseNote(m[1]);
    const rest = m[2].replace('m7b5', 'ø').replace('dim7', '°7').replace('dim', '°').replace('o7', '°7').replace('aug', '+').replace('M7', 'maj7');
    const key = Object.keys(QUALITIES).find((k) => QUALITIES[k].suffix === rest);
    return key ? chord(root, key) : null;
  }

  // The chord set the first book works with: triads plus dominant sevenths.
  const BOOK_TYPES = ['maj', 'min', 'dim', 'aug', 'dom7'];
  function allChords(types = BOOK_TYPES) {
    const out = [];
    for (const t of types) for (let r = 0; r < 12; r++) out.push(chord(r, t));
    return out;
  }

  const shared = (a, b) => a.pcs.filter((p) => b.pcs.includes(p));

  /* Proximity range, after Illustrated Harmony: how near a chord feels to a home triad.
     Tiers: the home chord itself, chords sharing two notes, chords sharing one note
     (ordered by which home note: root, then fifth, then third, and by the role that
     note plays in the candidate), chords holding the home dominant's tritone, chords
     holding half of it, chords that only touch the home major scale, and finally the
     "best-worst" chords that share nothing at all. */
  const ROLE_ORDER = [0, 2, 1]; // root, fifth, third
  function roleOf(c, pc) {
    const i = c.pcs.indexOf(pc);
    return i === -1 ? 9 : i > 2 ? 3 : ROLE_ORDER.indexOf(i);
  }
  function proximity(home, candidate) {
    const h = home.pcs.slice(0, 3);
    const common = candidate.pcs.filter((p) => h.includes(p));
    const lead = mod(home.root + 11);
    const fourth = mod(home.root + 5);
    const hasLead = candidate.pcs.includes(lead);
    const hasFourth = candidate.pcs.includes(fourth);
    const scale = SCALES.ionian.iv.map((i) => mod(home.root + i));
    const sameSet = candidate.pcs.length === h.length && common.length === h.length;
    if (sameSet) return { tier: 1, label: 'Home', score: 100 };
    if (common.length >= 2) {
      return { tier: 2, label: 'Shares two or more', score: 90 - (common.includes(h[0]) ? 0 : 2) };
    }
    if (common.length === 1) {
      const which = [0, 2, 1].indexOf(h.indexOf(common[0])); // home root, then fifth, then third
      return { tier: 3 + which, label: 'Shares ' + name(common[0]), score: 80 - which * 8 - roleOf(candidate, common[0]) * 2 };
    }
    if (hasLead && hasFourth) return { tier: 6, label: 'Holds the tritone', score: 50 };
    if (hasFourth) return { tier: 7, label: 'Holds ' + name(fourth) + ' only', score: 44 - roleOf(candidate, fourth) * 2 };
    if (hasLead) return { tier: 8, label: 'Holds ' + name(lead) + ' only', score: 36 - roleOf(candidate, lead) * 2 };
    if (candidate.pcs.some((p) => scale.includes(p))) return { tier: 9, label: 'Touches the scale', score: 20 };
    return { tier: 10, label: 'Best-worst', score: 10 };
  }
  function proximityRange(home, types = BOOK_TYPES) {
    const seen = new Set();
    return allChords(types)
      .map((c) => (c.quality === 'aug' ? chord(home.root + mod(c.root - home.root) % 4, 'aug') : c))
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .map((c) => ({ chord: c, ...proximity(home, c) }))
      .sort((a, b) => b.score - a.score || a.chord.root - b.chord.root);
  }

  /* Neo-Riemannian transforms on major and minor triads. */
  function P(c) { return chord(c.root, c.quality === 'maj' ? 'min' : 'maj'); }
  function R(c) { return c.quality === 'maj' ? chord(c.root + 9, 'min') : chord(c.root + 3, 'maj'); }
  function L(c) { return c.quality === 'maj' ? chord(c.root + 4, 'min') : chord(c.root + 8, 'maj'); }
  // Compound moves that show up often in film harmony.
  const NR = {
    P: { fn: P, label: 'Parallel' },
    R: { fn: R, label: 'Relative' },
    L: { fn: L, label: 'Leading-tone' },
    N: { fn: (c) => P(L(R(c))), label: 'Nebenverwandt (RLP)' },
    S: { fn: (c) => R(P(L(c))), label: 'Slide (LPR)' },
    H: { fn: (c) => L(P(L(c))), label: 'Hexatonic pole (LPL)' },
  };

  // Shortest P/L/R path between two triads (breadth first over 24 chords).
  function nrPath(from, to) {
    const key = (c) => c.id;
    const seen = new Map([[key(from), null]]);
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      if (key(cur) === key(to)) {
        const path = [];
        let k = key(cur);
        while (seen.get(k)) { const s = seen.get(k); path.unshift(s.op); k = s.prev; }
        return path;
      }
      for (const op of ['P', 'L', 'R']) {
        const nx = NR[op].fn(cur);
        if (!seen.has(key(nx))) { seen.set(key(nx), { prev: key(cur), op }); q.push(nx); }
      }
    }
    return null;
  }

  /* Bartók axis system: each function owns two tritone pairs a minor third apart. */
  function bartokAxes(tonic) {
    const t = mod(tonic);
    const axis = (start) => [0, 3, 6, 9].map((i) => mod(start + i));
    return {
      tonic: axis(t),
      subdominant: axis(t + 5),
      dominant: axis(t + 7),
    };
  }

  /* Bridges: ways to reach a target chord, in the spirit of Illustrated Harmony. */
  function bridgesTo(target) {
    const t = target.root;
    const out = [
      { kind: 'Dominant (V7)', chords: [chord(t + 7, 'dom7')] },
      { kind: 'Tritone substitute (bII7)', chords: [chord(t + 1, 'dom7')] },
      { kind: 'Leading dim (vii°7)', chords: [chord(t + 11, 'dim7')] },
      { kind: 'Two-five', chords: [chord(t + 2, target.quality === 'min' ? 'm7b5' : 'min7'), chord(t + 7, 'dom7')] },
      { kind: 'Augmented push (V+)', chords: [chord(t + 7, 'aug')] },
      { kind: 'Backdoor (bVII7)', chords: [chord(t + 10, 'dom7')] },
      { kind: 'Minor plagal (iv)', chords: [chord(t + 5, 'min')] },
    ];
    return out;
  }

  function bridgeBetween(a, b) {
    const ideas = bridgesTo(b).map((br) => ({
      ...br,
      glue: shared(a, br.chords[0]).length,
    }));
    ideas.sort((x, y) => y.glue - x.glue);
    return ideas;
  }

  /* Scales and modes. Brightness ordering follows the cycle of fifths: each step down
     flattens one note. */
  const SCALES = {
    lydian: { label: 'Lydian', iv: [0, 2, 4, 6, 7, 9, 11], parent: 'Maj' },
    ionian: { label: 'Ionian', iv: [0, 2, 4, 5, 7, 9, 11], parent: 'Maj' },
    mixolydian: { label: 'Mixolydian', iv: [0, 2, 4, 5, 7, 9, 10], parent: 'Maj' },
    dorian: { label: 'Dorian', iv: [0, 2, 3, 5, 7, 9, 10], parent: 'Maj' },
    aeolian: { label: 'Aeolian', iv: [0, 2, 3, 5, 7, 8, 10], parent: 'Maj' },
    phrygian: { label: 'Phrygian', iv: [0, 1, 3, 5, 7, 8, 10], parent: 'Maj' },
    melodic: { label: 'Melodic minor', iv: [0, 2, 3, 5, 7, 9, 11], parent: 'ME' },
    dorianb2: { label: 'Dorian b2', iv: [0, 1, 3, 5, 7, 9, 10], parent: 'ME' },
    lydianb7: { label: 'Lydian b7', iv: [0, 2, 4, 6, 7, 9, 10], parent: 'ME' },
    mixob13: { label: 'Mixolydian b13', iv: [0, 2, 4, 5, 7, 8, 10], parent: 'ME' },
    harmonic: { label: 'Harmonic minor', iv: [0, 2, 3, 5, 7, 8, 11], parent: 'Ar' },
    dorian4: { label: 'Dorian #4', iv: [0, 2, 3, 6, 7, 9, 10], parent: 'Ar' },
    mixob9b13: { label: 'Mixolydian b9b13', iv: [0, 1, 4, 5, 7, 8, 10], parent: 'Ar' },
    lydian2: { label: 'Lydian #2', iv: [0, 3, 4, 6, 7, 9, 11], parent: 'Ar' },
  };
  const isMinorMode = (k) => SCALES[k].iv.includes(3) && !SCALES[k].iv.includes(4);
  const referenceOf = (k) => (isMinorMode(k) ? 'aeolian' : 'ionian');

  // Two modes are linked on the modal map when their scales differ by exactly one note.
  function modeDiff(a, b) {
    const A = SCALES[a].iv, B = SCALES[b].iv;
    return A.filter((x) => !B.includes(x));
  }
  function modeLinks() {
    const keys = Object.keys(SCALES), out = [];
    keys.forEach((a, i) => keys.slice(i + 1).forEach((b) => { if (modeDiff(a, b).length === 1) out.push([a, b]); }));
    return out;
  }
  // Characteristic notes: degrees that differ from the reference mode (Ionian or Aeolian).
  function characteristic(k) {
    const ref = SCALES[referenceOf(k)].iv;
    return k === referenceOf(k) ? [] : SCALES[k].iv.filter((x) => !ref.includes(x));
  }
  /* Composing kit: harmonize, drop diminished chords and chords that hold a tritone,
     drop chords shared with the reference mode, keep the tonic. */
  function modeKit(root, k) {
    const chords = harmonize(root, k);
    const refChords = harmonize(root, referenceOf(k)).map((c) => c.id);
    const tri = (c) => c.pcs.some((p) => c.pcs.includes(mod(p + 6)));
    return chords.filter((c, i) => i === 0 || (c.family !== 'dim' && c.family !== 'other' && !tri(c) && !refChords.includes(c.id)));
  }

  const brightness = (iv) => iv.reduce((s, x) => s + x, 0);

  function scaleNotes(root, key) { return SCALES[key].iv.map((i) => mod(root + i)); }

  function triadQuality(pcs) {
    const a = mod(pcs[1] - pcs[0]), b = mod(pcs[2] - pcs[0]);
    if (a === 4 && b === 7) return 'maj';
    if (a === 3 && b === 7) return 'min';
    if (a === 3 && b === 6) return 'dim';
    if (a === 4 && b === 8) return 'aug';
    if (a === 2 && b === 7) return 'sus2';
    if (a === 5 && b === 7) return 'sus4';
    return null;
  }

  // Stack every other note of a 7-note scale.
  function harmonize(root, key, size = 3) {
    const notes = scaleNotes(root, key);
    return notes.map((n, i) => {
      const pcs = [0, 2, 4, 6].slice(0, size).map((s) => notes[(i + s) % 7]);
      const q3 = triadQuality(pcs);
      let q = q3;
      if (size === 4) {
        const sev = mod(pcs[3] - pcs[0]);
        q = { 'maj:11': 'maj7', 'maj:10': 'dom7', 'min:10': 'min7', 'dim:10': 'm7b5', 'dim:9': 'dim7' }[q3 + ':' + sev] || q3;
      }
      return q ? chord(n, q) : { root: n, pcs, name: name(n) + '?', family: 'other', id: n + ':?' };
    });
  }

  // Step pattern in whole (1) and half (1/2) steps, the square notation of Illustrated Modes.
  function steps(iv) {
    const full = iv.concat(12);
    return full.slice(1).map((x, i) => x - full[i]);
  }

  /* Extensions: tension notes on top of a chord, labelled by interval from the root. */
  const TENSIONS = [
    { label: 'b9', iv: 1 }, { label: '9', iv: 2 }, { label: '#9', iv: 3 },
    { label: '11', iv: 5 }, { label: '#11', iv: 6 },
    { label: 'b13', iv: 8 }, { label: '13', iv: 9 },
  ];
  // A tension avoids clashing when it isn't a half step above a chord tone.
  function tensionClash(c, iv) {
    const pc = mod(c.root + iv);
    return c.pcs.some((p) => mod(pc - p) === 1);
  }

  // Harmonic series: partial n of a fundamental, folded to the nearest pitch class.
  function harmonics(fundamentalPc, count = 16) {
    const out = [];
    for (let n = 1; n <= count; n++) {
      const cents = 1200 * Math.log2(n);
      const semis = cents / 100;
      const nearest = Math.round(semis);
      out.push({ n, pc: mod(fundamentalPc + nearest), cents: Math.round((semis - nearest) * 100), octave: Math.floor(nearest / 12) });
    }
    return out;
  }


  /* Magic Glue Index (Illustrated Harmony 2): familiarity between two triads. */
  function glueIndex(a, b, keyRoot) {
    const common = shared(a, b).length;
    const scale = SCALES.ionian.iv.map((i) => mod(keyRoot + i));
    const inScale = (c) => c.pcs.every((p) => scale.includes(p));
    const same = inScale(a) && inScale(b);
    if (a.id === b.id) return { value: 1, label: 'Identical' };
    if (common >= 3) return { value: 1, label: 'Same notes' };
    if (common === 2) return same ? { value: 2 / 3, label: 'Two shared notes, same scale' } : { value: 0.5, label: 'Two shared notes, one note leaves the scale' };
    if (common === 1) return same ? { value: 1 / 3, label: 'One shared note, same scale' } : { value: 0.2, label: 'One shared note, different scales' };
    return { value: 0, label: 'Nothing shared' };
  }

  /* PLR generations from a starting triad: first appearance of each chord. */
  function plrGenerations(start, depth = 5) {
    const gens = [[start]];
    const seen = new Set([start.id]);
    for (let g = 1; g <= depth; g++) {
      const next = [];
      for (const c of gens[g - 1]) for (const op of ['P', 'R', 'L']) {
        const n = NR[op].fn(c);
        if (!seen.has(n.id)) { seen.add(n.id); next.push({ ...n, from: c.id, op }); }
      }
      next.sort((x, y) => x.root - y.root);
      gens.push(next);
    }
    return gens;
  }

  /* Interval web: every pair of notes, flagged the way the Arrangements book colors them. */
  function intervalWeb(pcs) {
    const out = [];
    for (let i = 0; i < pcs.length; i++) for (let j = i + 1; j < pcs.length; j++) {
      const ic = Math.min(mod(pcs[j] - pcs[i]), mod(pcs[i] - pcs[j]));
      out.push({ a: pcs[i], b: pcs[j], ic, kind: ic === 1 ? 'b9' : ic === 6 ? 'tritone' : 'ok' });
    }
    return out;
  }

  /* Extension availability on a diatonic chord, with the "rescue" of b/# forms. */
  const EXT_TEETH = [
    { label: 'b9', iv: 1, deg: 9 }, { label: '9', iv: 2, deg: 9 }, { label: '#9', iv: 3, deg: 9 },
    { label: 'b11', iv: 4, deg: 11 }, { label: '11', iv: 5, deg: 11 }, { label: '#11', iv: 6, deg: 11 },
    { label: 'b13', iv: 8, deg: 13 }, { label: '13', iv: 9, deg: 13 }, { label: '#13', iv: 10, deg: 13 },
  ];
  function extensionStatus(c, keyRoot) {
    const scale = SCALES.ionian.iv.map((i) => mod(keyRoot + i));
    const third = c.pcs[1];
    return EXT_TEETH.map((t) => {
      const pc = mod(c.root + t.iv);
      let reason = null;
      if (c.pcs.includes(pc)) reason = 'Already a chord tone';
      else if (t.iv === 10) reason = 'Same note as the b7, a seventh rather than an extension';
      else if (!scale.includes(pc)) reason = 'Outside the key';
      else if (c.pcs.some((p) => mod(pc - p) === 1)) reason = 'A b9 above ' + name(c.pcs.find((p) => mod(pc - p) === 1));
      else if (c.family !== 'dom' && Math.min(mod(pc - third), mod(third - pc)) === 6) reason = 'Tritone with the 3rd';
      return { ...t, pc, ok: !reason, reason };
    });
  }

  /* Polychords: two triads stacked, scored by semitone (b9) and tritone clashes. */
  function polychord(lower, upper) {
    const pcs = Array.from(new Set(lower.pcs.concat(upper.pcs)));
    let b9 = 0, tt = 0;
    for (const a of lower.pcs) for (const b of upper.pcs) {
      const ic = Math.min(mod(a - b), mod(b - a));
      if (ic === 1) b9++;
      if (ic === 6) tt++;
    }
    return { pcs, b9, tt, tension: b9 * 2 + tt };
  }

  /* Four-voice pad: bass on the root, three upper voices voice-led with the books' pad rules
     (double the root of a triad, drop the fifth of a four-note chord, no crossing,
     keep common tones, avoid parallel fifths and octaves). */
  function satb(chords) {
    const out = [];
    let prev = null;
    for (const c of chords) {
      const pool = c.pcs.length >= 4 ? [c.pcs[0], c.pcs[1], c.pcs[3]] : [c.pcs[0], c.pcs[1], c.pcs[2]];
      const basses = [];
      for (let m = 38; m <= 55; m++) if (mod(m) === c.root) basses.push(m);
      const range = [];
      for (let m = 53; m <= 79; m++) if (pool.includes(mod(m))) range.push(m);
      let best = null;
      for (const bass of basses) for (let i = 0; i < range.length; i++) for (let j = i + 1; j < range.length; j++) for (let k = j + 1; k < range.length; k++) {
        const up = [range[i], range[j], range[k]];
        const set = new Set(up.map((m) => mod(m)));
        if (!pool.every((p) => set.has(p)) && !(c.pcs.length === 3 && set.size === 2 && set.has(c.pcs[0]) && set.has(c.pcs[1]))) continue;
        if (up[2] - up[0] > 15 || up[0] <= bass || up[0] - bass > 24) continue;
        const v = [bass, up[2], up[1], up[0]];
        let cost = set.size < 3 ? 3 : 0;
        if (prev) {
          for (let x = 0; x < 4; x++) cost += Math.abs(v[x] - prev[x]) * (x === 0 ? 0.35 : 1);
          for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
            const i1 = mod(prev[a] - prev[b]), i2 = mod(v[a] - v[b]);
            if ((i1 === 7 || i1 === 0) && i1 === i2 && prev[a] !== v[a]) cost += 40;
          }
          const dirs = v.map((m, x) => Math.sign(m - prev[x]));
          if (dirs.every((d) => d === dirs[0]) && dirs[0] !== 0) cost += 12;
          for (let x = 1; x < 4; x++) if (Math.abs(v[x] - prev[x]) > 7) cost += 10;
        } else cost += Math.abs(up[2] - 72) + Math.abs(bass - 48);
        if (!best || cost < best.cost) best = { v, cost };
      }
      const v = best ? best.v : [48 + c.root].concat(voice(c, 60).slice(0, 3).reverse());
      out.push(v); // [bass, soprano, alto, tenor]
      prev = v;
    }
    return out.map((v) => ({ s: v[1], a: v[2], t: v[3], b: v[0] }));
  }

  // Rule check over a four-voice result.
  function satbCheck(rows) {
    const issues = [];
    const V = ['s', 'a', 't', 'b'];
    const names = { s: 'Soprano', a: 'Alto', t: 'Tenor', b: 'Bass' };
    rows.forEach((r, i) => {
      if (!(r.s > r.a && r.a > r.t && r.t > r.b)) issues.push({ at: i, kind: 'bad', text: 'Voices cross or collide' });
      if (i === 0) return;
      const p = rows[i - 1];
      for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) {
        const a = V[x], b = V[y];
        const i1 = mod(p[a] - p[b]), i2 = mod(r[a] - r[b]);
        if (p[a] !== r[a] && p[b] !== r[b] && i1 === i2 && (i1 === 7 || i1 === 0)) issues.push({ at: i, kind: 'warn', text: 'Parallel ' + (i1 ? 'fifths' : 'octaves') + ': ' + names[a] + ' and ' + names[b] });
      }
      for (const v of V) if (v !== 'b' && Math.abs(r[v] - p[v]) > 7) issues.push({ at: i, kind: 'warn', text: names[v] + ' leaps ' + Math.abs(r[v] - p[v]) + ' semitones' });
      const moves = V.slice(0, 3).map((v) => Math.sign(r[v] - p[v]));
      if (moves.every((m) => m === moves[0]) && moves[0] !== 0 && Math.sign(r.b - p.b) === moves[0]) issues.push({ at: i, kind: 'warn', text: 'All four voices move the same way' });
    });
    return issues;
  }

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // Close voicing above a given MIDI floor, root at the bottom.
  function voice(c, floor = 52) {
    let base = floor + mod(c.root - floor);
    if (base - floor > 6) base -= 12;
    const out = [];
    let prev = base - 1;
    for (const pc of c.pcs) {
      let m = prev + 1 + mod(pc - (prev + 1));
      out.push(m);
      prev = m;
    }
    return out;
  }

  // Voice-lead the next chord by moving each voice to the nearest available tone.
  function voiceLead(prevMidi, c) {
    if (!prevMidi || !prevMidi.length) return voice(c);
    const center = prevMidi.reduce((s, x) => s + x, 0) / prevMidi.length;
    const options = [];
    for (let inv = 0; inv < c.pcs.length; inv++) {
      const pcs = c.pcs.slice(inv).concat(c.pcs.slice(0, inv));
      for (let lo = 40; lo < 72; lo++) {
        if (mod(lo) !== pcs[0]) continue;
        const v = [lo];
        for (const pc of pcs.slice(1)) { let m = v[v.length - 1] + 1; while (mod(m) !== pc) m++; v.push(m); }
        const mid = v.reduce((s, x) => s + x, 0) / v.length;
        options.push({ v, cost: Math.abs(mid - center) });
      }
    }
    options.sort((a, b) => a.cost - b.cost);
    return options[0].v;
  }


  /* ---------- Guitar ---------- */
  const TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4, low string first

  /* Playable shapes for a set of pitch classes in standard tuning. A shape lists one fret
     per string (-1 = muted). Rules: the lowest sounding note is the root, every required
     note is present (the fifth is optional once a chord has four or more notes), at most
     four fingers with a barre on the lowest fret, and a span of four frets. Ranked toward
     full, low, open shapes. */
  const shapeCache = new Map();
  function guitarShapes(pcsIn, root, max = 8) {
    const pcs = Array.from(new Set(pcsIn.map((p) => mod(p))));
    const key = pcs.slice().sort((a, b) => a - b).join(',') + '/' + mod(root);
    if (shapeCache.has(key)) return shapeCache.get(key);
    const r = mod(root);
    const optional = pcs.length >= 4 ? [mod(r + 7)] : [];
    const required = pcs.filter((p) => !optional.includes(p));
    const found = new Map();
    for (let base = 0; base <= 12; base++) {
      const opts = TUNING.map((open) => {
        const o = [-1];
        if (base <= 4 && pcs.includes(mod(open))) o.push(0);
        for (let f = Math.max(1, base); f <= base + 3; f++) if (pcs.includes(mod(open + f))) o.push(f);
        return o;
      });
      const pick = new Array(6);
      const walk = (si) => {
        if (si < 6) { for (const f of opts[si]) { pick[si] = f; walk(si + 1); } return; }
        const sounding = pick.map((f, i) => (f < 0 ? null : TUNING[i] + f));
        const idx = sounding.map((m, i) => (m == null ? -1 : i)).filter((i) => i >= 0);
        if (idx.length < Math.min(3, pcs.length)) return;
        if (mod(sounding[idx[0]]) !== r) return;
        const have = new Set(idx.map((i) => mod(sounding[i])));
        if (!required.every((p) => have.has(p))) return;
        const fretted = pick.filter((f) => f > 0);
        const lo = fretted.length ? Math.min(...fretted) : 0, hi = fretted.length ? Math.max(...fretted) : 0;
        if (hi - lo > 3) return;
        // Barre at the lowest fret when it covers strings with nothing open or muted in between.
        const atLo = pick.map((f, i) => (f === lo && lo > 0 ? i : -1)).filter((i) => i >= 0);
        let barre = null;
        if (atLo.length >= 2) {
          const a = atLo[0], b = atLo[atLo.length - 1];
          if (pick.slice(a, b + 1).every((f) => f >= lo)) barre = { fret: lo, from: a, to: b };
        }
        let fingers = barre ? 1 + fretted.filter((f) => f > lo).length : fretted.length;
        // Three or more neighboring strings on one higher fret can share a finger.
        for (let i = 0; i + 2 < 6; i++) {
          const f = pick[i];
          if (f > lo && pick[i + 1] === f && pick[i + 2] === f) { let n = 3; while (i + n < 6 && pick[i + n] === f) n++; fingers -= n - 1; i += n - 1; }
        }
        if (fingers > 4) return;
        const innerMutes = pick.slice(idx[0], idx[idx.length - 1] + 1).filter((f) => f < 0).length;
        const opens = pick.filter((f) => f === 0).length;
        const score = idx.length * 3 - innerMutes * 5 - lo * 0.9 - fingers * 0.6 + (lo <= 3 ? opens * 0.8 : 0) - (hi - lo) * 0.3 + have.size - hi * 0.3 - (hi >= 4 ? opens * 4 : 0);
        const id = pick.join(',');
        if (!found.has(id)) found.set(id, { frets: pick.slice(), barre, fingers, score, midi: idx.map((i) => sounding[i]) });
      };
      walk(0);
    }
    // Keep the best shape per neck position so the alternatives move up the neck.
    const ranked = Array.from(found.values()).sort((a, b) => b.score - a.score);
    const out = [];
    for (const s of ranked) {
      const pos = Math.min(...s.frets.filter((f) => f > 0).concat(99));
      if (out.some((o) => Math.abs(Math.min(...o.frets.filter((f) => f > 0).concat(99)) - pos) < 2 && o.score - s.score < 6)) continue;
      out.push(s);
      if (out.length >= max) break;
    }
    shapeCache.set(key, out);
    return out;
  }

  // Name a pitch-class set as a known chord, if it is one.
  function identify(pcs, bassPc) {
    const set = Array.from(new Set(pcs.map((p) => mod(p))));
    const tryRoots = bassPc == null ? set : [mod(bassPc)].concat(set.filter((p) => p !== mod(bassPc)));
    for (const r of tryRoots) for (const q of Object.keys(QUALITIES)) {
      const c = chord(r, q);
      if (c.pcs.length === set.length && c.pcs.every((p) => set.includes(p))) return c;
    }
    return null;
  }


  /* ---------- MIDI export ---------- */
  /* Standard MIDI File, format 1, 480 ticks per beat. tracks: [{ name, channel, program,
     notes: [{ midi, start, dur, vel }] }] with start and dur in beats. markers: [{ beat, text }]
     land on the tempo track so DAWs show chord names on the timeline. */
  function midiFile(tracks, { bpm = 100, markers = [], title = 'Sketch' } = {}) {
    const PPQ = 480;
    const vlq = (n) => {
      const out = [n & 0x7f];
      while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
      return out;
    };
    const text = (str) => Array.from(unescape(encodeURIComponent(str))).map((ch) => ch.charCodeAt(0));
    const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const chunk = (events) => {
      events.sort((a, b) => a.t - b.t || a.order - b.order);
      const body = [];
      let last = 0;
      for (const e of events) { body.push(...vlq(e.t - last), ...e.data); last = e.t; }
      body.push(0, 0xff, 0x2f, 0);
      return [0x4d, 0x54, 0x72, 0x6b, ...u32(body.length), ...body];
    };
    const tick = (beats) => Math.max(0, Math.round(beats * PPQ));
    const meta = (type, bytes) => [0xff, type, ...vlq(bytes.length), ...bytes];
    const tempo = Math.round(60000000 / bpm);
    const conductor = [
      { t: 0, order: 0, data: meta(0x03, text(title)) },
      { t: 0, order: 1, data: meta(0x51, [(tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255]) },
      { t: 0, order: 2, data: meta(0x58, [4, 2, 24, 8]) },
      ...markers.map((m) => ({ t: tick(m.beat), order: 3, data: meta(0x06, text(m.text)) })),
    ];
    const chunks = [chunk(conductor)];
    for (const tr of tracks) {
      const ch = (tr.channel ?? 0) & 15;
      const ev = [
        { t: 0, order: 0, data: meta(0x03, text(tr.name || 'Track')) },
        { t: 0, order: 1, data: [0xc0 | ch, (tr.program ?? 0) & 127] },
      ];
      for (const n of tr.notes) {
        const on = tick(n.start), off = Math.max(on + 1, tick(n.start + n.dur));
        ev.push({ t: on, order: 3, data: [0x90 | ch, n.midi & 127, Math.max(1, Math.min(127, n.vel ?? 90))] });
        ev.push({ t: off, order: 2, data: [0x80 | ch, n.midi & 127, 0] });
      }
      chunks.push(chunk(ev));
    }
    const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, chunks.length, (PPQ >> 8) & 255, PPQ & 255];
    return new Uint8Array(header.concat(...chunks));
  }

  /* ---------- Audio ---------- */
  let ctx = null, master = null, verb = null;
  function audio() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    // Short synthetic room.
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = buf;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    verb.connect(wet).connect(master);
    return ctx;
  }

  function pluck(midi, when, dur, vel = 0.22) {
    const a = audio();
    if (!a) return;
    const t = when ?? a.currentTime;
    const f = freq(midi);
    const g = a.createGain();
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(8000, f * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [type, det, lvl] of [['triangle', 0, 1], ['sawtooth', 4, 0.18], ['sine', -3, 0.6]]) {
      const o = a.createOscillator();
      const og = a.createGain();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = det;
      og.gain.value = lvl;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    lp.connect(g);
    g.connect(master);
    g.connect(verb);
  }

  function playMidi(notes, opts = {}) {
    const a = audio();
    if (!a) return;
    if (a.state === 'suspended') a.resume();
    const t = (opts.at ?? a.currentTime) + 0.02;
    const strum = opts.strum ?? 0.025;
    notes.forEach((m, i) => pluck(m, t + i * strum, opts.dur ?? 1.6, (opts.vel ?? 0.2) / Math.sqrt(notes.length)));
    if (!opts.quiet) emit({ midi: notes.slice(), chord: opts.chord || null, name: opts.name || null, root: opts.root }, t - a.currentTime);
  }

  // Tell listeners (the keys and tab dock) what is sounding, in time with the audio.
  function emit(info, delay) {
    const fn = Engine.onPlay;
    if (!fn) return;
    if (delay > 0.05) setTimeout(() => fn(info), delay * 1000);
    else fn(info);
  }

  // Additive tone from raw frequencies with per-partial levels (for the harmonic series).
  function playFreqs(list, dur = 2.4) {
    const a = audio();
    if (!a) return;
    if (a.state === 'suspended') a.resume();
    const t = a.currentTime + 0.02;
    for (const { f, level } of list) {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.25), t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
  const audioOk = () => !!(root.AudioContext || root.webkitAudioContext);

  function playChord(c, opts = {}) { playMidi(opts.midi ? opts.midi : voice(c), { ...opts, chord: c }); }

  function playSequence(chords, opts = {}) {
    const a = audio();
    if (!a) return 0;
    const gap = opts.gap ?? 0.9;
    let prev = null;
    chords.forEach((c, i) => {
      const v = voiceLead(prev, c);
      prev = v;
      playMidi(v, { at: a.currentTime + i * gap, dur: gap * 1.6, strum: 0.02, chord: c });
    });
    return chords.length * gap;
  }

  function playScale(pcs, root, opts = {}) {
    const a = audio();
    if (!a) return;
    const gap = opts.gap ?? 0.22;
    const base = 60 + mod(root);
    const midi = pcs.map((pc) => base + mod(pc - root)).concat(base + 12);
    midi.forEach((m, i) => playMidi([m], { at: a.currentTime + i * gap, dur: 0.9, strum: 0, vel: 0.28, quiet: true }));
    emit({ midi, scale: true, root, name: opts.name || null }, 0);
  }

  const Engine = {
    onPlay: null,
    SHARP, FLAT, BOOK, QUALITIES, BOOK_TYPES, SCALES, TENSIONS, NR,
    mod, name, parseNote, chord, parseChord, allChords, shared,
    proximity, proximityRange, P, L, R, nrPath, bartokAxes, bridgesTo, bridgeBetween,
    brightness, scaleNotes, isMinorMode, referenceOf, modeDiff, modeLinks, characteristic, modeKit, harmonize, triadQuality, steps, tensionClash, harmonics,
    glueIndex, plrGenerations, intervalWeb, EXT_TEETH, extensionStatus, polychord, satb, satbCheck,
    TUNING, guitarShapes, identify, midiFile,
    freq, voice, voiceLead, playMidi, playFreqs, audioOk, playChord, playSequence, playScale,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
