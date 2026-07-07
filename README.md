# Synth Gregorian — Plainsong Synthesizer

A web-based synthesizer that sings **Gregorian chant** in real time in the browser. No samples, no libraries — the singing voice itself is synthesized with the classic **source–filter (formant) technique** using only the Web Audio API.

**[Launch the app](https://brendanjameslynskey.github.io/Synth_Gregorian/)** — auto-detects your device and recommends desktop or mobile.

---

## The style

**Gregorian chant** (plainsong / plainchant) is the monophonic, unaccompanied sacred song of the Western Latin Church. A single melodic line is sung to Latin scripture in *free rhythm* — no harmony, no fixed beat. It took shape in the Carolingian empire of the 9th–10th centuries from a fusion of Roman and Gallican liturgical song, and was later attributed (by legend) to Pope Gregory I.

Its melodies move mostly by step within one of **eight church modes**, rising from a *finalis* to recite on a *tenor* (reciting tone) before cadencing home. Text is set either syllabically or spun into long melismatic **neumes** (podatus, clivis, torculus…). It is the seed from which all later Western music grew.

## How it sounds high quality

Rather than pure tones, the engine models the **human singing voice**:

- **Source** — a *glottal pulse*: a custom `PeriodicWave` whose harmonics roll off ≈ 12 dB/octave, like flow through vibrating vocal folds.
- **Filter** — a bank of **four parallel resonant band-pass formants** that shape the source into Latin vowels (a e i o u). Each singer keeps a persistent "vocal tract"; only the pitch changes from note to note, exactly as in real singing. Vowels morph continuously as the text unfolds.
- **Breath** — band-passed noise adds air and consonantal texture.
- **Ensemble** — a *schola* of detuned, jittered voices with independent vibrato, plus a large stone-**abbey convolution reverb** (~5 s tail with early reflections).

## Where it sits — the lineage of early Western music

Plainchant is the **root**. Everything else in this collection grows from it:

```
Plainsong ──► Organum ──► Ars Nova ──► (Renaissance polyphony)
   │  (a 2nd voice   (rhythmic
   │   is added)      sophistication)
   │
   └── its melodies became the fixed cantus firmus beneath centuries of polyphony
```

A parallel, secular, vernacular branch runs alongside it: **Troubadour** song → instrumental **Estampie** dances.

| App | Style | Synthesis technique |
|---|---|---|
| **Synth Gregorian** (this) | Plainsong | Source–filter formant vocal synthesis |
| [Synth Organum](https://github.com/BrendanJamesLynskey/Synth_Organum) | Notre-Dame polyphony | FOF vocal synthesis in Pythagorean just intonation |
| [Synth Ars Nova](https://github.com/BrendanJamesLynskey/Synth_ArsNova) | 14th-c. isorhythm | Formant vocal synthesis + isorhythmic talea/color |
| [Synth Troubadour](https://github.com/BrendanJamesLynskey/Synth_Troubadour) | Secular monophony | Formant vocal melody over a subtractive drone |
| [Synth Estampie](https://github.com/BrendanJamesLynskey/Synth_Estampie) | Medieval dance | Physical modelling (instrumental dance) |

## Quick start

```bash
git clone https://github.com/BrendanJamesLynskey/Synth_Gregorian.git
cd Synth_Gregorian
python3 -m http.server 8080
```

Open <http://localhost:8080> and press **Begin Chant**. Any static file server works — there is no build step or dependency.

## Files

| File | Purpose |
|---|---|
| `index.html` | Landing page — detects device, links to desktop or mobile |
| `desktop.html` | Desktop web app |
| `style.css` | Manuscript-themed styles (parchment, ink, gold) |
| `gregorian-engine.js` | Source–filter vocal synthesis engine (Web Audio API) |
| `app.js` | UI controller, stave visualizer, candle motes |
| `gregorian_mobile.html` | Self-contained mobile version (single file) |

## Controls

| Control | Description |
|---|---|
| **Mode** | One of the 8 church tones (Dorian → Hypomixolydian) |
| **Voice** | Overall vocal volume |
| **Breath** | Amount of airy noise in the voice |
| **Abbey Reverb** | Wet/dry mix of the stone-abbey convolution reverb |
| **Pace** | Speed of recitation |
| **Schola** | Cantor (1), Schola (3), or Full Choir (6) voices |

## License

MIT
