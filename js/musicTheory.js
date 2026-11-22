// ============================================================================
// Starlight Keys — Music Theory & Pedagogy Engine
// Pitch math, Chroma-Notes color mapping, staff coordinates, scales, chords,
// and real-time harmonic / interval detection.
// ============================================================================

export const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const NOTE_NAMES_FLAT  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const NOTE_NAMES_ASCII = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SOLFEGE_NAMES = ['Do', 'Di', 'Re', 'Ri', 'Mi', 'Fa', 'Fi', 'Sol', 'Si', 'La', 'Li', 'Ti'];

// Warm, harmonious Chroma-Notes / Montessori-inspired synesthetic palette
// Each pitch class (0 = C ... 11 = B) gets a distinct jewel-pastel color
export const PITCH_COLORS = [
  { hex: '#ff6b7a', glow: 'rgba(255, 107, 122, 0.72)', name: 'Coral' },      // C
  { hex: '#ff8a65', glow: 'rgba(255, 138, 101, 0.72)', name: 'Tangerine' },  // C#
  { hex: '#ffb347', glow: 'rgba(255, 179, 71, 0.72)',  name: 'Marigold' },   // D
  { hex: '#ffd166', glow: 'rgba(255, 209, 102, 0.72)', name: 'Honey' },      // D#
  { hex: '#ffe66d', glow: 'rgba(255, 230, 109, 0.75)', name: 'Sunbeam' },    // E
  { hex: '#5eead4', glow: 'rgba(94, 234, 212, 0.72)',  name: 'Meadow' },     // F
  { hex: '#38bdf8', glow: 'rgba(56, 189, 248, 0.72)',  name: 'Lagoon' },     // F#
  { hex: '#60a5fa', glow: 'rgba(96, 165, 250, 0.75)',  name: 'Sky' },        // G
  { hex: '#818cf8', glow: 'rgba(129, 140, 248, 0.75)', name: 'Periwinkle' }, // G#
  { hex: '#a78bfa', glow: 'rgba(167, 139, 250, 0.75)', name: 'Wisteria' },   // A
  { hex: '#d988ff', glow: 'rgba(217, 136, 255, 0.75)', name: 'Orchid' },     // A#
  { hex: '#f472b6', glow: 'rgba(244, 114, 182, 0.75)', name: 'Blossom' },    // B
];

export const IS_BLACK_KEY = [false, true, false, true, false, false, true, false, true, false, true, false];

// Diatonic step offset inside an octave (0..6 for C..B) using sharp spelling
const DIATONIC_INDEX_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const ACCIDENTAL_SHARP     = ['', '♯', '', '♯', '', '', '♯', '', '♯', '', '♯', ''];

// Diatonic step offset using flat spelling (useful for F, Bb, Eb, Ab, Db, Gb keys)
const DIATONIC_INDEX_FLAT  = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const ACCIDENTAL_FLAT      = ['', '♭', '', '♭', '', '', '♭', '', '♭', '', '♭', ''];

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

// ============================================================================
// Scales & Modes
// ============================================================================
export const SCALES = {
  major: {
    id: 'major',
    name: 'Major (Happy & Bright)',
    shortName: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    mood: 'Sunny, joyful, classic storybook melody',
    triadQualities: ['', 'm', 'm', '', '', 'm', '°'],
    roman: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  },
  minor: {
    id: 'minor',
    name: 'Natural Minor (Dreamy)',
    shortName: 'Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    mood: 'Wistful, cinematic, moonlit tales',
    triadQualities: ['m', '°', '', 'm', 'm', '', ''],
    roman: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
  },
  pentatonicMajor: {
    id: 'pentatonicMajor',
    name: 'Major Pentatonic (Can’t Miss!)',
    shortName: 'Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    mood: 'Every note sounds magical together — great for improvising',
    triadQualities: ['', 'm', '', '', 'm'],
    roman: ['I', 'ii', 'iii', 'V', 'vi'],
  },
  blues: {
    id: 'blues',
    name: 'Blues Scale (Groovy)',
    shortName: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    mood: 'Playful, expressive, jazzy storytelling',
    triadQualities: ['m', '', 'm', '°', 'm', ''],
    roman: ['i', '♭III', 'iv', '♭v', 'v', '♭VII'],
  },
  lydian: {
    id: 'lydian',
    name: 'Lydian (Magical & Floating)',
    shortName: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    mood: 'Enchanted film-score wonder & stardust',
    triadQualities: ['', '', 'm', '°', '', 'm', 'm'],
    roman: ['I', 'II', 'iii', '♯iv°', 'V', 'vi', 'vii'],
  },
  dorian: {
    id: 'dorian',
    name: 'Dorian (Celtic Adventure)',
    shortName: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    mood: 'Mysterious yet hopeful folk & fantasy melodies',
    triadQualities: ['m', 'm', '', '', 'm', '°', ''],
    roman: ['i', 'ii', '♭III', 'IV', 'v', 'vi°', '♭VII'],
  },
};

export function getScalePitchClasses(rootPc, scaleId) {
  const scale = SCALES[scaleId] || SCALES.major;
  return new Set(scale.intervals.map((iv) => (rootPc + iv) % 12));
}

export function getDiatonicChords(rootPc, scaleId, baseOctave = 4) {
  const scale = SCALES[scaleId] || SCALES.major;
  const preferFlats = rootPrefersFlats(rootPc);
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;

  // For pentatonic / blues, show the most musically useful chords from the parent key
  if (scaleId === 'pentatonicMajor' || scaleId === 'blues') {
    const parentId = scaleId === 'blues' ? 'minor' : 'major';
    return getDiatonicChords(rootPc, parentId, baseOctave);
  }

  const baseMidiRoot = (baseOctave + 1) * 12 + rootPc; // e.g., C4 = 60
  const intervals = scale.intervals;
  const chords = [];

  for (let i = 0; i < intervals.length; i++) {
    const degreeRootInterval = intervals[i];
    const thirdInterval = intervals[(i + 2) % intervals.length] + (i + 2 >= intervals.length ? 12 : 0);
    const fifthInterval = intervals[(i + 4) % intervals.length] + (i + 4 >= intervals.length ? 12 : 0);

    let r = baseMidiRoot + degreeRootInterval;
    let t = baseMidiRoot + thirdInterval;
    let f = baseMidiRoot + fifthInterval;

    // Keep voicings comfortable inside the current visible keyboard span
    if (f > baseMidiRoot + 16) {
      r -= 12;
      t -= 12;
      f -= 12;
    }

    const chordPc = (rootPc + degreeRootInterval) % 12;
    const quality = scale.triadQualities[i] || '';
    const symbol = `${names[chordPc]}${quality}`;
    const roman = scale.roman[i] || `${i + 1}`;

    chords.push({
      degree: i + 1,
      roman,
      symbol,
      rootPc: chordPc,
      notes: [r, t, f],
      color: PITCH_COLORS[chordPc],
    });
  }
  return chords;
}

// ============================================================================
// Real-Time Interval & Chord Detective
// ============================================================================
const INTERVAL_NAMES = {
  0: 'Unison / Octave',
  1: 'Minor 2nd',
  2: 'Major 2nd',
  3: 'Minor 3rd',
  4: 'Major 3rd',
  5: 'Perfect 4th',
  6: 'Tritone',
  7: 'Perfect 5th',
  8: 'Minor 6th',
  9: 'Major 6th',
  10: 'Minor 7th',
  11: 'Major 7th',
};

const CHORD_PATTERNS = [
  // Triads
  { intervals: [0, 4, 7],     name: 'Major',        suffix: '',      priority: 10 },
  { intervals: [0, 3, 7],     name: 'Minor',        suffix: 'm',     priority: 10 },
  { intervals: [0, 3, 6],     name: 'Diminished',   suffix: 'dim',   priority: 9 },
  { intervals: [0, 4, 8],     name: 'Augmented',    suffix: 'aug',   priority: 8 },
  { intervals: [0, 5, 7],     name: 'Sus4',         suffix: 'sus4',  priority: 8 },
  { intervals: [0, 2, 7],     name: 'Sus2',         suffix: 'sus2',  priority: 8 },
  // Seventh & 6th chords
  { intervals: [0, 4, 7, 11], name: 'Major 7th',    suffix: 'maj7',  priority: 11 },
  { intervals: [0, 4, 7, 10], name: 'Dominant 7th', suffix: '7',     priority: 11 },
  { intervals: [0, 3, 7, 10], name: 'Minor 7th',    suffix: 'm7',    priority: 11 },
  { intervals: [0, 3, 6, 10], name: 'Half-Dim 7th', suffix: 'm7♭5',  priority: 9 },
  { intervals: [0, 3, 6, 9],  name: 'Diminished 7', suffix: 'dim7',  priority: 9 },
  { intervals: [0, 4, 7, 9],  name: 'Major 6th',    suffix: '6',     priority: 8 },
  { intervals: [0, 3, 7, 9],  name: 'Minor 6th',    suffix: 'm6',    priority: 8 },
  { intervals: [0, 2, 4, 7],  name: 'Add 9',        suffix: 'add9',  priority: 9 },
  { intervals: [0, 2, 3, 7],  name: 'Minor Add 9',  suffix: 'm(add9)', priority: 9 },
  // 5-note extensions
  { intervals: [0, 2, 4, 7, 11], name: 'Major 9th', suffix: 'maj9',  priority: 10 },
  { intervals: [0, 2, 4, 7, 10], name: 'Dominant 9', suffix: '9',    priority: 10 },
  { intervals: [0, 2, 3, 7, 10], name: 'Minor 9th', suffix: 'm9',    priority: 10 },
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
    const intervalName = INTERVAL_NAMES[diff] || 'Interval';
    const n1 = names[bassPc];
    const n2 = names[uniquePcs.find((p) => p !== bassPc)];
    return {
      kind: 'interval',
      title: `${n1} + ${n2} (${intervalName})`,
      subtitle: diff === 7 ? 'Power 5th — rich & open!' : 'Two-note harmony',
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
    const noteList = uniquePcs.map((pc) => names[pc]).join(' – ');
    return {
      kind: 'chord',
      title: `${rootName} ${bestMatch.pattern.name}${slash}`,
      symbol: `${rootName}${bestMatch.pattern.suffix}${slash}`,
      subtitle: bestMatch.isRootPosition
        ? `Chord • ${noteList}`
        : `Inversion • ${noteList}`,
      color: PITCH_COLORS[bestMatch.rootPc].hex,
      notes: uniquePcs.map((pc) => names[pc]),
    };
  }

  // Fallback for lush clusters / custom voicings
  const noteList = uniquePcs.map((pc) => names[pc]).join(' – ');
  return {
    kind: 'cluster',
    title: noteList,
    subtitle: `${sorted.length} notes ringing together`,
    color: PITCH_COLORS[bassPc].hex,
    notes: uniquePcs.map((pc) => names[pc]),
  };
}
