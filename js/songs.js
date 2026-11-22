// ============================================================================
// Starlight Keys — Curated Progressive Song & Technique Library
// Each event supports single notes OR multi-note chords, real piano fingerings
// (1=Thumb .. 5=Pinky), beat timing, durations, and pedagogical tips.
// ============================================================================

/**
 * Helper to convert sequential [midiOrArray, durationBeats, fingerOrArray] tuples
 * into timed events with { beat, notes, duration, fingers }.
 */
function buildSequence(items, startBeat = 0) {
  let cursor = startBeat;
  const events = [];
  for (const item of items) {
    const [pitchSpec, dur, fingerSpec] = item;
    if (pitchSpec === null) {
      // Rest
      cursor += dur;
      continue;
    }
    const notes = Array.isArray(pitchSpec) ? pitchSpec : [pitchSpec];
    const fingers = Array.isArray(fingerSpec)
      ? fingerSpec
      : fingerSpec != null
      ? [fingerSpec]
      : [];
    events.push({
      beat: cursor,
      duration: dur,
      notes,
      fingers,
    });
    cursor += dur;
  }
  return { events, totalBeats: cursor };
}

function makeSong({ id, title, composer, level, levelColor, bpm, timeSig, rootOctave, tip, sequence }) {
  const { events, totalBeats } = buildSequence(sequence, 0);
  let minMidi = 127;
  let maxMidi = 0;
  for (const ev of events) {
    for (const n of ev.notes) {
      if (n < minMidi) minMidi = n;
      if (n > maxMidi) maxMidi = n;
    }
  }
  return {
    id,
    title,
    composer,
    level,
    levelColor,
    bpm,
    timeSig: timeSig || '4/4',
    rootOctave: rootOctave ?? 4,
    tip,
    events,
    totalBeats,
    minMidi,
    maxMidi,
  };
}

export const SONGS = [
  makeSong({
    id: 'mary-lamb',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional',
    level: 'Beginner',
    levelColor: '#5eead4',
    bpm: 108,
    rootOctave: 4,
    tip: 'Rest your right hand gently in C position: Thumb (1) on C4, Pinky (5) on G4.',
    sequence: [
      [64, 1, 3], [62, 1, 2], [60, 1, 1], [62, 1, 2],
      [64, 1, 3], [64, 1, 3], [64, 2, 3],
      [62, 1, 2], [62, 1, 2], [62, 2, 2],
      [64, 1, 3], [67, 1, 5], [67, 2, 5],
      [64, 1, 3], [62, 1, 2], [60, 1, 1], [62, 1, 2],
      [64, 1, 3], [64, 1, 3], [64, 1, 3], [64, 1, 3],
      [62, 1, 2], [62, 1, 2], [64, 1, 3], [62, 1, 2],
      [60, 3, 1],
    ],
  }),

  makeSong({
    id: 'twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    composer: 'Traditional / Mozart',
    level: 'Beginner',
    levelColor: '#5eead4',
    bpm: 104,
    rootOctave: 4,
    tip: 'Reach gently with your pinky (5) up to A4, then float back down smoothly.',
    sequence: [
      [60, 1, 1], [60, 1, 1], [67, 1, 4], [67, 1, 4],
      [69, 1, 5], [69, 1, 5], [67, 2, 4],
      [65, 1, 3], [65, 1, 3], [64, 1, 2], [64, 1, 2],
      [62, 1, 2], [62, 1, 2], [60, 2, 1],

      [67, 1, 5], [67, 1, 5], [65, 1, 4], [65, 1, 4],
      [64, 1, 3], [64, 1, 3], [62, 2, 2],
      [67, 1, 5], [67, 1, 5], [65, 1, 4], [65, 1, 4],
      [64, 1, 3], [64, 1, 3], [62, 2, 2],

      [60, 1, 1], [60, 1, 1], [67, 1, 4], [67, 1, 4],
      [69, 1, 5], [69, 1, 5], [67, 2, 4],
      [65, 1, 3], [65, 1, 3], [64, 1, 2], [64, 1, 2],
      [62, 1, 2], [62, 1, 2], [60, 3, 1],
    ],
  }),

  makeSong({
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    composer: 'Ludwig van Beethoven',
    level: 'Beginner',
    levelColor: '#5eead4',
    bpm: 112,
    rootOctave: 4,
    tip: 'Keep all 5 fingers curved over C4–G4. Notice the joyful dotted rhythm at the end of each line!',
    sequence: [
      [64, 1, 3], [64, 1, 3], [65, 1, 4], [67, 1, 5],
      [67, 1, 5], [65, 1, 4], [64, 1, 3], [62, 1, 2],
      [60, 1, 1], [60, 1, 1], [62, 1, 2], [64, 1, 3],
      [64, 1.5, 3], [62, 0.5, 2], [62, 2, 2],

      [64, 1, 3], [64, 1, 3], [65, 1, 4], [67, 1, 5],
      [67, 1, 5], [65, 1, 4], [64, 1, 3], [62, 1, 2],
      [60, 1, 1], [60, 1, 1], [62, 1, 2], [64, 1, 3],
      [62, 1.5, 2], [60, 0.5, 1], [60, 2.5, 1],
    ],
  }),

  makeSong({
    id: 'c-major-scale',
    title: 'C Major Scale & Arpeggio',
    composer: 'Real Technique Drill',
    level: 'Technique',
    levelColor: '#ffd166',
    bpm: 96,
    rootOctave: 4,
    tip: 'Classic pianist secret: tuck your thumb (1) smoothly underneath finger 3 when stepping from E4 to F4!',
    sequence: [
      // Ascending C Major scale
      [60, 1, 1], [62, 1, 2], [64, 1, 3], [65, 1, 1],
      [67, 1, 2], [69, 1, 3], [71, 1, 4], [72, 2, 5],
      // Descending C Major scale
      [71, 1, 4], [69, 1, 3], [67, 1, 2], [65, 1, 1],
      [64, 1, 3], [62, 1, 2], [60, 2, 1],
      // C Major arpeggio & finishing chord
      [60, 0.75, 1], [64, 0.75, 2], [67, 0.75, 3], [72, 1.25, 5],
      [67, 0.75, 3], [64, 0.75, 2], [60, 1, 1],
      [[60, 64, 67], 3, [1, 3, 5]],
    ],
  }),

  makeSong({
    id: 'enchanted-chords',
    title: 'Starlight Chords (I–V–vi–IV)',
    composer: 'Chord Mastery',
    level: 'Chords',
    levelColor: '#f472b6',
    bpm: 84,
    rootOctave: 4,
    tip: 'Play all 3 lit keys together with fingers 1–3–5! This 4-chord magic loop powers hundreds of hit songs.',
    sequence: [
      // C Major broken then block
      [60, 0.75, 1], [64, 0.75, 3], [67, 0.75, 5], [[60, 64, 67], 1.75, [1, 3, 5]],
      // G Major (first inversion / comfortable voicing G4-B4-D5)
      [67, 0.75, 1], [71, 0.75, 3], [74, 0.75, 5], [[67, 71, 74], 1.75, [1, 3, 5]],
      // A Minor
      [69, 0.75, 1], [72, 0.75, 3], [76, 0.75, 5], [[69, 72, 76], 1.75, [1, 3, 5]],
      // F Major
      [65, 0.75, 1], [69, 0.75, 3], [72, 0.75, 5], [[65, 69, 72], 1.75, [1, 3, 5]],
      // Grand finish back home to C Major
      [[60, 64, 67, 72], 3, [1, 2, 3, 5]],
    ],
  }),

  makeSong({
    id: 'happy-birthday',
    title: 'Happy Birthday',
    composer: 'Traditional',
    level: 'Easy+',
    levelColor: '#60a5fa',
    bpm: 108,
    timeSig: '3/4',
    rootOctave: 4,
    tip: 'Watch for the exciting octave leap from G4 up to G5 in the third phrase!',
    sequence: [
      [67, 0.75, 1], [67, 0.25, 1], [69, 1, 2], [67, 1, 1], [72, 1, 4], [71, 2, 3],
      [67, 0.75, 1], [67, 0.25, 1], [69, 1, 2], [67, 1, 1], [74, 1, 5], [72, 2, 4],
      [67, 0.75, 1], [67, 0.25, 1], [79, 1, 5], [76, 1, 3], [72, 1, 2], [71, 1, 2], [69, 2, 1],
      [77, 0.75, 5], [77, 0.25, 5], [76, 1, 4], [72, 1, 2], [74, 1, 3], [72, 2.5, 2],
    ],
  }),

  makeSong({
    id: 'fur-elise',
    title: 'Für Elise (Opening Motif)',
    composer: 'Ludwig van Beethoven',
    level: 'Intermediate',
    levelColor: '#a78bfa',
    bpm: 112,
    timeSig: '3/8',
    rootOctave: 4,
    tip: 'Alternate fingers 5 and 4 lightly on E5–D♯5 like tiptoeing starlight, then cascade gently down to A4.',
    sequence: [
      [76, 0.5, 5], [75, 0.5, 4], [76, 0.5, 5], [75, 0.5, 4], [76, 0.5, 5],
      [71, 0.5, 2], [74, 0.5, 4], [72, 0.5, 3], [69, 1.5, 1],
      [60, 0.5, 1], [64, 0.5, 2], [69, 0.5, 4], [71, 1.5, 5],
      [64, 0.5, 1], [68, 0.5, 2], [71, 0.5, 4], [72, 1.5, 5],

      [64, 0.5, 1], [76, 0.5, 5], [75, 0.5, 4], [76, 0.5, 5], [75, 0.5, 4], [76, 0.5, 5],
      [71, 0.5, 2], [74, 0.5, 4], [72, 0.5, 3], [69, 1.5, 1],
      [60, 0.5, 1], [64, 0.5, 2], [69, 0.5, 4], [71, 1.5, 5],
      [64, 0.5, 1], [72, 0.5, 4], [71, 0.5, 3], [69, 2.5, 2],
    ],
  }),

  makeSong({
    id: 'canon-in-d',
    title: 'Canon in D (Enchanted Theme)',
    composer: 'Johann Pachelbel',
    level: 'Intermediate',
    levelColor: '#a78bfa',
    bpm: 88,
    rootOctave: 4,
    tip: 'D Major uses two sparkly black keys: F♯ and C♯. Hold the sustain pedal lightly for a dreamy glow!',
    sequence: [
      [78, 2, 5], [76, 2, 4], [74, 2, 3], [73, 2, 2],
      [71, 2, 2], [69, 2, 1], [71, 2, 2], [73, 2, 3],
      [74, 1, 4], [73, 1, 3], [74, 1, 4], [66, 1, 1],
      [69, 1, 2], [71, 1, 3], [69, 1, 2], [67, 1, 1],
      [66, 1, 2], [67, 1, 3], [69, 1, 4], [71, 1, 5],
      [69, 1, 4], [67, 1, 3], [66, 1, 2], [64, 1, 1],
      [62, 3, 1],
    ],
  }),

  makeSong({
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Renaissance Folk Air',
    level: 'Intermediate',
    levelColor: '#a78bfa',
    bpm: 96,
    timeSig: '3/4',
    rootOctave: 4,
    tip: 'Count a gentle swaying 1–2–3 waltz pulse. Notice how G♯ adds a luminous medieval cadence.',
    sequence: [
      [69, 1, 1],
      [72, 2, 3], [74, 1, 4],
      [76, 1.5, 5], [77, 0.5, 5], [76, 1, 4],
      [74, 2, 3], [71, 1, 2],
      [67, 1.5, 1], [69, 0.5, 2], [71, 1, 3],
      [72, 2, 4], [69, 1, 2],
      [69, 1.5, 2], [68, 0.5, 1], [69, 1, 2],
      [71, 2, 3], [68, 1, 2],
      [64, 2, 1], [69, 1, 2],

      [72, 2, 3], [74, 1, 4],
      [76, 1.5, 5], [77, 0.5, 5], [76, 1, 4],
      [74, 2, 3], [71, 1, 2],
      [67, 1.5, 1], [69, 0.5, 2], [71, 1, 3],
      [72, 1.5, 4], [71, 0.5, 3], [69, 1, 2],
      [68, 1.5, 2], [66, 0.5, 1], [68, 1, 2],
      [69, 3, 3],
    ],
  }),
];

export function getSongById(id) {
  return SONGS.find((s) => s.id === id) || SONGS[0];
}
