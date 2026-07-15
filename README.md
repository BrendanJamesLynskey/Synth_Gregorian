# Synth Gregorian — Plainsong Synthesizer

A web-based synthesizer that sings **Gregorian chant** in real time in the browser. The singing voice is now **real recorded singing**: the shared [`vocal-voices.js`](vocal-voices.js) library plays actual sung vowels from the [**VocalSet**](https://zenodo.org/records/1193957) corpus (CC BY 4.0), looped seamlessly and mapped across pitch with **formant-preserving pitch-shifting** (TD-PSOLA) so the vocal-tract resonances stay put as the note moves — no "chipmunk". (The library's earlier pure-synthesis engines, including IRCAM *CHANT*/FOF, remain available.)

> **Credit:** sampled voices derived from [**VocalSet**](https://zenodo.org/records/1193957) (Wilkins, Seetharaman, Wahl & Pardo, ISMIR 2018), CC BY 4.0.

**[Launch the app](https://brendanjameslynskey.github.io/Synth_Gregorian/)** — auto-detects your device and recommends desktop or mobile.

---

## The style

**Gregorian chant** (plainsong / plainchant) is the monophonic, unaccompanied sacred song of the Western Latin Church. A single melodic line is sung to Latin scripture in *free rhythm* — no harmony, no fixed beat. It took shape in the Carolingian empire of the 9th–10th centuries from a fusion of Roman and Gallican liturgical song, and was later attributed (by legend) to Pope Gregory I.

Its melodies move mostly by step within one of **eight church modes**, rising from a *finalis* to recite on a *tenor* (reciting tone) before cadencing home. Text is set either syllabically or spun into long melismatic **neumes** (podatus, clivis, torculus…). It is the seed from which all later Western music grew.

## How it sounds high quality

Rather than pure tones, the engine sings each monk with the shared **FOF vocal-synthesis** library ([`vocal-voices.js`](vocal-voices.js), default technique **FOF** — the IRCAM *CHANT* method):

- **FOF grains** — once per glottal period a burst of overlapping damped formant **grains** is fired (each formant a sine wrapped in an excitation envelope whose decay sets its bandwidth); overlapping them at the fundamental rate reconstructs a true, convincingly-sung vocal spectrum with real Latin-vowel formants (a e i o u). It runs sample-accurately in an `AudioWorklet`.
- **Persistent voice** — each monk is a persistent library voice with its own detune, breath and vibrato; only the pitch and vowel change from note to note, exactly as in real singing. Vowels morph continuously as the text unfolds.
- **Ensemble** — a *schola* of detuned, jittered voices, a soft limiter to hold the full choir, plus a large stone-**abbey convolution reverb** (~5 s tail with early reflections).

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
| **Synth Gregorian** (this) | Plainsong | FOF vocal synthesis (shared `vocal-voices.js` library) |
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
| `vocal-voices.js` | Shared library of interchangeable vocal-synthesis engines (FOF, formant, additive, vocal-tract) |
| `gregorian-engine.js` | Plainsong engine driving `vocal-voices.js` (Web Audio API) |
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
