/**
 * Gregorian Chant Synthesis Engine — FOF Vocal Synthesis
 *
 * Rather than pure sine tones, this engine sings each monk with the shared
 * `vocal-voices.js` vocal-synthesis library (default technique FOF — Fonction
 * d'Onde Formantique, the IRCAM CHANT method): once per glottal period a burst
 * of overlapping damped formant grains reconstructs a true, convincingly-sung
 * vocal spectrum with real vowel formants. Each monk is a persistent library
 * voice with its own detune, breath and vibrato; only the pitch and vowel change
 * from note to note, exactly as in real singing, and the vowel morphs
 * continuously as the Latin text unfolds.
 *
 * The schola now sings REAL chant, encoded note-for-note from the repertoire:
 * "Veni Creator Spiritus" (the Vesper hymn, Mode 8 — final G, reciting tone C)
 * by default, sung strophically in free, text-driven rhythm with neumes slurred
 * legato on one vowel, agogic phrase-final lengthening, breaths between phrases,
 * a schola of detuned/jittered voices, and a large stone-abbey convolution reverb.
 */

class GregorianEngine {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.currentMode = 1;
        this.numVoices = 1;
        this.tempo = 52;                // syllables per minute-ish pacing
        this.voiceVolume = 0.75;
        this.breath = 0.35;
        this.reverbMix = 0.6;

        this.voices = [];               // persistent per-monk vocal tracts
        this.phraseTimeout = null;
        this.activeNotes = [];

        this.masterGain = null;
        this.limiter = null;
        this.voiceBus = null;
        this.reverbGain = null;
        this.dryGain = null;
        this.convolver = null;
        this.analyser = null;

        // A2 — a low, grounded reciting range for a men's schola
        this.basePitch = 110;   // A2 — deep chant tessitura; the sampled bank now reaches down to G2

        // === The 8 medieval church modes ===
        // Retained for UI compatibility (mode buttons / labels). The melody is
        // no longer generated from these tables — it is encoded chant (below).
        this.modes = {
            1: { name: "Dorian",        intervals: [0,200,300,500,700,900,1000,1200], finalis: 0, tenor: 4, up: 5 },
            2: { name: "Hypodorian",    intervals: [0,200,300,500,700,900,1000,1200], finalis: 0, tenor: 2, up: 4 },
            3: { name: "Phrygian",      intervals: [0,100,300,500,700,800,1000,1200], finalis: 0, tenor: 5, up: 6 },
            4: { name: "Hypophrygian",  intervals: [0,100,300,500,700,800,1000,1200], finalis: 0, tenor: 3, up: 5 },
            5: { name: "Lydian",        intervals: [0,200,400,600,700,900,1100,1200], finalis: 0, tenor: 4, up: 6 },
            6: { name: "Hypolydian",    intervals: [0,200,400,600,700,900,1100,1200], finalis: 0, tenor: 2, up: 4 },
            7: { name: "Mixolydian",    intervals: [0,200,400,500,700,900,1000,1200], finalis: 0, tenor: 4, up: 6 },
            8: { name: "Hypomixolydian",intervals: [0,200,400,500,700,900,1000,1200], finalis: 0, tenor: 3, up: 5 }
        };

        // === Sung-vowel formant tables (male voice), Hz ===
        // F1..F4 centre frequencies. The vocal tract morphs between these.
        this.vowels = {
            a: [700, 1220, 2600, 3300],
            e: [530, 1840, 2480, 3300],
            i: [270, 2300, 3000, 3400],
            o: [430,  820, 2700, 3300],
            u: [350,  600, 2700, 3300]
        };
        // Latin liturgical text is vowel-rich; weight toward a/e/o.
        this.vowelSequence = ['a','e','a','o','e','i','a','o','u','e','a'];
        this.vowelPos = 0;

        this.phrasePos = 0;

        // === Repertoire: real chant, encoded note-for-note ===
        // Each syllable: { syl: Latin text, v: sung vowel, n: [note names] }.
        // A multi-note `n` array is a neume — its notes are slurred legato on
        // the one vowel, with a short portamento between neighbours.
        this.chants = {
            // "Veni Creator Spiritus" — Vesper hymn for Pentecost, Mode 8
            // (Hypomixolydian): final G, reciting tone C. Syllabic, strophic.
            veni: {
                title: 'Veni Creator Spiritus',
                mode: 8,
                phrases: [
                    [ { syl: 'Ve',   v: 'e', n: ['G3'] },
                      { syl: 'ni',   v: 'i', n: ['A3'] },
                      { syl: 'Cre',  v: 'e', n: ['G3','F3'] },
                      { syl: 'a',    v: 'a', n: ['G3'] },
                      { syl: 'tor',  v: 'o', n: ['A3','G3'] },
                      { syl: 'Spi',  v: 'i', n: ['C4'] },
                      { syl: 'ri',   v: 'i', n: ['D4'] },
                      { syl: 'tus',  v: 'u', n: ['C4'] } ],
                    [ { syl: 'Men',  v: 'e', n: ['C4'] },
                      { syl: 'tes',  v: 'e', n: ['G3'] },
                      { syl: 'tu',   v: 'u', n: ['A3'] },
                      { syl: 'o',    v: 'o', n: ['C4'] },
                      { syl: 'rum',  v: 'u', n: ['D4','C4'] },
                      { syl: 'vi',   v: 'i', n: ['D4'] },
                      { syl: 'si',   v: 'i', n: ['E4'] },
                      { syl: 'ta',   v: 'a', n: ['D4'] } ],
                    [ { syl: 'Im',   v: 'i', n: ['C4'] },
                      { syl: 'ple',  v: 'e', n: ['D4','E4'] },
                      { syl: 'su',   v: 'u', n: ['C4','B3'] },
                      { syl: 'per',  v: 'e', n: ['A3','G3'] },
                      { syl: 'na',   v: 'a', n: ['C4','D4'] },
                      { syl: 'gra',  v: 'a', n: ['G3'] },
                      { syl: 'ti',   v: 'i', n: ['A3'] },
                      { syl: 'a',    v: 'a', n: ['C4'] } ],
                    [ { syl: 'Quae', v: 'e', n: ['B3','C4'] },
                      { syl: 'tu',   v: 'u', n: ['A3'] },
                      { syl: 'cre',  v: 'e', n: ['G3','F3'] },
                      { syl: 'a',    v: 'a', n: ['A3'] },
                      { syl: 'sti',  v: 'i', n: ['A3','B3','A3'] },
                      { syl: 'pec',  v: 'e', n: ['G3'] },
                      { syl: 'to',   v: 'o', n: ['F3'] },
                      { syl: 'ra',   v: 'a', n: ['G3'] } ]
                ]
            },
            // "Viderunt omnes" — Christmas gradual respond, Mode 5: final F,
            // reciting tone C. A simplified, near-syllabic adaptation of the
            // respond text (the true gradual is far more melismatic); it keeps
            // the mode-5 F–A–C skeleton and cadences on the F final.
            viderunt: {
                title: 'Viderunt omnes',
                mode: 5,
                phrases: [
                    [ { syl: 'Vi',   v: 'i', n: ['F3','G3','A3'] },
                      { syl: 'de',   v: 'e', n: ['A3'] },
                      { syl: 'runt', v: 'u', n: ['C4'] },
                      { syl: 'om',   v: 'o', n: ['C4','D4','C4'] },
                      { syl: 'nes',  v: 'e', n: ['A3','C4'] } ],
                    [ { syl: 'fi',   v: 'i', n: ['C4'] },
                      { syl: 'nes',  v: 'e', n: ['A3'] },
                      { syl: 'ter',  v: 'e', n: ['G3','A3','G3'] },
                      { syl: 'rae',  v: 'e', n: ['F3'] } ],
                    [ { syl: 'sa',   v: 'a', n: ['A3'] },
                      { syl: 'lu',   v: 'u', n: ['C4'] },
                      { syl: 'ta',   v: 'a', n: ['C4','D4'] },
                      { syl: 're',   v: 'e', n: ['C4'] } ],
                    [ { syl: 'De',   v: 'e', n: ['A3','C4','A3'] },
                      { syl: 'i',    v: 'i', n: ['G3'] },
                      { syl: 'no',   v: 'o', n: ['F3','G3'] },
                      { syl: 'stri', v: 'i', n: ['F3'] } ]
                ]
            }
        };
        this.currentChant = 'veni';     // the reliable default
        this.phraseIndex = 0;           // which phrase of the chant is being sung
        this.tempoDrift = 0;            // smooth agogic random walk, ±8%
    }

    async init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.85;

        // Soft limiter before the destination keeps a full schola from clipping.
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -8; this.limiter.knee.value = 8;
        this.limiter.ratio.value = 6; this.limiter.attack.value = 0.004; this.limiter.release.value = 0.25;
        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.85;
        this.masterGain.connect(this.analyser);

        await this.createReverb();

        this.voiceBus = this.ctx.createGain();
        this.voiceBus.gain.value = this.voiceVolume;

        this.dryGain = this.ctx.createGain();
        this.dryGain.gain.value = 1 - this.reverbMix * 0.5;

        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = this.reverbMix;

        this.voiceBus.connect(this.dryGain);
        this.voiceBus.connect(this.convolver);
        this.dryGain.connect(this.masterGain);
        this.convolver.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);

        // Load the vocal-synthesis worklets (FOF, vocal tract) once.
        await VocalVoices.init(this.ctx);
    }

    /** Large stone abbey — ~5 s tail with sparse early reflections. */
    async createReverb() {
        const sr = this.ctx.sampleRate;
        const length = Math.floor(sr * 5);
        const impulse = this.ctx.createBuffer(2, length, sr);
        const reflections = [0.011, 0.023, 0.037, 0.052, 0.071, 0.093, 0.121, 0.149, 0.181];
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                const t = i / sr;
                const env = Math.exp(-t * 0.7) * 0.35 + Math.exp(-t * 0.32) * 0.4 + Math.exp(-t * 0.16) * 0.22;
                data[i] = (Math.random() * 2 - 1) * env;
                if (i < sr * 0.2) {
                    for (const d of reflections) {
                        if (i === Math.floor(d * sr)) data[i] += (Math.random() * 2 - 1) * 0.3;
                    }
                }
            }
        }
        this.convolver = this.ctx.createConvolver();
        this.convolver.buffer = impulse;
    }

    centsToFreq(cents) { return this.basePitch * Math.pow(2, cents / 1200); }

    /**
     * Build one monk as a persistent FOF library voice:
     *   voice.output → noteGain (per-note envelope) → tractGain (fade-in) → voiceBus
     * Only the pitch and vowel change from note to note; the singer persists.
     */
    createVoiceTract(index, total) {
        const now = this.ctx.currentTime;

        const tractGain = this.ctx.createGain();
        // Additive: more monks = fuller sound, gently tapered.
        const perVoice = [0.5, 0.4, 0.34, 0.3, 0.27, 0.24];
        const vol = perVoice[Math.min(index, perVoice.length - 1)];
        tractGain.gain.value = 0;
        tractGain.gain.setValueAtTime(0, now);
        tractGain.gain.linearRampToValueAtTime(vol, now + 1.5 + index * 0.6);
        tractGain.connect(this.voiceBus);

        // Per-note amplitude envelope, shared by this monk across notes.
        const noteGain = this.ctx.createGain();
        noteGain.gain.value = 0.0001;
        noteGain.connect(tractGain);

        // Per-monk pitch drift so a unison schola shimmers.
        const detuneCents = (index - (total - 1) / 2) * 9 + (Math.random() - 0.5) * 5;

        const voice = VocalVoices.create(this.ctx, {
            technique: 'sampler',           // real recorded voices (was 'fof')
            voice: 'male', ensemble: 1,     // the schola of monks supplies the width
            vowel: this.vowelSequence[0],
            detuneCents,
            breath: 0.03 + this.breath * 0.06,
            vibDepth: 0.006
        });
        voice.output.connect(noteGain);

        return { voice, noteGain, tractGain, detuneCents, vowel: this.vowelSequence[0] };
    }

    setupVoices() {
        this.teardownVoices();
        for (let v = 0; v < this.numVoices; v++) {
            this.voices.push(this.createVoiceTract(v, this.numVoices));
        }
    }

    teardownVoices() {
        const now = this.ctx ? this.ctx.currentTime : 0;
        for (const voice of this.voices) {
            try {
                voice.tractGain.gain.cancelScheduledValues(now);
                voice.tractGain.gain.setValueAtTime(voice.tractGain.gain.value, now);
                voice.tractGain.gain.linearRampToValueAtTime(0, now + 2);
                const v = voice.voice;
                setTimeout(() => { try { v.dispose(); } catch (e) {} }, 2500);
            } catch (e) {}
        }
        this.voices = [];
    }

    /** Morph a monk's library voice toward a new sung vowel. */
    setVowel(voice, vowel) {
        if (!this.vowels[vowel]) return;
        voice.voice.setVowel(vowel, this.ctx.currentTime);
        voice.vowel = vowel;
    }

    // === Melody: the encoded chant, sung phrase by phrase ===

    start() {
        this.isPlaying = true;
        this.phrasePos = 0;
        this.phraseIndex = 0;
        this.tempoDrift = 0;
        this.buildPhrase();
        this.scheduleSyllable();
    }

    stop() {
        this.isPlaying = false;
        if (this.phraseTimeout) { clearTimeout(this.phraseTimeout); this.phraseTimeout = null; }
        const now = this.ctx ? this.ctx.currentTime : 0;
        for (const n of this.activeNotes) {
            try {
                n.gain.gain.cancelScheduledValues(now);
                n.gain.gain.setValueAtTime(n.gain.gain.value, now);
                n.gain.gain.linearRampToValueAtTime(0, now + 1.2);
                setTimeout(() => { try { n.osc.stop(); } catch (e) {} }, 1500);
            } catch (e) {}
        }
        this.activeNotes = [];
        this.teardownVoices();
    }

    /** Note name ("G3", "Bb3", "C#4") → frequency, equal temperament, A4 = 440. */
    noteToFreq(name) {
        const steps = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
        const m = /^([A-G])([#b]?)(\d)$/.exec(name);
        if (!m) return 0;
        let s = steps[m[1]];
        if (m[2] === '#') s += 1;
        if (m[2] === 'b') s -= 1;
        return 440 * Math.pow(2, (s + (parseInt(m[3], 10) - 4) * 12) / 12);
    }

    /**
     * Load the current phrase of the encoded chant into `this.phrase`.
     * The chant is strophic: after the final phrase it wraps back to the
     * first, as a schola would sing successive stanzas of the hymn.
     */
    buildPhrase() {
        const chant = this.chants[this.currentChant] || this.chants.veni;
        this.phraseIndex = this.phraseIndex % chant.phrases.length;
        this.phrase = chant.phrases[this.phraseIndex];
        this.phrasePos = 0;
    }

    scheduleSyllable() {
        if (!this.isPlaying) return;
        if (!this.phrase || this.phrasePos >= this.phrase.length) this.buildPhrase();
        const chant = this.chants[this.currentChant] || this.chants.veni;
        const item = this.phrase[this.phrasePos];

        // Free, text-driven rhythm: ~0.47 s per syllable at the default tempo
        // (52), wandering on a smooth ±8% agogic random walk — never metrical,
        // no downbeats, just the pacing of spoken Latin.
        this.tempoDrift += (Math.random() - 0.5) * 0.045;
        this.tempoDrift = Math.max(-0.08, Math.min(0.08, this.tempoDrift));
        const base = Math.max(0.32, Math.min(0.85, 0.47 * (52 / this.tempo)))
                   * (1 + this.tempoDrift);

        const isLast = this.phrasePos === this.phrase.length - 1;
        const notes = item.n.map(nm => this.noteToFreq(nm));

        // A neume gets a little more time than a single punctum, and its
        // duration is split evenly across its notes, all on the one vowel.
        let syllableDur = base * (1 + 0.55 * (notes.length - 1));
        // Agogic lengthening: the last syllable of each phrase doubles.
        if (isLast) syllableDur *= 2;
        const noteDur = syllableDur / notes.length;

        notes.forEach((freq, i) => {
            // Within a neume, slide legato from the previous note (playNote
            // applies a short portamento when slideFrom is given).
            const prev = i > 0 ? notes[i - 1] : null;
            this.playNote(freq, noteDur, item.v, prev, i * noteDur);
        });

        this.phrasePos++;
        const phraseEnd = this.phrasePos >= this.phrase.length;
        // Breath at the end of the phrase (a touch longer after the stanza);
        // just a consonant's worth of separation between syllables.
        let pause = 0.05;
        if (phraseEnd) {
            const stanzaEnd = this.phraseIndex === chant.phrases.length - 1;
            pause = stanzaEnd ? 0.9 + Math.random() * 0.4
                              : 0.5 + Math.random() * 0.3;
            this.phraseIndex = (this.phraseIndex + 1) % chant.phrases.length;
            this.buildPhrase();
        }

        this.phraseTimeout = setTimeout(() => this.scheduleSyllable(), (syllableDur + pause) * 1000);
    }

    /** One sung note across every monk in the schola. */
    playNote(freq, duration, vowel, slideFrom, delay) {
        if (!isFinite(freq) || freq <= 0) return;
        const t0 = this.ctx.currentTime + (delay || 0);
        for (const voice of this.voices) {
            this.setVowel(voice, vowel);

            // Steer the library voice's pitch (glide legato between neighbours).
            const glide = (slideFrom && isFinite(slideFrom)) ? Math.min(0.14, duration * 0.4) : 0;
            if (glide > 0) {
                voice.voice.setFrequency(slideFrom, t0, 0);
                voice.voice.setFrequency(freq, t0, glide);
            } else {
                voice.voice.setFrequency(freq, t0, 0);
            }
            voice.voice.setLevel(1, t0);

            // Re-shape this monk's per-note amplitude envelope.
            const g = voice.noteGain.gain;
            const attack = Math.min(0.18, duration * 0.35);
            const release = Math.max(0.25, duration * 0.6);
            g.cancelScheduledValues(t0);
            g.setValueAtTime(Math.max(0.0001, g.value), t0);
            g.linearRampToValueAtTime(1.0, t0 + attack);
            g.setValueAtTime(0.9, t0 + Math.max(attack, duration * 0.7));
            g.exponentialRampToValueAtTime(0.001, t0 + duration + release);
        }
    }

    // === Public transport / control ===

    async begin() {
        await this.init();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.setupVoices();
        setTimeout(() => { if (!this.isPlaying) this.start(); }, 1600);
    }

    end() { this.stop(); }

    setMode(mode) {
        this.currentMode = mode;
        // Mode buttons now select among the encoded chants: Mode 8 (VIII)
        // sings "Veni Creator Spiritus", Mode 5 (V) "Viderunt omnes". All
        // other modes are safe no-ops — the schola keeps singing as it was.
        const chantByMode = { 8: 'veni', 5: 'viderunt' };
        const chant = chantByMode[mode];
        if (chant && chant !== this.currentChant) {
            this.currentChant = chant;
            this.phraseIndex = 0;
            if (this.isPlaying) this.buildPhrase();
        }
    }

    setVoices(count) {
        this.numVoices = count;
        if (this.voices.length) { this.setupVoices(); }
    }

    setVoiceVolume(v) {
        this.voiceVolume = v;
        if (this.voiceBus) this.voiceBus.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.2);
    }

    setBreath(v) { this.breath = v; }

    setReverbMix(v) {
        this.reverbMix = v;
        if (this.reverbGain && this.dryGain) {
            const now = this.ctx.currentTime;
            this.reverbGain.gain.linearRampToValueAtTime(v, now + 0.2);
            this.dryGain.gain.linearRampToValueAtTime(1 - v * 0.5, now + 0.2);
        }
    }

    setTempo(bpm) { this.tempo = bpm; }

    getAnalyserData() {
        if (!this.analyser) return null;
        const d = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(d);
        return d;
    }
    getFrequencyData() {
        if (!this.analyser) return null;
        const d = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(d);
        return d;
    }
}
