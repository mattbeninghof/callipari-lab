// Run with: node test/engine.test.js, or open test/index.html in a browser
const E = require('../engine.js');
let pass = 0, fail = 0;
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) pass++;
  else { fail++; console.error('FAIL', msg, '\n  got     ', a, '\n  expected', b); }
}
const C = E.chord(0, 'maj');
const tierOf = (s) => E.proximity(C, E.parseChord(s)).tier;

eq(E.parseNote('Db'), 1, 'parse flat');
eq(E.parseNote('F#'), 6, 'parse sharp');
eq(E.parseChord('G7').pcs, [7, 11, 2, 5], 'G7 notes');
eq(E.parseChord('Bdim').name, 'B°', 'dim naming');

eq(tierOf('C'), 1, 'home');
eq(['Cm', 'Em', 'Am', 'C+'].map(tierOf), [2, 2, 2, 2], 'two shared notes');
eq(['F', 'Fm', 'Ab'].map(tierOf), [3, 3, 3], 'shares C');
eq(['G', 'Gm', 'Eb'].map(tierOf), [4, 4, 4], 'shares G');
eq(['E', 'A', 'Dbm'].map(tierOf), [5, 5, 5], 'shares E');
eq(['Bdim', 'Fdim'].map(tierOf), [6, 6], 'tritone chords');
eq(['Bb', 'Dm', 'Db'].map(tierOf), [7, 7, 7], 'F only');
eq(['B', 'Bm', 'Abm'].map(tierOf), [8, 8, 8], 'B only');
eq(tierOf('D'), 9, 'touches scale');
eq(['F#', 'Ebm'].map(tierOf), [10, 10], 'best-worst chords');
eq(E.proximityRange(C).filter((r) => r.chord.quality === 'aug').length, 4, 'augmented chords deduplicated');

eq(E.P(C).name, 'Cm', 'P');
eq(E.R(C).name, 'Am', 'R');
eq(E.L(C).name, 'Em', 'L');
eq(E.nrPath(C, E.chord(8, 'min')).length, 3, 'C to Abm takes three moves');
eq(E.bartokAxes(0).dominant, [7, 10, 1, 4], 'Bartok dominant axis');

eq(E.steps(E.SCALES.ionian.iv), [2, 2, 1, 2, 2, 2, 1], 'major steps');
eq(E.harmonize(0, 'ionian').map((c) => c.name), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'], 'harmonize C major');
eq(E.harmonize(0, 'ionian', 4)[4].name, 'G7', 'seventh chords');
eq(E.harmonize(0, 'harmonic').map((c) => c.quality)[2], 'aug', 'harmonic minor III+');
const order = ['lydian', 'ionian', 'mixolydian', 'dorian', 'aeolian', 'phrygian'];
eq(order.map((k) => E.brightness(E.SCALES[k].iv)).every((b, i, a) => i === 0 || b < a[i - 1]), true, 'brightness ordering');
eq(E.harmonics(0, 5).map((h) => h.pc), [0, 0, 7, 0, 4], 'harmonic series');
eq(E.tensionClash(C, 5), true, '11 clashes on major');
eq(E.tensionClash(C, 2), false, '9 is fine');
const v = E.voiceLead([60, 64, 67], E.chord(5, 'maj'));
eq(v.reduce((s, x) => s + x, 0) / 3 < 68 && v.reduce((s, x) => s + x, 0) / 3 > 60, true, 'voice leading stays close');

eq(Object.keys(E.SCALES).length, 14, 'fourteen modes');
eq(E.modeLinks().length, 20, 'twenty one-note links on the modal map');
eq(E.modeLinks().filter((l) => l.includes('lydian2')).length, 1, 'Lydian #2 is a dead end');
eq(E.characteristic('lydian'), [6], 'Lydian characteristic note');
eq(E.modeKit(0, 'lydian').map((c) => c.name), ['C', 'D', 'Bm'], 'Lydian kit');
eq(E.modeKit(0, 'dorian').map((c) => c.name), ['Cm', 'Dm', 'F'], 'Dorian kit');
eq(E.plrGenerations(C)[1].map((c) => c.name), ['Cm', 'Em', 'Am'], 'PLR generation 1');
eq(E.plrGenerations(C)[5].map((c) => c.name), ['Bbm'], 'Bbm is the farthest chord');
eq(E.glueIndex(C, E.parseChord('Em'), 0).value, 2 / 3, 'glue C to Em');
eq(E.glueIndex(C, E.parseChord('F#'), 0).value, 0, 'glue C to F#');
const avail = (s, k = 0) => E.extensionStatus(E.parseChord(s), k).filter((x) => x.ok).map((x) => x.label);
eq(avail('C'), ['9', '13'], 'extensions on C');
eq(avail('Dm'), ['9', '11'], 'extensions on Dm');
eq(avail('Em'), ['11'], 'extensions on Em');
eq(avail('F'), ['9', '#11', '13'], 'extensions on F');
eq(avail('G7'), ['9', '13'], 'extensions on G7');
eq(avail('Am'), ['9', '11'], 'extensions on Am');
const pc = E.polychord(E.parseChord('C'), E.parseChord('Db'));
eq([pc.b9, pc.tt], [3, 1], 'C over Db clashes');
const rows = E.satb(['C', 'Am', 'F', 'G7', 'C'].map(E.parseChord));
eq(rows.every((r) => r.s > r.a && r.a > r.t && r.t > r.b), true, 'four voices never cross');
eq(E.satbCheck(rows).filter((x) => x.kind === 'bad').length, 0, 'no crossing flags');
for (const p of ['C E7 Am D7 G7 C', 'Cmaj7 G G7 Cmaj7', 'Am Dm E7 Am', 'C Ab Bb C']) {
  eq(E.satbCheck(E.satb(p.split(' ').map(E.parseChord))).length, 0, 'clean voice leading for ' + p);
}
const shape = (n) => { const c = E.parseChord(n); return E.guitarShapes(c.pcs, c.root)[0].frets.map((f) => (f < 0 ? 'x' : f)).join(''); };
eq(shape('C'), 'x32010', 'guitar C');
eq(shape('Am'), 'x02210', 'guitar Am');
eq(shape('E'), '022100', 'guitar E');
eq(shape('G'), '320003', 'guitar G');
eq(shape('D'), 'xx0232', 'guitar D');
eq(shape('F'), '133211', 'guitar F barre');
eq(shape('G7'), '320001', 'guitar G7');
eq(E.guitarShapes(E.parseChord('Bb').pcs, 10).length > 2, true, 'alternatives up the neck');
eq(E.identify([0, 4, 7, 10], 0).name, 'C7', 'identify C7');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
