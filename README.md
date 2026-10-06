# Callipari Lab

A playable, unofficial companion to Brian Callipari's illustrated music theory books
(*Illustrated Harmony*, *Illustrated Harmony 2*, *Illustrated Modes*, *Illustrated Chord
Extensions* and *Arrangements Illustrated*). The books explain harmony with colored circles,
arrows and squares. This app redraws those ideas as diagrams you can click and hear.

**Live:** https://mattbeninghof.github.io/callipari-lab/

## Tools

| Tool | From | What it does |
| --- | --- | --- |
| The Mandala | Illustrated Harmony | Circle of fifths with layers for keys, the chain of dominants, tritone subs, dim axes and aug cycles. Rotate the home key to transpose. |
| Proximity Ladder | Illustrated Harmony | Ranks every triad and dominant from near to far against a home chord: shared notes, then tritone notes, then the "best-worst" chords. |
| Bridge Finder | Harmony 1 and 2 | Magic Glue Index between two chords, the shortest P/L/R walk, Bartók axis check and ranked bridge progressions. |
| PLR Tree | Illustrated Harmony 2 | Neo-Riemannian generations from any triad, a P/R/L/N/S/H walker, and Bartók axes. |
| Modal Map | Illustrated Modes | Fourteen modes linked by one-note differences, square notation with raised and sunken notes, and a composing kit per mode. |
| Extension Board | Illustrated Chord Extensions | Which 9ths, 11ths and 13ths each chord in a key can take, an interval web, the harmonic series and a polychord calculator. |
| Four Voices | Arrangements Illustrated | Type a progression, compare block chords with a voice-led four-part pad, and see a rule check. |

Color code, as in the books: pink major, light blue minor, yellow dominant, purple diminished, green augmented.

## Running

It is a static site with no build step and no dependencies. Serve the folder with any static server:

```
python3 -m http.server 8765
```

Tests for the theory engine: open `test/index.html` in a browser, or run `node test/engine.test.js`.

## Files

- `index.html`: shell and navigation
- `engine.js`: pitch math, chord, scale and voicing logic, plus a small Web Audio synth
- `app.js`: the views
- `app.css`: styles
- `test/`: engine tests

## Credit

All the ideas belong to Brian Callipari. This project contains no text or images from the books;
every diagram is generated from the concepts. If you find it useful, buy the books from the author.
