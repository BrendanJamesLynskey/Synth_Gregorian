# Synth Gregorian — Plainsong Synthesizer

A web-based synthesizer that sings **Gregorian chant** in real time in the browser. The singing voice is **real recorded singing**: the shared [`vocal-voices.js`](vocal-voices.js) library plays actual sung vowels from the [**VocalSet**](https://zenodo.org/records/1193957) corpus (CC BY 4.0), looped seamlessly and pitch-mapped by a **formant-preserving**, in-tune splice sampler so the vocal-tract resonances stay put as the note moves — no "chipmunk".

The schola sings a **repertoire of real chant**, encoded note-for-note from the Solesmes books (Graduale Romanum / Liber Usualis, via the GregoBase transcriptions) and spanning the main genres: the hymn *Veni Creator Spiritus*, the *Dies irae* sequence, Kyrie XI *Orbis factor*, the Christmas gradual *Viderunt omnes* (the respond Pérotin set as organum) and the *Requiem aeternam* introit with its psalm verse — plus authentic **office psalm-tone recitation** in all eight modes (intonation, recitation on the tenor, mediant cadence, termination).

> **Credit:** sampled voices derived from [**VocalSet**](https://zenodo.org/records/1193957) (Wilkins, Seetharaman, Wahl & Pardo, ISMIR 2018), CC BY 4.0.

**[Launch the app](https://brendanjameslynskey.github.io/Synth_Gregorian/)** — auto-detects your device and recommends desktop or mobile.

---

## The style

**Gregorian chant** (plainsong / plainchant) is the monophonic, unaccompanied sacred song of the Western Latin Church. A single melodic line is sung to Latin scripture in *free rhythm* — no harmony, no fixed beat. It took shape in the Carolingian empire of the 9th–10th centuries from a fusion of Roman and Gallican liturgical song, and was later attributed (by legend) to Pope Gregory I.

Its melodies move mostly by step within one of **eight church modes**, rising from a *finalis* to recite on a *tenor* (reciting tone) before cadencing home. Text is set either syllabically or spun into long melismatic **neumes** (podatus, clivis, torculus…). It is the seed from which all later Western music grew.

## How it sounds high quality

Rather than pure tones, the engine sings each monk with the shared **sampled-voice** library ([`vocal-voices.js`](vocal-voices.js)):

- **Real voice** — actual sung vowels from the **VocalSet** corpus, looped into seamless sustains by a phase-coherent **splice sampler**: each note plays the nearest recorded pitch, detuned by at most about a semitone, so the formants stay put and the note is dead in tune. Syllable onsets are articulated with procedural **consonants** (sibilants, plosives, nasals), so the Latin text is pronounced while the melismas flow on the vowel.
- **Persistent, straight-tone voice** — each monk is a persistent library voice with its own detune and breath; only the pitch and vowel change from note to note, exactly as in real singing. Plainchant is sung **straight-tone**: only the gentlest vibrato shimmer, not the fuller vibrato of the polyphonic apps, which would wobble on an exposed unison line.
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

A parallel, secular, vernacular branch runs alongside it: **Troubadour** song.

| App | Style | Voice |
|---|---|---|
| **Synth Gregorian** (this) | Plainsong | Real sampled voices, straight-tone chant |
| [Synth Organum](https://github.com/BrendanJamesLynskey/Synth_Organum) | Notre-Dame polyphony | Real sampled voices in Pythagorean just intonation |
| [Synth Troubadour](https://github.com/BrendanJamesLynskey/Synth_Troubadour) | Secular monophony | Real sampled voice over a subtractive vielle drone |

The shared sampled voice at the heart of all three is explored in depth — alongside a century of pure-synthesis techniques — in [Vocal Synthesis](https://github.com/BrendanJamesLynskey/Vocal_Synthesis).

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
| `vocal-voices.js` | Shared sampled-voice library — real VocalSet vowels, formant-preserving pitch-mapping, and procedural consonant articulation |
| `gregorian-engine.js` | Plainsong engine (chant repertoire + psalm tones) driving `vocal-voices.js` (Web Audio API) |
| `app.js` | UI controller, stave visualizer, candle motes |
| `gregorian_mobile.html` | Self-contained mobile version (single file) |

## Controls

| Control | Description |
|---|---|
| **Mode** | One of the 8 church tones (Dorian → Hypomixolydian) — chooses the repertoire: a mode with an encoded chant sings it (I *Dies irae* / Kyrie XI, V *Viderunt omnes*, VI *Requiem*, VIII *Veni Creator*), and pressing the same mode again cycles through to its office psalm tone; modes with no encoded chant go straight to psalmody |
| **Voice** | Overall vocal volume |
| **Breath** | Amount of airy noise in the voice |
| **Abbey Reverb** | Wet/dry mix of the stone-abbey convolution reverb |
| **Pace** | Speed of recitation |
| **Schola** | Cantor (1), Schola (3), or Full Choir (6) voices |

## License

MIT
