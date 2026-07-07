/**
 * Gregorian Chant Synthesis Engine — Source–Filter Vocal Synthesis
 *
 * Rather than pure sine tones, this engine models the human singing voice
 * with the classic source–filter (formant) technique:
 *
 *   - SOURCE   : a glottal pulse — a custom PeriodicWave whose harmonics roll
 *                off ~12 dB/octave, like the flow through vibrating vocal folds.
 *   - FILTER   : a bank of parallel resonant band-pass "formants" that shape the
 *                source into recognisable Latin vowels (a e i o u). Each monk has
 *                his own persistent vocal tract; only the pitch (fold frequency)
 *                changes from note to note, exactly as in real singing.
 *   - BREATH   : filtered noise adds air and consonantal texture.
 *
 * On top of that: the 8 medieval church modes, free neumatic rhythm with
 * recitation on the tenor and agogic cadences, melismatic neumes, a schola of
 * detuned/jittered voices, and a large stone-abbey convolution reverb.
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
        this.voiceBus = null;
        this.reverbGain = null;
        this.dryGain = null;
        this.convolver = null;
        this.analyser = null;
        this.glottalWave = null;

        // A2 — a low, grounded reciting range for a men's schola
        this.basePitch = 110;

        // === The 8 medieval church modes ===
        // intervals: cents from the finalis; tenor: reciting-tone scale degree.
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
    }

    async init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.85;
        this.masterGain.connect(this.ctx.destination);

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

        this.buildGlottalWave();
    }

    /**
     * The glottal source: harmonics rolling off ~ -12 dB/oct. A little richer
     * than a sawtooth so the higher formants have partials to resonate.
     */
    buildGlottalWave() {
        const n = 48;
        const real = new Float32Array(n);
        const imag = new Float32Array(n);
        for (let k = 1; k < n; k++) {
            imag[k] = 1 / Math.pow(k, 1.2);   // spectral tilt
        }
        this.glottalWave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
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
     * Build one monk's persistent vocal tract:
     *   sourceGain → [4 parallel band-pass formants] → tractGain → voiceBus
     * Note oscillators (the folds) connect transiently into sourceGain.
     */
    createVoiceTract(index, total) {
        const now = this.ctx.currentTime;

        const sourceGain = this.ctx.createGain();
        sourceGain.gain.value = 1.0;

        const tractGain = this.ctx.createGain();
        // Additive: more monks = fuller sound, gently tapered.
        const perVoice = [0.5, 0.4, 0.34, 0.3, 0.27, 0.24];
        const vol = perVoice[Math.min(index, perVoice.length - 1)];
        tractGain.gain.value = 0;
        tractGain.gain.setValueAtTime(0, now);
        tractGain.gain.linearRampToValueAtTime(vol, now + 1.5 + index * 0.6);
        tractGain.connect(this.voiceBus);

        // Four parallel formant resonators.
        const formantGainsRel = [1.0, 0.5, 0.28, 0.16];
        const bandwidths = [80, 90, 120, 150];
        const formants = [];
        const v0 = this.vowels[this.vowelSequence[0]];
        for (let f = 0; f < 4; f++) {
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = v0[f];
            bp.Q.value = v0[f] / bandwidths[f];
            const fg = this.ctx.createGain();
            fg.gain.value = formantGainsRel[f];
            sourceGain.connect(bp);
            bp.connect(fg);
            fg.connect(tractGain);
            formants.push({ bp, fg, bandwidth: bandwidths[f] });
        }

        // Breath — filtered noise for air, gated softly with singing.
        const noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuf; noise.loop = true;
        const noiseBp = this.ctx.createBiquadFilter();
        noiseBp.type = 'bandpass'; noiseBp.frequency.value = 2600; noiseBp.Q.value = 0.7;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0;
        noise.connect(noiseBp); noiseBp.connect(noiseGain); noiseGain.connect(sourceGain);
        noise.start(now);

        // Per-monk pitch drift so a unison schola shimmers.
        const detuneCents = (index - (total - 1) / 2) * 9 + (Math.random() - 0.5) * 5;

        return { sourceGain, tractGain, formants, noise, noiseGain, detuneCents, vowel: this.vowelSequence[0] };
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
                setTimeout(() => { try { voice.noise.stop(); } catch (e) {} }, 2500);
            } catch (e) {}
        }
        this.voices = [];
    }

    /** Ramp a monk's formant bank toward a new vowel (vocal-tract transition). */
    setVowel(voice, vowel) {
        const target = this.vowels[vowel];
        if (!target) return;
        const now = this.ctx.currentTime;
        voice.formants.forEach((fm, f) => {
            fm.bp.frequency.cancelScheduledValues(now);
            fm.bp.frequency.setValueAtTime(fm.bp.frequency.value, now);
            fm.bp.frequency.linearRampToValueAtTime(target[f], now + 0.12);
            fm.bp.Q.setValueAtTime(target[f] / fm.bandwidth, now + 0.12);
        });
        voice.vowel = vowel;
    }

    // === Melody generation: intonation → recitation → cadence ===

    start() {
        this.isPlaying = true;
        this.phrasePos = 0;
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

    /**
     * Compose a plausible chant phrase for the current mode: rise from the
     * finalis (intonation), recite around the tenor with small neumes, then
     * a stepwise cadence back to the finalis. Values are scale degrees.
     */
    buildPhrase() {
        const m = this.modes[this.currentMode];
        const tenor = m.tenor;
        const phrase = [];
        // Intonation: rise to the reciting tone.
        for (let d = 0; d <= tenor; d++) phrase.push({ deg: d, len: d === tenor ? 1.4 : 0.9 });
        // Recitation with ornamental neumes around the tenor.
        const recite = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < recite; i++) {
            const r = Math.random();
            if (r < 0.45) phrase.push({ deg: tenor, len: 0.9 });
            else if (r < 0.7) phrase.push({ deg: tenor, len: 0.9, neume: [tenor, tenor + 1, tenor] });   // torculus
            else if (r < 0.85) phrase.push({ deg: tenor - 1, len: 0.9, neume: [tenor - 1, tenor] });      // podatus
            else phrase.push({ deg: Math.min(m.up, tenor + 1), len: 1.0, neume: [tenor + 1, tenor] });    // clivis
        }
        // Cadence: stepwise descent to the finalis, lengthened.
        for (let d = tenor - 1; d >= 0; d--) phrase.push({ deg: d, len: d === 0 ? 2.4 : 1.0 });
        this.phrase = phrase;
        this.phrasePos = 0;
        // Advance the "syllable" vowel per phrase segment.
        this.vowelPos = (this.vowelPos + 1) % this.vowelSequence.length;
    }

    scheduleSyllable() {
        if (!this.isPlaying) return;
        const m = this.modes[this.currentMode];
        const item = this.phrase[this.phrasePos];
        const beat = 60 / this.tempo;
        const vowel = this.vowelSequence[(this.vowelPos + this.phrasePos) % this.vowelSequence.length];

        const degToFreq = (deg) => {
            const idx = ((deg % 8) + 8) % 8;
            const oct = Math.floor(deg / 8);
            return this.centsToFreq(m.intervals[idx]) * Math.pow(2, oct);
        };

        // A syllable may carry a melisma (several slurred notes on one vowel).
        const notes = item.neume
            ? item.neume.map(d => degToFreq(d))
            : [degToFreq(item.deg)];
        const syllableDur = beat * item.len;
        const noteDur = syllableDur / notes.length;

        notes.forEach((freq, i) => {
            const prev = i > 0 ? notes[i - 1] : null;
            this.playNote(freq, noteDur, vowel, prev, i * noteDur);
        });

        this.phrasePos++;
        const phraseEnd = this.phrasePos >= this.phrase.length;
        // Breath at the end of the phrase; small separation between syllables.
        const pause = phraseEnd ? beat * 1.6 : beat * 0.08;
        if (phraseEnd) this.buildPhrase();

        this.phraseTimeout = setTimeout(() => this.scheduleSyllable(), (syllableDur + pause) * 1000);
    }

    /** One sung note across every monk in the schola. */
    playNote(freq, duration, vowel, slideFrom, delay) {
        const t0 = this.ctx.currentTime + (delay || 0);
        for (const voice of this.voices) {
            this.setVowel(voice, vowel);

            const osc = this.ctx.createOscillator();
            osc.setPeriodicWave(this.glottalWave);
            const jitter = (Math.random() - 0.5) * 6;               // pitch jitter (shimmer of a real voice)
            osc.detune.value = voice.detuneCents + jitter;

            if (slideFrom) {
                osc.frequency.setValueAtTime(slideFrom, t0);
                osc.frequency.exponentialRampToValueAtTime(freq, t0 + Math.min(0.14, duration * 0.4));
            } else {
                osc.frequency.value = freq;
            }

            const gain = this.ctx.createGain();
            const attack = Math.min(0.18, duration * 0.35);
            const release = Math.max(0.25, duration * 0.6);
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(1.0, t0 + attack);
            gain.gain.setValueAtTime(0.9, t0 + Math.max(attack, duration * 0.7));
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration + release);

            osc.connect(gain);
            gain.connect(voice.sourceGain);

            // Vibrato blooms on longer, held notes only.
            if (duration > 0.7) {
                const vib = this.ctx.createOscillator();
                vib.type = 'sine';
                vib.frequency.value = 4.8 + Math.random() * 1.2;
                const vibDepth = this.ctx.createGain();
                vibDepth.gain.value = freq * 0.006;
                vib.connect(vibDepth); vibDepth.connect(osc.frequency);
                vib.start(t0 + attack); vib.stop(t0 + duration + release);
            }

            // Breath swells with the note.
            voice.noiseGain.gain.cancelScheduledValues(t0);
            voice.noiseGain.gain.setValueAtTime(voice.noiseGain.gain.value, t0);
            voice.noiseGain.gain.linearRampToValueAtTime(0.06 * this.breath, t0 + attack);
            voice.noiseGain.gain.linearRampToValueAtTime(0.01 * this.breath, t0 + duration + release);

            osc.start(t0);
            osc.stop(t0 + duration + release + 0.1);

            const node = { osc, gain };
            this.activeNotes.push(node);
            setTimeout(() => {
                const idx = this.activeNotes.indexOf(node);
                if (idx > -1) this.activeNotes.splice(idx, 1);
            }, (duration + release + 0.2) * 1000);
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
        if (this.isPlaying) { this.buildPhrase(); }
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
