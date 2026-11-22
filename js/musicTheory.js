// ============================================================================
// Nocturne Keys — Music Theory, Jazz Harmony & Staff Coordinate Engine
// Pitch math, muted lo-fi harmonic palette, Grand Staff coordinates, key
// signatures, scales/modes, diatonic 7ths/triads, and real-time chord detective.
// ============================================================================

export const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const NOTE_NAMES_FLAT  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const NOTE_NAMES_ASCII = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SOLFEGE_NAMES = ['Do', 'Di', 'Re', 'Ri', 'Mi', 'Fa', 'Fi', 'Sol', 'Si', 'La', 'Li', 'Ti'];

// Muted, nocturnal lo-fi / impressionist harmonic palette
// Warm amber, terracotta, sage, slate-blue, dusty lavender & rosewood
export const PITCH_COLORS = [
  { hex: '#e07a7a', glow: 'rgba(224, 122, 122, 0.58)', name: 'Terracotta' }, // C
  { hex: '#e08e6d', glow: 'rgba(224, 142, 109, 0.58)', name: 'Sienna' },     // C#
  { hex: '#e5a864', glow: 'rgba(229, 168, 100, 0.62)', name: 'Amber' },      // D
  { hex: '#ecc275', glow: 'rgba(236, 194, 117, 0.62)', name: 'Ochre' },      // D#
  { hex: '#e8d284', glow: 'rgba(232, 210, 132, 0.62)', name: 'Champagne' },  // E
  { hex: '#7cc4a9', glow: 'rgba(124, 196, 169, 0.58)', name: 'Sage' },       // F
  { hex: '#6ab6c4', glow: 'rgba(106, 182, 196, 0.58)', name: 'Seafoam' },    // F#
  { hex: '#76a5d6', glow: 'rgba(118, 165, 214, 0.62)', name: 'Dusk Blue' },  // G
  { hex: '#8b96d9', glow: 'rgba(139, 150, 217, 0.60)', name: 'Slate' },      // G#
  { hex: '#a994db', glow: 'rgba(169, 148, 219, 0.60)', name: 'Lavender' },   // A
  { hex: '#c78ec9', glow: 'rgba(199, 142, 201, 0.58)', name: 'Mauve' },      // A#
  { hex: '#dc89a0', glow: 'rgba(220, 137, 160, 0.58)', name: 'Dusty Rose' }, // B
];

export const IS_BLACK_KEY = [false, true, false, true, false, false, true, false, true, false, true, false];

// Diatonic step offset inside an octave (0..6 for C..B)
const DIATONIC_INDEX_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const ACCIDENTAL_SHARP     = ['', '♯', '', '♯', '', '', '♯', '', '♯', '', '♯', ''];

const DIATONIC_INDEX_FLAT  = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const ACCIDENTAL_FLAT      = ['', '♭', '', '♭', '', '', '♭', '', '♭', '', '♭', ''];

// Standard order of sharps (F C G D A E B) and flats (B E A D G C F)
// Expressed as staffStep offsets on Treble and Bass staves
export const SHARP_TREBLE_STEPS = [10, 7, 11, 8, 5, 9, 6];       // F5 C5 G5 D5 A4 E5 B4
export const SHARP_BASS_STEPS   = [-4, -7, -3, -6, -9, -5, -8];  // F3 C3 G3 D3 A2 E3 B2
export const FLAT_TREBLE_STEPS  = [6, 9, 5, 8, 4, 7, 3];         // B4 E5 A4 D5 G4 C5 F4
export const FLAT_BASS_STEPS    = [-8, -5, -9, -6, -10, -7, -11];// B2 E3 A2 D3 G2 C3 F2

// Key signature accidental counts for major keys by pitch class (0=C .. 11=B)
// Positive = sharps, Negative = flats
export const MAJOR_KEY_SIG_COUNT = {
  0: 0,   // C
  7: 1,   // G (1#)
  2: 2,   // D (2#)
  9: 3,   // A (3#)
  4: 4,   // E (4#)
  11: 5,  // B (5#)
  6: 6,   // F# (6#)
  5: -1,  // F (1b)
  10: -2, // Bb (2b)
  3: -3,  // Eb (3b)
  8: -4,  // Ab (4b)
  1: -5,  // Db (5b)
};

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function isBlackKey(midi) {
  return IS_BLACK_KEY[((midi % 12) + 12) % 12];
}

export function midiToNoteInfo(midi, preferFlats = false) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const name = preferFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES_SHARP[pc];
  const asciiName = NOTE_NAMES_ASCII[pc];
  const solfege = SOLFEGE_NAMES[pc];
  const color = PITCH_COLORS[pc];

  // Diatonic step relative to Middle C (C4 = midi 60 -> step 0)
  // C4 = 0, D4 = 1, E4 = 2, F4 = 3, G4 = 4, A4 = 5, B4 = 6, C5 = 7, B3 = -1, ...
  const diatonicInOctave = preferFlats ? DIATONIC_INDEX_FLAT[pc] : DIATONIC_INDEX_SHARP[pc];
  const staffStep = (octave - 4) * 7 + diatonicInOctave;
  const accidental = preferFlats ? ACCIDENTAL_FLAT[pc] : ACCIDENTAL_SHARP[pc];

  return {
    midi,
    pc,
    octave,
    name,
    fullName: `${name}${octave}`,
    asciiFull: `${asciiName}${octave}`,
    solfege,
    isBlack: IS_BLACK_KEY[pc],
    color,
    staffStep,
    accidental,
    freq: midiToFreq(midi),
  };
}

// Keys that conventionally prefer flats in notation
const FLAT_ROOTS = new Set([5, 10, 3, 8, 1]); // F, Bb, Eb, Ab, Db

export function rootPrefersFlats(rootPc) {
  return FLAT_ROOTS.has(((rootPc % 12) + 12) % 12);
}

/**
 * Given a key signature accidental count (+sharps / -flats), returns a Set of
 * pitch classes already altered by the key signature, plus diatonic letter steps
 * that carry sharps/flats so the staff avoids redundant accidentals.
 */
export function getKeySignatureAlteredLetters(keySigCount = 0) {
  // Diatonic letters 0=C, 1=D, 2=E, 3=F, 4=G, 5=A, 6=B
  const sharpOrder = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
  const flatOrder  = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F
  const altered = new Map(); // diatonicLetter (0..6) -> '♯' | '♭'
  if (keySigCount > 0) {
    for (let i = 0; i < Math.min(7, keySigCount); i++) {
      altered.set(sharpOrder[i], '♯');
    }
  } else if (keySigCount < 0) {
    for (let i = 0; i < Math.min(7, -keySigCount); i++) {
      altered.set(flatOrder[i], '♭');
    }
  }
  return altered;
}

/**
 * Determine which accidental glyph ('♯', '♭', '♮', or '') to draw on a staff note
 * given an active key signature count (+sharps / -flats).
 */
export function getDisplayAccidental(info, keySigCount = 0) {
  if (!keySigCount) return info.accidental;
  const altered = getKeySignatureAlteredLetters(keySigCount);
  const diatonicLetter = ((info.staffStep % 7) + 7) % 7;
  const sigAcc = altered.get(diatonicLetter) || '';
  if (info.accidental === sigAcc) return '';
  if (info.accidental === '' && sigAcc !== '') return '♮';
  return info.accidental;
}

// ============================================================================
// Scales & Modes (Jazz, Lo-Fi & Modern Harmony)
// ============================================================================
export const SCALES = {
  major: {
    id: 'major',
    name: 'Major (Ionian)',
    shortName: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    mood: 'Clear, resolved diatonic foundation — home of Maj7 & ii–V–I progressions',
    triadQualities: ['', 'm', 'm', '', '', 'm', '°'],
    seventhQualities: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7♭5'],
    roman: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    roman7: ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7'],
  },
  dorian: {
    id: 'dorian',
    name: 'Dorian (Jazz Minor)',
    shortName: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    mood: 'Minor with a raised 6th — signature colour of Bill Evans, Miles Davis & lo-fi hip-hop',
    triadQualities: ['m', 'm', '', '', 'm', '°', ''],
    seventhQualities: ['m7', 'm7', 'maj7', '7', 'm7', 'm7♭5', 'maj7'],
    roman: ['i', 'ii', '♭III', 'IV', 'v', 'vi°', '♭VII'],
    roman7: ['i7', 'ii7', '♭IIImaj7', 'IV7', 'v7', 'viø7', '♭VIImaj7'],
  },
  minor: {
    id: 'minor',
    name: 'Natural Minor (Aeolian)',
    shortName: 'Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    mood: 'Reflective, nocturnal minor tonality for ballads and late-night grooves',
    triadQualities: ['m', '°', '', 'm', 'm', '', ''],
    seventhQualities: ['m7', 'm7♭5', 'maj7', 'm7', 'm7', 'maj7', '7'],
    roman: ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'],
    roman7: ['i7', 'iiø7', '♭IIImaj7', 'iv7', 'v7', '♭VImaj7', '♭VII7'],
  },
  mixolydian: {
    id: 'mixolydian',
    name: 'Mixolydian (Dominant)',
    shortName: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    mood: 'Major with a relaxed ♭7 — laid-back soul, jazz-funk & dominant 7th vamps',
    triadQualities: ['', 'm', '°', '', 'm', 'm', ''],
    seventhQualities: ['7', 'm7', 'm7♭5', 'maj7', 'm7', 'm7', 'maj7'],
    roman: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', '♭VII'],
    roman7: ['I7', 'ii7', 'iiiø7', 'IVmaj7', 'v7', 'vi7', '♭VIImaj7'],
  },
  lydian: {
    id: 'lydian',
    name: 'Lydian (Floating ♯11)',
    shortName: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    mood: 'Raised 4th adds weightless suspension — Debussy, film scores & neo-soul',
    triadQualities: ['', '', 'm', '°', '', 'm', 'm'],
    seventhQualities: ['maj7', '7', 'm7', 'm7♭5', 'maj7', 'm7', 'm7'],
    roman: ['I', 'II', 'iii', '♯iv°', 'V', 'vi', 'vii'],
    roman7: ['Imaj7', 'II7', 'iii7', '♯ivø7', 'Vmaj7', 'vi7', 'vii7'],
  },
  blues: {
    id: 'blues',
    name: 'Minor Blues',
    shortName: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    mood: 'Six-note jazz-blues vocabulary with the expressive chromatic ♭5 passing tone',
    triadQualities: ['m', '', 'm', '°', 'm', ''],
    seventhQualities: ['m7', 'maj7', 'm7', 'm7♭5', 'm7', '7'],
    roman: ['i', '♭III', 'iv', '♭v', 'v', '♭VII'],
    roman7: ['i7', '♭IIImaj7', 'iv7', '♭vø7', 'v7', '♭VII7'],
  },
  pentatonicMinor: {
    id: 'pentatonicMinor',
    name: 'Minor Pentatonic',
    shortName: 'Min Pent.',
    intervals: [0, 3, 5, 7, 10],
    mood: 'Clean 5-note minor palette — effortless phrasing over lo-fi beats & soul chords',
    triadQualities: ['m', '', 'm', 'm', ''],
    seventhQualities: ['m7', 'maj7', 'm7', 'm7', '7'],
    roman: ['i', '♭III', 'iv', 'v', '♭VII'],
    roman7: ['i7', '♭IIImaj7', 'iv7', 'v7', '♭VII7'],
  },
};

export function getScalePitchClasses(rootPc, scaleId) {
  const scale = SCALES[scaleId] || SCALES.major;
  return new Set(scale.intervals.map((iv) => (rootPc + iv) % 12));
}

export function getDiatonicChords(rootPc, scaleId, baseOctave = 4, useSevenths = true) {
  const scale = SCALES[scaleId] || SCALES.major;
  const preferFlats = rootPrefersFlats(rootPc);
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;

  // For 5- or 6-note improvising scales, derive lush chords from their parent 7-note mode
  if (scaleId === 'pentatonicMinor' || scaleId === 'blues') {
    return getDiatonicChords(rootPc, 'dorian', baseOctave, useSevenths);
  }

  const baseMidiRoot = (baseOctave + 1) * 12 + rootPc; // e.g., C4 = 60
  const intervals = scale.intervals;
  const chords = [];

  for (let i = 0; i < intervals.length; i++) {
    const degreeRootInterval = intervals[i];
    const thirdInterval = intervals[(i + 2) % intervals.length] + (i + 2 >= intervals.length ? 12 : 0);
    const fifthInterval = intervals[(i + 4) % intervals.length] + (i + 4 >= intervals.length ? 12 : 0);
    const seventhInterval = intervals[(i + 6) % intervals.length] + (i + 6 >= intervals.length ? 12 : 0);

    let r = baseMidiRoot + degreeRootInterval;
    let t = baseMidiRoot + thirdInterval;
    let f = baseMidiRoot + fifthInterval;
    let s = baseMidiRoot + seventhInterval;

    // Keep voicings comfortable inside the visible keyboard span
    const topNote = useSevenths ? s : f;
    if (topNote > baseMidiRoot + 16) {
      r -= 12;
      t -= 12;
      f -= 12;
      s -= 12;
    }

    const chordPc = (rootPc + degreeRootInterval) % 12;
    const quality = useSevenths
      ? (scale.seventhQualities?.[i] ?? scale.triadQualities[i] ?? '')
      : (scale.triadQualities[i] ?? '');
    const symbol = `${names[chordPc]}${quality}`;
    const roman = useSevenths
      ? (scale.roman7?.[i] ?? scale.roman[i] ?? `${i + 1}`)
      : (scale.roman[i] ?? `${i + 1}`);

    chords.push({
      degree: i + 1,
      roman,
      symbol,
      rootPc: chordPc,
      notes: useSevenths ? [r, t, f, s] : [r, t, f],
      color: PITCH_COLORS[chordPc],
    });
  }
  return chords;
}

// ============================================================================
// Real-Time Interval & Jazz Chord Detective
// ============================================================================
export const INTERVAL_INFO = {
  0:  { name: 'Unison / Octave', short: 'P8', vibe: 'Pure resonance' },
  1:  { name: 'Minor 2nd',       short: 'm2', vibe: 'Chromatic tension' },
  2:  { name: 'Major 2nd',       short: 'M2', vibe: 'Whole step — warm cluster' },
  3:  { name: 'Minor 3rd',       short: 'm3', vibe: 'Melancholic minor colour' },
  4:  { name: 'Major 3rd',       short: 'M3', vibe: 'Warm, sunlit consonance' },
  5:  { name: 'Perfect 4th',     short: 'P4', vibe: 'Open, quartal jazz lift' },
  6:  { name: 'Tritone',         short: 'TT', vibe: 'Dominant guide-tone tension' },
  7:  { name: 'Perfect 5th',     short: 'P5', vibe: 'Grounded & resonant' },
  8:  { name: 'Minor 6th',       short: 'm6', vibe: 'Bittersweet & lyrical' },
  9:  { name: 'Major 6th',       short: 'M6', vibe: 'Warm, nostalgic colour' },
  10: { name: 'Minor 7th',       short: 'm7', vibe: 'Soulful jazz shell interval' },
  11: { name: 'Major 7th',       short: 'M7', vibe: 'Dreamy lo-fi shimmer' },
};

const CHORD_PATTERNS = [
  // Triads
  { intervals: [0, 4, 7],        name: 'Major',         suffix: '',         priority: 10 },
  { intervals: [0, 3, 7],        name: 'Minor',         suffix: 'm',        priority: 10 },
  { intervals: [0, 3, 6],        name: 'Diminished',    suffix: 'dim',      priority: 9 },
  { intervals: [0, 4, 8],        name: 'Augmented',     suffix: 'aug',      priority: 8 },
  { intervals: [0, 5, 7],        name: 'Sus4',          suffix: 'sus4',     priority: 8 },
  { intervals: [0, 2, 7],        name: 'Sus2',          suffix: 'sus2',     priority: 8 },
  // 3-note Jazz Shell Voicings (Root + 3rd + 7th)
  { intervals: [0, 4, 11],       name: 'Maj7 (Shell)',  suffix: 'maj7',     priority: 10 },
  { intervals: [0, 4, 10],       name: 'Dom7 (Shell)',  suffix: '7',        priority: 10 },
  { intervals: [0, 3, 10],       name: 'Min7 (Shell)',  suffix: 'm7',       priority: 10 },
  // Seventh & 6th chords
  { intervals: [0, 4, 7, 11],    name: 'Major 7th',     suffix: 'maj7',     priority: 12 },
  { intervals: [0, 4, 7, 10],    name: 'Dominant 7th',  suffix: '7',        priority: 12 },
  { intervals: [0, 3, 7, 10],    name: 'Minor 7th',     suffix: 'm7',       priority: 12 },
  { intervals: [0, 3, 7, 11],    name: 'Min(Maj7)',     suffix: 'm(maj7)',  priority: 11 },
  { intervals: [0, 3, 6, 10],    name: 'Half-Dim 7th',  suffix: 'm7♭5',     priority: 10 },
  { intervals: [0, 3, 6, 9],     name: 'Diminished 7',  suffix: 'dim7',     priority: 10 },
  { intervals: [0, 4, 7, 9],     name: 'Major 6th',     suffix: '6',        priority: 9 },
  { intervals: [0, 3, 7, 9],     name: 'Minor 6th',     suffix: 'm6',       priority: 9 },
  { intervals: [0, 2, 4, 7],     name: 'Add 9',         suffix: 'add9',     priority: 10 },
  { intervals: [0, 2, 3, 7],     name: 'Minor Add 9',   suffix: 'm(add9)',  priority: 10 },
  { intervals: [0, 5, 7, 10],    name: '7sus4',         suffix: '7sus4',    priority: 10 },
  // 5-note extensions
  { intervals: [0, 2, 4, 7, 11], name: 'Major 9th',     suffix: 'maj9',     priority: 12 },
  { intervals: [0, 2, 4, 7, 10], name: 'Dominant 9th',  suffix: '9',        priority: 12 },
  { intervals: [0, 2, 3, 7, 10], name: 'Minor 9th',     suffix: 'm9',       priority: 12 },
  { intervals: [0, 2, 4, 7, 9],  name: '6/9 Chord',     suffix: '6/9',      priority: 11 },
];

export function detectHarmony(midiNotes, preferFlats = false) {
  if (!midiNotes || midiNotes.length === 0) return null;

  const sorted = [...new Set(midiNotes)].sort((a, b) => a - b);
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;

  if (sorted.length === 1) {
    const info = midiToNoteInfo(sorted[0], preferFlats);
    return {
      kind: 'note',
      title: info.fullName,
      subtitle: `${info.solfege} • ${Math.round(info.freq)} Hz`,
      color: info.color.hex,
      notes: [info.name],
    };
  }

  const bassMidi = sorted[0];
  const bassPc = ((bassMidi % 12) + 12) % 12;
  const uniquePcs = [...new Set(sorted.map((m) => ((m % 12) + 12) % 12))];

  if (uniquePcs.length === 1) {
    const info = midiToNoteInfo(bassMidi, preferFlats);
    return {
      kind: 'interval',
      title: `${info.name} Octave`,
      subtitle: `${sorted.map((m) => midiToNoteInfo(m, preferFlats).fullName).join(' – ')}`,
      color: info.color.hex,
      notes: [info.name],
    };
  }

  if (uniquePcs.length === 2) {
    const diff = (sorted[sorted.length - 1] - bassMidi) % 12;
    const iv = INTERVAL_INFO[diff] || { name: 'Interval', vibe: 'Two-note harmony' };
    const n1 = names[bassPc];
    const n2 = names[uniquePcs.find((p) => p !== bassPc)];
    return {
      kind: 'interval',
      title: `${n1} + ${n2} — ${iv.name}`,
      subtitle: iv.vibe,
      color: PITCH_COLORS[bassPc].hex,
      notes: [n1, n2],
    };
  }

  // Try every unique pitch class as a candidate root to detect root position & inversions
  let bestMatch = null;
  for (const candidateRoot of uniquePcs) {
    const rel = uniquePcs
      .map((pc) => (pc - candidateRoot + 12) % 12)
      .sort((a, b) => a - b);

    for (const pattern of CHORD_PATTERNS) {
      if (pattern.intervals.length !== rel.length) continue;
      let exact = true;
      for (let i = 0; i < rel.length; i++) {
        if (rel[i] !== pattern.intervals[i]) {
          exact = false;
          break;
        }
      }
      if (exact) {
        const isRootPosition = candidateRoot === bassPc;
        const score = pattern.priority + (isRootPosition ? 5 : 0);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            rootPc: candidateRoot,
            pattern,
            isRootPosition,
            score,
          };
        }
      }
    }
  }

  if (bestMatch) {
    const rootName = names[bestMatch.rootPc];
    const bassName = names[bassPc];
    const slash = bestMatch.isRootPosition ? '' : ` / ${bassName}`;
    const noteList = uniquePcs.map((pc) => names[pc]).join(' · ');
    return {
      kind: 'chord',
      title: `${rootName} ${bestMatch.pattern.name}${slash}`,
      symbol: `${rootName}${bestMatch.pattern.suffix}${slash}`,
      subtitle: bestMatch.isRootPosition
        ? `Root voicing • ${noteList}`
        : `Inversion • ${noteList}`,
      color: PITCH_COLORS[bestMatch.rootPc].hex,
      notes: uniquePcs.map((pc) => names[pc]),
    };
  }

  // Fallback for lush clusters / custom jazz voicings
  const noteList = uniquePcs.map((pc) => names[pc]).join(' · ');
  return {
    kind: 'cluster',
    title: noteList,
    subtitle: `${sorted.length}-note voicing`,
    color: PITCH_COLORS[bassPc].hex,
    notes: uniquePcs.map((pc) => names[pc]),
  };
}
