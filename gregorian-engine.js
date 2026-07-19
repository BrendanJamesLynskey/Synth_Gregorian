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
 * The schola sings a REPERTOIRE of real chant, encoded note-for-note from the
 * Solesmes books (Graduale Romanum / Liber Usualis, via the GregoBase GABC
 * transcriptions), spanning the main genres:
 *
 *   Mode I    "Dies irae"          sequence   (syllabic;  GregoBase 1198)
 *   Mode I    Kyrie XI "Orbis factor"  Ordinary (melismatic; GregoBase 2982)
 *   Mode V    "Viderunt omnes"     gradual    (melismatic; GregoBase 1163 —
 *                                   the respond Perotin set as organum;
 *                                   LU 409 / Graduale Romanum 33)
 *   Mode VI   "Requiem aeternam"   introit + psalm verse (neumatic; GB 7978,
 *                                   Graduale Romanum 1974 p. 669)
 *   Mode VIII "Veni Creator Spiritus"  hymn   (syllabic; verified note-for-
 *                                   note against the GR 1974 GABC)
 *
 * plus the EIGHT OFFICE PSALM TONES (Liber Usualis pp. 112-117): a psalm verse
 * is chanted the authentic way — intonation, recitation on the tenor, mediant
 * cadence at the half-verse (breath), more recitation, then the termination
 * (differentia). The mode buttons choose the repertoire: a mode with an encoded
 * chant sings it, and pressing the same mode again cycles to that mode's psalm
 * tone (modes with no chant go straight to psalmody on Ps. 109 "Dixit Dominus").
 *
 * Everything is sung in free, text-driven rhythm: neumes slurred legato on one
 * vowel, agogic phrase-final lengthening, breaths between phrases, a schola of
 * detuned/jittered voices, and a large stone-abbey convolution reverb.
 */

class GregorianEngine {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.currentMode = 8;           // matches the default chant (Veni Creator)
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

        // === The 8 office psalm tones (Liber Usualis pp. 112-117) ===
        // Each tone: reciting note (tenor), intonation cells, mediant-cadence
        // cells and one canonical termination (differentia, named). A "cell"
        // is the note group for one syllable (a 2-3 note cell is a neume).
        // Cross-checked against the LU chart (musicasacra.com tones.pdf) and
        // the GABC formulas in the jgabc psalm-tone tool (bbloomf.github.io).
        this.psalmTones = {
            1: { tenor: 'A3', differentia: 'D',
                 intonation: [['F3'], ['G3','A3']],
                 mediant: [['Bb3'], ['A3'], ['G3'], ['A3']],
                 termination: [['G3'], ['F3'], ['G3','A3'], ['G3'], ['G3','F3','E3','D3']] },
            2: { tenor: 'F3', differentia: '(unica)',
                 intonation: [['C3'], ['D3']],
                 mediant: [['G3'], ['F3']],
                 termination: [['E3'], ['C3'], ['D3'], ['D3']] },
            3: { tenor: 'C4', differentia: 'a',
                 intonation: [['G3'], ['A3','C4']],
                 mediant: [['D4'], ['C4'], ['B3','A3'], ['C4']],
                 termination: [['A3'], ['C4'], ['C4'], ['B3','A3']] },
            4: { tenor: 'A3', differentia: 'E',
                 intonation: [['A3'], ['G3','A3']],
                 mediant: [['G3'], ['A3'], ['B3'], ['A3']],
                 termination: [['G3'], ['A3'], ['B3','A3'], ['G3'], ['G3','F3'], ['E3']] },
            5: { tenor: 'C4', differentia: 'a',
                 intonation: [['F3'], ['A3']],
                 mediant: [['D4'], ['C4']],
                 termination: [['D4'], ['B3'], ['C4'], ['A3'], ['A3']] },
            6: { tenor: 'A3', differentia: 'F',
                 intonation: [['F3'], ['G3','A3']],
                 mediant: [['Bb3'], ['A3'], ['G3'], ['A3']],
                 termination: [['F3'], ['G3','A3'], ['G3'], ['F3']] },
            7: { tenor: 'D4', differentia: 'a',
                 intonation: [['C4','B3'], ['C4','D4']],
                 mediant: [['F4'], ['E4'], ['D4'], ['E4']],
                 termination: [['E4'], ['D4'], ['C4'], ['C4'], ['B3','A3']] },
            8: { tenor: 'C4', differentia: 'G',
                 intonation: [['G3'], ['A3']],
                 mediant: [['D4'], ['C4']],
                 termination: [['B3'], ['C4'], ['A3'], ['G3']] }
        };

        // Psalm 109 "Dixit Dominus" vv. 1-2 + doxology, as syllables with the
        // sung vowel. Each verse = two half-verses (a: ...mediant | b: ...term).
        this.psalterVerses = [
            { a: [['Di','i'],['xit','i'],['Dó','o'],['mi','i'],['nus','u'],['Dó','o'],['mi','i'],['no','o'],['me','e'],['o','o']],
              b: [['Se','e'],['de','e'],['a','a'],['dex','e'],['tris','i'],['me','e'],['is','i']] },
            { a: [['Do','o'],['nec','e'],['po','o'],['nam','a'],['in','i'],['i','i'],['mí','i'],['cos','o'],['tu','u'],['os','o']],
              b: [['sca','a'],['bél','e'],['lum','u'],['pe','e'],['dum','u'],['tu','u'],['ó','o'],['rum','u']] },
            { a: [['Gló','o'],['ri','i'],['a','a'],['Pa','a'],['tri','i'],['et','e'],['Fí','i'],['li','i'],['o','o']],
              b: [['et','e'],['Spi','i'],['rí','i'],['tu','u'],['i','i'],['San','a'],['cto','o']] },
            { a: [['Si','i'],['cut','u'],['e','e'],['rat','a'],['in','i'],['prin','i'],['cí','i'],['pi','i'],['o','o'],['et','e'],['nunc','u'],['et','e'],['sem','e'],['per','e']],
              b: [['et','e'],['in','i'],['sǽ','e'],['cu','u'],['la','a'],['sæ','e'],['cu','u'],['ló','o'],['rum','u'],['A','a'],['men','e']] }
        ];

        // === Repertoire: real chant, encoded note-for-note ===
        // Each syllable: { syl: Latin text, v: sung vowel, n: [note names] }.
        // A multi-note `n` array is a neume — its notes are slurred legato on
        // the one vowel, with a short portamento between neighbours.
        this.chants = {
            // "Veni Creator Spiritus" — Vesper hymn for Pentecost, Mode 8
            // (Hypomixolydian): final G, reciting tone C. Syllabic, strophic.
            veni: {
                title: 'Veni Creator Spiritus',
                mode: 8, genre: 'hymn (syllabic)',
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
            // "Viderunt omnes" — Christmas gradual (respond), Mode 5: final F,
            // reciting tone C. Decoded note-for-note from the GregoBase 1163
            // GABC (Graduale Romanum 1961 p. 33 / Liber Usualis p. 409, c3
            // clef: d=F3 e=G3 f=A3 g=B3 h=C4 i=D4 j=E4 k=F4; the "gx" flat in
            // "omnis" makes those g's B♭3). This is the respond Pérotin set as
            // four-voice organum — fully melismatic, the melisma on "(ter)ra"
            // running to sixteen notes.
            viderunt: {
                title: 'Viderunt omnes',
                mode: 5, genre: 'gradual (melismatic)',
                phrases: [
                    [ { syl: 'Vi',   v: 'i', n: ['F3'] },
                      { syl: 'dé',   v: 'e', n: ['F3'] },
                      { syl: 'runt', v: 'u', n: ['A3','C4'] },
                      { syl: 'o',    v: 'o', n: ['C4','D4','C4','A3','C4','C4','C4','E4','D4','C4'] },
                      { syl: 'mnes', v: 'e', n: ['C4'] } ],
                    [ { syl: 'fi',   v: 'i', n: ['C4','D4'] },
                      { syl: 'nes',  v: 'e', n: ['C4','A3'] },
                      { syl: 'ter',  v: 'e', n: ['C4','A3','C4','C4','A3'] },
                      { syl: 'rae',  v: 'e', n: ['A3','C4','C4','A3','C4','B3','C4','A3'] } ],
                    [ { syl: 'sa',   v: 'a', n: ['A3'] },
                      { syl: 'lu',   v: 'u', n: ['C4','B3'] },
                      { syl: 'tá',   v: 'a', n: ['C4','B3','D4'] },
                      { syl: 're',   v: 'e', n: ['D4','C4','B3','C4','A3'] } ],
                    [ { syl: 'De',   v: 'e', n: ['A3','G3','A3','B3','C4','D4','C4'] },
                      { syl: 'i',    v: 'i', n: ['C4','B3','D4','E4','F4'] },
                      { syl: 'no',   v: 'o', n: ['D4','C4'] },
                      { syl: 'stri', v: 'i', n: ['C4','B3','C4','A3'] } ],
                    [ { syl: 'ju',   v: 'u', n: ['A3'] },
                      { syl: 'bi',   v: 'i', n: ['C4','B3'] },
                      { syl: 'lá',   v: 'a', n: ['C4'] },
                      { syl: 'te',   v: 'e', n: ['C4','C4','C4'] },
                      { syl: 'De',   v: 'e', n: ['A3','C4','G3','G3','F3'] },
                      { syl: 'o',    v: 'o', n: ['F3','G3','A3','C4','A3','F3'] } ],
                    [ { syl: 'o',    v: 'o', n: ['F3','A3','C4','D4','E4','C4'] },
                      { syl: 'mnis', v: 'i', n: ['C4','A3','Bb3','C4','Bb3','G3','A3','Bb3','A3','G3'] },
                      { syl: 'ter',  v: 'e', n: ['F3','G3','F3'] },
                      { syl: 'ra',   v: 'a', n: ['F3','A3','C4','F3','A3','C4','C4','B3','G3','F3','A3','G3','A3','G3','G3','F3'] } ]
                ]
            },
            // "Dies irae" — sequence from the Requiem Mass, Mode 1: final D,
            // reciting tone A. Decoded from GregoBase 1198 (Graduale Romanum
            // 1961 p. 96* / LU p. 1810, c4 clef: a=A2 c=C3 d=D3 e=E3 f=F3
            // g=G3 h=A3 i=B3 j=C4). Strophic and syllabic — stanza I ("Dies
            // irae...") and stanza III ("Tuba mirum...", the higher second
            // melodic strain) are encoded, six phrases in all.
            dies: {
                title: 'Dies irae',
                mode: 1, genre: 'sequence (syllabic)',
                phrases: [
                    [ { syl: 'Di',   v: 'i', n: ['F3'] },
                      { syl: 'es',   v: 'e', n: ['E3'] },
                      { syl: 'i',    v: 'i', n: ['F3'] },
                      { syl: 'rae',  v: 'e', n: ['D3'] },
                      { syl: 'di',   v: 'i', n: ['E3'] },
                      { syl: 'es',   v: 'e', n: ['C3'] },
                      { syl: 'il',   v: 'i', n: ['D3'] },
                      { syl: 'la',   v: 'a', n: ['D3'] } ],
                    [ { syl: 'Sol',  v: 'o', n: ['F3'] },
                      { syl: 'vet',  v: 'e', n: ['F3','G3'] },
                      { syl: 'sae',  v: 'e', n: ['F3','E3'] },
                      { syl: 'clum', v: 'u', n: ['D3','C3'] },
                      { syl: 'in',   v: 'i', n: ['E3'] },
                      { syl: 'fa',   v: 'a', n: ['F3'] },
                      { syl: 'víl',  v: 'i', n: ['E3'] },
                      { syl: 'la',   v: 'a', n: ['D3'] } ],
                    [ { syl: 'Te',   v: 'e', n: ['A2'] },
                      { syl: 'ste',  v: 'e', n: ['C3','D3'] },
                      { syl: 'Da',   v: 'a', n: ['D3'] },
                      { syl: 'vid',  v: 'i', n: ['D3','C3'] },
                      { syl: 'cum',  v: 'u', n: ['E3'] },
                      { syl: 'Si',   v: 'i', n: ['F3'] },
                      { syl: 'býl',  v: 'i', n: ['E3'] },
                      { syl: 'la',   v: 'a', n: ['D3'] } ],
                    [ { syl: 'Tu',   v: 'u', n: ['A3'] },
                      { syl: 'ba',   v: 'a', n: ['C4'] },
                      { syl: 'mi',   v: 'i', n: ['C4'] },
                      { syl: 'rum',  v: 'u', n: ['B3','G3','A3'] },
                      { syl: 'spar', v: 'a', n: ['A3','G3','F3'] },
                      { syl: 'gens', v: 'e', n: ['G3'] },
                      { syl: 'so',   v: 'o', n: ['A3'] },
                      { syl: 'num',  v: 'u', n: ['A3','D3'] } ],
                    [ { syl: 'Per',  v: 'e', n: ['F3'] },
                      { syl: 'se',   v: 'e', n: ['E3'] },
                      { syl: 'púl',  v: 'u', n: ['F3'] },
                      { syl: 'cra',  v: 'a', n: ['D3'] },
                      { syl: 're',   v: 'e', n: ['E3'] },
                      { syl: 'gi',   v: 'i', n: ['C3'] },
                      { syl: 'ó',    v: 'o', n: ['D3'] },
                      { syl: 'num',  v: 'u', n: ['D3'] } ],
                    [ { syl: 'Co',   v: 'o', n: ['F3'] },
                      { syl: 'get',  v: 'e', n: ['G3','A3'] },
                      { syl: 'o',    v: 'o', n: ['A3','G3','F3'] },
                      { syl: 'mnes', v: 'e', n: ['E3','D3','C3'] },
                      { syl: 'an',   v: 'a', n: ['E3'] },
                      { syl: 'te',   v: 'e', n: ['F3'] },
                      { syl: 'thro', v: 'o', n: ['E3'] },
                      { syl: 'num',  v: 'u', n: ['D3'] } ]
                ]
            },
            // Kyrie XI "Orbis factor" — Mass Ordinary, Mode 1: final D.
            // Decoded from GregoBase 2982 (Graduale Romanum 1961 p. 38* / LU
            // p. 46, c4 clef; the "ix" flats make the i's B♭3). Melismatic:
            // each invocation carries the great nine-note "e(léison)" melisma
            // F G A B♭ A G F E D. Kyrie — Christe — final expanded Kyrie.
            kyrie: {
                title: 'Kyrie XI (Orbis factor)',
                mode: 1, genre: 'Kyrie (melismatic)',
                phrases: [
                    [ { syl: 'Ky',  v: 'i', n: ['A3','Bb3'] },
                      { syl: 'ri',  v: 'i', n: ['A3','G3'] },
                      { syl: 'e',   v: 'e', n: ['A3','D3'] },
                      { syl: 'e',   v: 'e', n: ['F3','G3','A3','Bb3','A3','G3','F3','E3','D3'] },
                      { syl: 'lé',  v: 'e', n: ['C3'] },
                      { syl: 'i',   v: 'i', n: ['D3'] },
                      { syl: 'son', v: 'o', n: ['D3'] } ],
                    [ { syl: 'Chri', v: 'i', n: ['A3','G3'] },
                      { syl: 'ste',  v: 'e', n: ['D4','C4','D4','C4','A3','G3','A3'] },
                      { syl: 'e',    v: 'e', n: ['F3','G3','A3','Bb3','A3','G3','F3','E3','D3'] },
                      { syl: 'lé',   v: 'e', n: ['C3'] },
                      { syl: 'i',    v: 'i', n: ['D3'] },
                      { syl: 'son',  v: 'o', n: ['D3'] } ],
                    [ { syl: 'Ký',  v: 'i', n: ['D3','F3','D3'] },
                      { syl: 'ri',  v: 'i', n: ['C3','D3'] },
                      { syl: 'e',   v: 'e', n: ['D3','G3','F3','G3','F3','D3','C3','D3'] },
                      { syl: 'e',   v: 'e', n: ['F3','G3','A3','Bb3','A3','G3','F3','E3','D3'] },
                      { syl: 'lé',  v: 'e', n: ['C3'] },
                      { syl: 'i',   v: 'i', n: ['D3'] },
                      { syl: 'son', v: 'o', n: ['D3'] } ]
                ]
            },
            // "Requiem aeternam" — introit of the Mass for the Dead, Mode 6:
            // final F, with the mode's characteristic B♭. Decoded from
            // GregoBase 7978 (Graduale Romanum 1974 p. 669, c4 clef).
            // Neumatic antiphon, then the psalm verse "Te decet hymnus" sung
            // to the Mode 6 INTROIT tone exactly as printed — so this piece
            // demonstrates introit psalmody (antiphon + verse) while the mode
            // buttons' psalm option demonstrates office psalmody.
            requiem: {
                title: 'Requiem aeternam',
                mode: 6, genre: 'introit + psalm verse (neumatic)',
                phrases: [
                    [ { syl: 'Re',   v: 'e', n: ['F3','F3','G3'] },
                      { syl: 'qui',  v: 'i', n: ['F3'] },
                      { syl: 'em',   v: 'e', n: ['F3'] },
                      { syl: 'ae',   v: 'e', n: ['F3','G3','A3'] },
                      { syl: 'tér',  v: 'e', n: ['A3','G3','G3','F3','G3'] },
                      { syl: 'nam',  v: 'a', n: ['G3','F3'] } ],
                    [ { syl: 'do',   v: 'o', n: ['F3','G3','A3'] },
                      { syl: 'na',   v: 'a', n: ['A3','G3'] },
                      { syl: 'e',    v: 'e', n: ['A3'] },
                      { syl: 'is',   v: 'i', n: ['A3','C4','A3','G3','A3','Bb3','A3','G3'] },
                      { syl: 'Dó',   v: 'o', n: ['F3'] },
                      { syl: 'mi',   v: 'i', n: ['F3','G3','A3','G3','F3','G3'] },
                      { syl: 'ne',   v: 'e', n: ['G3','F3'] } ],
                    [ { syl: 'et',   v: 'e', n: ['A3','G3'] },
                      { syl: 'lux',  v: 'u', n: ['A3','G3','F3'] },
                      { syl: 'per',  v: 'e', n: ['A3'] },
                      { syl: 'pé',   v: 'e', n: ['G3','A3'] },
                      { syl: 'tu',   v: 'u', n: ['G3','F3'] },
                      { syl: 'a',    v: 'a', n: ['F3'] } ],
                    [ { syl: 'lú',   v: 'u', n: ['A3','G3'] },
                      { syl: 'ce',   v: 'e', n: ['A3'] },
                      { syl: 'at',   v: 'a', n: ['A3','C4','A3','G3','A3','Bb3','A3','G3'] },
                      { syl: 'e',    v: 'e', n: ['F3','G3','A3','G3','F3','G3'] },
                      { syl: 'is',   v: 'i', n: ['G3','F3'] } ],
                    [ { syl: 'Te',   v: 'e', n: ['F3','G3'] },
                      { syl: 'de',   v: 'e', n: ['G3','F3'] },
                      { syl: 'cet',  v: 'e', n: ['G3','A3'] },
                      { syl: 'hym',  v: 'i', n: ['A3'] },
                      { syl: 'nus',  v: 'u', n: ['G3'] },
                      { syl: 'De',   v: 'e', n: ['Bb3'] },
                      { syl: 'us',   v: 'u', n: ['A3'] },
                      { syl: 'in',   v: 'i', n: ['A3'] },
                      { syl: 'Si',   v: 'i', n: ['G3'] },
                      { syl: 'on',   v: 'o', n: ['F3'] } ],
                    [ { syl: 'et',   v: 'e', n: ['A3'] },
                      { syl: 'ti',   v: 'i', n: ['A3','C4'] },
                      { syl: 'bi',   v: 'i', n: ['G3'] },
                      { syl: 'red',  v: 'e', n: ['F3'] },
                      { syl: 'dé',   v: 'e', n: ['F3'] },
                      { syl: 'tur',  v: 'u', n: ['F3'] },
                      { syl: 'vo',   v: 'o', n: ['F3'] },
                      { syl: 'tum',  v: 'u', n: ['G3'] },
                      { syl: 'in',   v: 'i', n: ['F3','D3'] },
                      { syl: 'Ie',   v: 'e', n: ['F3'] },
                      { syl: 'rú',   v: 'u', n: ['G3'] },
                      { syl: 'sa',   v: 'a', n: ['F3'] },
                      { syl: 'lem',  v: 'e', n: ['F3'] } ]
                ]
            }
        };

        // === What each mode button sings ===
        // First press: that mode's chant. Pressing the SAME mode again cycles
        // through its programme — further chants in the mode, then the mode's
        // office psalm tone (Ps. 109 "Dixit Dominus"). Modes with no encoded
        // chant (2, 3, 4, 7) go straight to psalmody, which is exactly how
        // those tenors were mostly heard in the office anyway.
        this.modePrograms = {
            1: ['dies', 'kyrie', 'psalm'],
            2: ['psalm'],
            3: ['psalm'],
            4: ['psalm'],
            5: ['viderunt', 'psalm'],
            6: ['requiem', 'psalm'],
            7: ['psalm'],
            8: ['veni', 'psalm']
        };
        this.programIndex = 0;
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
            // Plainchant is sung STRAIGHT-tone — only the faintest shimmer, not
            // the fuller vibrato of the polyphonic apps (which would wobble on an
            // exposed solo line). vibCents overrides the library's default depth.
            vibCents: 7
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
     * Build a chant-shaped object that sings Ps. 109 "Dixit Dominus" to the
     * office psalm tone of the given mode — the authentic recitation grammar:
     *
     *   intonation (first verse only) → recitation on the tenor → mediant
     *   cadence … breath … recitation on the tenor → termination (differentia)
     *
     * Each half-verse becomes one "phrase", so the ordinary scheduler gives
     * the mediant and the differentia their agogic lengthening and a breath —
     * exactly the shape of choir psalmody. Cadence cells are counted from the
     * END of the half-verse (the standard simplification of accent-alignment);
     * recitation syllables are flagged `r: 1` and move a touch quicker, the
     * way a schola patters through the tenor and settles into the cadence.
     */
    buildPsalmChant(mode) {
        const tone = this.psalmTones[mode] || this.psalmTones[8];
        const phrases = [];
        this.psalterVerses.forEach((verse, vi) => {
            // First half-verse: [intonation] + recitation + mediant.
            const A = [];
            const into = vi === 0 ? tone.intonation : [];   // intone verse 1 only
            const med = tone.mediant;
            let i = 0;
            const reciteA = Math.max(0, verse.a.length - into.length - med.length);
            for (const cell of into) {
                const [syl, v] = verse.a[i++];
                A.push({ syl, v, n: cell.slice() });
            }
            for (let r = 0; r < reciteA; r++) {
                const [syl, v] = verse.a[i++];
                A.push({ syl, v, n: [tone.tenor], r: 1 });
            }
            for (const cell of med) {
                if (i >= verse.a.length) break;
                const [syl, v] = verse.a[i++];
                A.push({ syl, v, n: cell.slice() });
            }
            phrases.push(A);

            // Second half-verse: recitation + termination (differentia).
            const B = [];
            const term = tone.termination;
            let j = 0;
            const reciteB = Math.max(0, verse.b.length - term.length);
            for (let r = 0; r < reciteB; r++) {
                const [syl, v] = verse.b[j++];
                B.push({ syl, v, n: [tone.tenor], r: 1 });
            }
            for (const cell of term) {
                if (j >= verse.b.length) break;
                const [syl, v] = verse.b[j++];
                B.push({ syl, v, n: cell.slice() });
            }
            phrases.push(B);
        });
        return {
            title: 'Ps. 109 Dixit Dominus — Tone ' + mode + ' (' + tone.differentia + ')',
            mode, genre: 'office psalmody',
            phrases
        };
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
        // Psalm-tone recitation syllables (flagged r:1) patter a touch
        // quicker on the tenor, as a schola does between the cadences.
        if (item.r) syllableDur *= 0.85;
        // Agogic lengthening: the last syllable of each phrase doubles.
        if (isLast) syllableDur *= 2;
        const noteDur = syllableDur / notes.length;

        // Leave a little room before the vowel for an onset consonant, so a
        // syllable is heard as "sss-A" rather than the consonant landing on top
        // of the vowel. Then articulate the syllable's consonants on ONE lead
        // monk (not the whole schola, so consonants don't stack N-fold) — the
        // melisma still flows on the one vowel, exactly as chant is sung.
        const now = this.ctx.currentTime;
        const hasOnset = /^[^aeiouyæœ]/i.test(item.syl || '');
        const lead = hasOnset ? 0.09 : 0;
        notes.forEach((freq, i) => {
            // Within a neume, slide legato from the previous note (playNote
            // applies a short portamento when slideFrom is given).
            const prev = i > 0 ? notes[i - 1] : null;
            this.playNote(freq, noteDur, item.v, prev, lead + i * noteDur);
        });
        const lead0 = this.voices[0];
        if (lead0 && lead0.voice.articulate && item.syl) {
            lead0.voice.articulate(item.syl, now + lead, now + lead + syllableDur, notes[0]);
        }

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

        this.phraseTimeout = setTimeout(() => this.scheduleSyllable(), (lead + syllableDur + pause) * 1000);
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
        // First press of a mode selects its chant; pressing the SAME mode
        // again cycles through that mode's programme (chant(s), then the
        // mode's office psalm tone). See this.modePrograms.
        const program = this.modePrograms[mode] || ['psalm'];
        if (mode === this.currentMode) {
            this.programIndex = (this.programIndex + 1) % program.length;
        } else {
            this.currentMode = mode;
            this.programIndex = 0;
        }
        const key = program[this.programIndex];
        let chantKey;
        if (key === 'psalm') {
            chantKey = 'psalm' + mode;
            if (!this.chants[chantKey]) this.chants[chantKey] = this.buildPsalmChant(mode);
        } else {
            chantKey = key;
        }
        if (chantKey !== this.currentChant) {
            this.currentChant = chantKey;
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
