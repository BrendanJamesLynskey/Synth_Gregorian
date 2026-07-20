# Synth Gregorian — Plainsong Synthesizer

A web-based synthesizer that sings **Gregorian chant** in real time in the browser. By default the chant is **pure sine tones** — an ethereal, wordless colour in the vein of Synth Orthodox and Synth Spectralist: slow, spacious phrases whose notes bloom gently and decay long into a deep abbey-reverb wash. A **Timbre** toggle switches to **Voices** — **real recorded singing**: the shared [`vocal-voices.js`](vocal-voices.js) library plays actual sung vowels from the [**VocalSet**](https://zenodo.org/records/1193957) corpus (CC BY 4.0), looped seamlessly and pitch-mapped by a **formant-preserving**, in-tune splice sampler so the vocal-tract resonances stay put as the note moves — no "chipmunk".

The schola sings a **repertoire of real chant**, encoded note-for-note from the Solesmes books (Graduale Romanum / Liber Usualis, via the GregoBase transcriptions) and spanning the main genres: the hymn *Veni Creator Spiritus*, the *Dies irae* sequence, Kyrie XI *Orbis factor*, the Christmas gradual *Viderunt omnes* (the respond Pérotin set as organum) and the *Requiem aeternam* introit with its psalm verse — plus authentic **office psalm-tone recitation** in all eight modes (intonation, recitation on the tenor, mediant cadence, termination).

> **Credit:** sampled voices derived from [**VocalSet**](https://zenodo.org/records/1193957) (Wilkins, Seetharaman, Wahl & Pardo, ISMIR 2018), CC BY 4.0.

**[Launch the app](https://brendanjameslynskey.github.io/Synth_Gregorian/)** — auto-detects your device and recommends desktop or mobile.

---

## The style

**Gregorian chant** (plainsong / plainchant) is the monophonic, unaccompanied sacred song of the Western Latin Church. A single melodic line is sung to Latin scripture in *free rhythm* — no harmony, no fixed beat. It took shape in the Carolingian empire of the 9th–10th centuries from a fusion of Roman and Gallican liturgical song, and was later attributed (by legend) to Pope Gregory I.

Its melodies move mostly by step within one of **eight church modes**, rising from a *finalis* to recite on a *tenor* (reciting tone) before cadencing home. Text is set either syllabically or spun into long melismatic **neumes** (podatus, clivis, torculus…). It is the seed from which all later Western music grew.

## How it sounds high quality

The engine offers two **timbres**, switched live by the Timbre toggle:

- **Sine (default)** — each monk is a **pure sine tone** with a faint octave shimmer and the gentlest vibrato: no formants, no words — just clean, ethereal tone. Notes open with a **slow bloom** and ring out with a **long decay**, floating and bleeding into the reverb wash rather than starting and stopping; the default pace is slow and spacious.
- **Voices** — the schola becomes **real recorded singing** from the shared sampled-voice library ([`vocal-voices.js`](vocal-voices.js)): actual sung vowels from the **VocalSet** corpus, looped into seamless sustains by a phase-coherent **splice sampler** — each note plays the nearest recorded pitch, detuned by at most about a semitone, so the formants stay put and the note is dead in tune. Syllable onsets are articulated with procedural **consonants** (sibilants, plosives, nasals), so the Latin text is pronounced while the melismas flow on the vowel. Plainchant is sung **straight-tone**: only the gentlest vibrato shimmer, not the fuller vibrato of the polyphonic apps, which would wobble on an exposed unison line.
- **Ensemble** — in either timbre, a *schola* of detuned, jittered voices (Cantor / Schola / Full Choir), a soft limiter to hold the full choir, plus a large stone-**abbey convolution reverb** (~8 s ethereal tail with early reflections) whose deep default wash the tones dissolve into.

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
| **Synth Gregorian** (this) | Plainsong | Ethereal sine tones by default; optional real sampled voices, straight-tone chant |
| [Synth Organum](https://github.com/BrendanJamesLynskey/Synth_Organum) | Notre-Dame polyphony | Real sampled voices in Pythagorean just intonation |
| [Synth Troubadour](https://github.com/BrendanJamesLynskey/Synth_Troubadour) | Secular monophony | Real sampled voice over a subtractive vielle drone |

The shared sampled voice that sings Organum, Troubadour and this app's **Voices** timbre is explored in depth — alongside a century of pure-synthesis techniques — in [Vocal Synthesis](https://github.com/BrendanJamesLynskey/Vocal_Synthesis).

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
| `vocal-voices.js` | Shared voice library — the pure-sine timbre plus real VocalSet vowels with formant-preserving pitch-mapping and procedural consonant articulation |
| `gregorian-engine.js` | Plainsong engine (chant repertoire + psalm tones) driving `vocal-voices.js` in either timbre (Web Audio API) |
| `app.js` | UI controller, stave visualizer, candle motes |
| `gregorian_mobile.html` | Self-contained mobile version (single file) |

## Controls

| Control | Description |
|---|---|
| **Mode** | One of the 8 church tones (Dorian → Hypomixolydian) — chooses the repertoire: a mode with an encoded chant sings it (I *Dies irae* / Kyrie XI, V *Viderunt omnes*, VI *Requiem*, VIII *Veni Creator*), and pressing the same mode again cycles through to its office psalm tone; modes with no encoded chant go straight to psalmody |
| **Timbre** | **Sine** (default) — pure, ethereal tones — or **Voices** — the real sampled VocalSet choir; switchable live |
| **Voice** | Overall vocal volume |
| **Breath** | Amount of airy noise in the sampled voice (Voices timbre) |
| **Abbey Reverb** | Wet/dry mix of the stone-abbey convolution reverb — a deep wash by default |
| **Pace** | Speed of recitation — slow and spacious by default |
| **Schola** | Cantor (1), Schola (3), or Full Choir (6) voices — works in either timbre |

## License

MIT
