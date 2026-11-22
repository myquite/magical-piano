// ============================================================================
// Nocturne Keys — Curated Adult Repertoire (Jazz, Lo-Fi & Impressionist)
// Each event supports single notes OR multi-note voicings, piano fingerings
// (1=Thumb .. 5=Pinky), beat durations, key signatures, and optional chord symbols.
// ============================================================================

/**
 * Convert sequential tuples:
 * [midiOrArray, durationBeats, fingerOrArray, optionalChordLabel]
 * into timed events with { beat, notes, duration, fingers, chord }.
 */
function buildSequence(items, startBeat = 0) {
  let cursor = startBeat;
  const events = [];
  for (const item of items) {
    const [pitchSpec, dur, fingerSpec, chordLabel] = item;
    if (pitchSpec === null) {
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
      chord: chordLabel || null,
    });
    cursor += dur;
  }
  return { events, totalBeats: cursor };
}

function makeSong({
  id,
  title,
  composer,
  level,
  levelColor,
  bpm,
  timeSig,
  keyLabel,
  keySigCount = 0,
  preferFlats = false,
  tip,
  sequence,
}) {
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
    keyLabel: keyLabel || 'C Major',
    keySigCount,
    preferFlats,
    tip,
    events,
    totalBeats,
    minMidi,
    maxMidi,
  };
}

export const SONGS = [
  makeSong({
    id: 'midnight-cafe',
    title: 'Midnight Café (Lo-Fi ii–V–I)',
    composer: 'Jazz Harmony Etude',
    level: 'Foundations',
    levelColor: '#7cc4a9',
    bpm: 78,
    timeSig: '4/4',
    keyLabel: 'C Major',
    keySigCount: 0,
    preferFlats: false,
    tip: 'Notice the voice leading from Dm7 to G7: only two fingers move a step while F and D stay anchored.',
    sequence: [
      // Bar 1: Dm7 arpeggio -> warm block voicing
      [62, 1, 1, 'Dm7'], [65, 1, 2], [69, 1, 3], [72, 1, 5],
      [[62, 65, 69, 72], 2, [1, 2, 3, 5]], [null, 0.5], [72, 0.5, 5], [71, 1, 4],
      // Bar 3: G7 (smooth inversion D-F-G-B)
      [62, 1, 1, 'G7'], [65, 1, 2], [67, 1, 3], [71, 1, 5],
      [[62, 65, 67, 71], 2, [1, 2, 3, 5]], [null, 0.5], [71, 0.5, 5], [69, 1, 4],
      // Bar 5: Cmaj7 (C-E-G-B)
      [60, 1, 1, 'Cmaj7'], [64, 1, 2], [67, 1, 3], [71, 1, 5],
      [[60, 64, 67, 71], 2, [1, 2, 3, 5]], [69, 1, 4], [67, 1, 3],
      // Bar 7: Am7 -> gentle Cmaj9 cadence
      [60, 1, 1, 'Am7'], [64, 1, 2], [67, 1, 3], [69, 1, 4],
      [[60, 64, 67, 71], 3, [1, 2, 3, 5], 'Cmaj7'],
    ],
  }),

  makeSong({
    id: 'rainy-window',
    title: 'Rainy Window (Lo-Fi Ballad)',
    composer: 'Sight-Reading Study',
    level: 'Foundations',
    levelColor: '#7cc4a9',
    bpm: 74,
    timeSig: '4/4',
    keyLabel: 'F Major',
    keySigCount: -1,
    preferFlats: true,
    tip: 'One flat in the key signature: every B is played as B♭. Let the sustain pedal gently blend the final Fmaj7.',
    sequence: [
      [69, 1.5, 3, 'Fmaj7'], [67, 0.5, 2], [65, 1, 1], [67, 1, 2],
      [69, 2, 3], [72, 2, 5],
      [70, 1.5, 4, 'Gm7'], [69, 0.5, 3], [67, 1, 2], [65, 1, 1],
      [67, 3, 2, 'C7'], [null, 1],

      [69, 1.5, 3, 'Dm7'], [70, 0.5, 4], [72, 1, 5], [69, 1, 3],
      [67, 1.5, 2, 'B♭maj7'], [65, 0.5, 1], [62, 2, 1],
      [65, 1, 1, 'Gm7'], [67, 1, 2], [69, 1, 3], [70, 1, 4],
      [67, 2, 2, 'C7'], [[65, 69, 72, 76], 3, [1, 2, 3, 5], 'Fmaj7'],
    ],
  }),

  makeSong({
    id: 'gymnopedie-1',
    title: 'Gymnopédie No. 1 (Theme)',
    composer: 'Erik Satie',
    level: 'Beginner',
    levelColor: '#e5a864',
    bpm: 76,
    timeSig: '3/4',
    keyLabel: 'D Major',
    keySigCount: 2,
    preferFlats: false,
    tip: 'Two sharps (F♯, C♯). Count a unhurried 1–2–3 pulse and let the opening Gmaj7 and Dmaj7 chords breathe.',
    sequence: [
      // Gentle two-bar harmonic introduction
      [55, 1, 1, 'Gmaj7'], [[62, 66, 71], 2, [1, 3, 5]],
      [50, 1, 1, 'Dmaj7'], [[61, 66, 69], 2, [1, 3, 5]],
      // Unforgettable Satie melody
      [null, 1], [78, 1, 3, 'Gmaj7'], [81, 1, 5],
      [79, 1, 4, 'Dmaj7'], [78, 1, 3], [73, 1, 2],
      [71, 1, 1, 'Gmaj7'], [73, 1, 2], [74, 1, 3],
      [69, 3, 1, 'Dmaj7'],
      [66, 3, 1, 'Gmaj7'],
      [null, 1], [78, 1, 3, 'Dmaj7'], [81, 1, 5],
      [79, 1, 4, 'Gmaj7'], [78, 1, 3], [73, 1, 2],
      [71, 1, 1, 'Dmaj7'], [73, 1, 2], [74, 1, 3],
      [69, 3, 1, 'Gmaj7'],
      [[61, 66, 69], 3, [1, 3, 5], 'Dmaj7'],
    ],
  }),

  makeSong({
    id: 'autumn-cadence',
    title: 'Autumn Leaves (Cadence Study)',
    composer: 'Jazz Standard Idiom',
    level: 'Beginner+',
    levelColor: '#e5a864',
    bpm: 92,
    timeSig: '4/4',
    keyLabel: 'A Minor',
    keySigCount: 0,
    preferFlats: false,
    tip: 'Listen to how the same 4-note rising motif walks smoothly down the scale through a jazz circle-of-fifths.',
    sequence: [
      // Phrase 1: Dm7 -> G7
      [64, 1, 2, 'Dm7'], [65, 1, 3], [67, 1, 4], [72, 3, 5], [null, 2],
      [62, 1, 1, 'G7'], [64, 1, 2], [65, 1, 3], [71, 3, 5], [null, 2],
      // Phrase 2: Cmaj7 -> Fmaj7
      [60, 1, 1, 'Cmaj7'], [62, 1, 2], [64, 1, 3], [69, 3, 5], [null, 2],
      [59, 1, 1, 'Fmaj7'], [60, 1, 2], [62, 1, 3], [67, 3, 5], [null, 2],
      // Turnaround: Bm7b5 -> E7 -> Am7
      [57, 1, 1, 'Bm7♭5'], [59, 1, 2], [60, 1, 3], [66, 2, 5],
      [64, 1, 4, 'E7'], [62, 1, 3], [60, 1, 2], [59, 1, 1],
      [[57, 60, 64, 67], 3, [1, 2, 3, 5], 'Am7'],
    ],
  }),

  makeSong({
    id: 'blue-hour',
    title: 'Blue Hour (C Minor Blues)',
    composer: 'Late-Night Groove Study',
    level: 'Groove',
    levelColor: '#76a5d6',
    bpm: 86,
    timeSig: '4/4',
    keyLabel: 'C Minor',
    keySigCount: -3,
    preferFlats: true,
    tip: 'Lean softly into the G♭ "blue note" as it slides into G or F — that chromatic friction gives jazz blues its swagger.',
    sequence: [
      [60, 1, 1, 'Cm7'], [63, 1, 2], [65, 0.5, 3], [66, 0.5, 4], [67, 1, 5],
      [65, 1, 3], [63, 1, 2], [60, 2, 1],
      [65, 1, 2, 'Fm7'], [68, 1, 4], [70, 0.5, 5], [69, 0.5, 4], [68, 1, 3],
      [65, 2, 1], [63, 2, 1],
      [70, 1, 5, 'G7'], [67, 1, 3], [66, 0.5, 3], [65, 0.5, 2], [63, 1, 1],
      [65, 1, 3, 'Fm7'], [63, 1, 2], [60, 1, 1], [58, 1, 1],
      [[60, 63, 67, 70], 3, [1, 2, 3, 5], 'Cm7'],
    ],
  }),

  makeSong({
    id: 'neo-soul-shells',
    title: 'Velvet Voicings (Neo-Soul Loop)',
    composer: 'Chord Craft Etude',
    level: 'Chords',
    levelColor: '#dc89a0',
    bpm: 74,
    timeSig: '4/4',
    keyLabel: 'C Major',
    keySigCount: 0,
    preferFlats: false,
    tip: 'Hold the sustain pedal lightly between chord changes. Notice how upper 7th and 9th tones create the signature lo-fi glow.',
    sequence: [
      // Fmaj7
      [[65, 69, 72, 76], 2, [1, 2, 3, 5], 'Fmaj7'], [74, 1, 4], [72, 1, 3],
      // Em7
      [[64, 67, 71, 74], 2, [1, 2, 3, 5], 'Em7'], [72, 1, 4], [71, 1, 3],
      // Dm9 (D-F-A-C-E -> compact F-A-C-E over D bass)
      [62, 1, 1, 'Dm9'], [[65, 69, 72, 76], 2, [1, 2, 3, 5]], [74, 1, 4],
      // G13 shell -> Cmaj7
      [[65, 69, 71, 76], 2, [1, 2, 3, 5], 'G13'],
      [[64, 67, 71, 74], 3, [1, 2, 3, 5], 'Cmaj9'],
    ],
  }),

  makeSong({
    id: 'bach-prelude-c',
    title: 'Prelude in C Major (BWV 846)',
    composer: 'Johann Sebastian Bach',
    level: 'Reading',
    levelColor: '#76a5d6',
    bpm: 82,
    timeSig: '4/4',
    keyLabel: 'C Major',
    keySigCount: 0,
    preferFlats: false,
    tip: 'Read each 8-note wave as a single harmony: C major, Dm7/C, G7/B, then home to C. Great Grand Staff bridging practice.',
    sequence: [
      // Bar 1: C Major
      [60, 0.5, 1, 'C'], [64, 0.5, 2], [67, 0.5, 3], [72, 0.5, 4], [76, 0.5, 5],
      [67, 0.5, 3], [72, 0.5, 4], [76, 0.5, 5],
      // Bar 2: Dm7/C
      [60, 0.5, 1, 'Dm7/C'], [62, 0.5, 2], [69, 0.5, 3], [74, 0.5, 4], [77, 0.5, 5],
      [69, 0.5, 3], [74, 0.5, 4], [77, 0.5, 5],
      // Bar 3: G7/B
      [59, 0.5, 1, 'G7/B'], [62, 0.5, 2], [67, 0.5, 3], [74, 0.5, 4], [77, 0.5, 5],
      [67, 0.5, 3], [74, 0.5, 4], [77, 0.5, 5],
      // Bar 4: C Major
      [60, 0.5, 1, 'C'], [64, 0.5, 2], [67, 0.5, 3], [72, 0.5, 4], [76, 0.5, 5],
      [67, 0.5, 3], [72, 0.5, 4], [76, 1.5, 5],
      // Resolution
      [[60, 64, 67, 72], 2.5, [1, 2, 3, 5], 'C'],
    ],
  }),

  makeSong({
    id: 'gnossienne-1',
    title: 'Gnossienne No. 1 (Opening)',
    composer: 'Erik Satie',
    level: 'Expressive',
    levelColor: '#a994db',
    bpm: 74,
    timeSig: '4/4',
    keyLabel: 'F Minor',
    keySigCount: -4,
    preferFlats: true,
    tip: 'Satie uses natural signs (E♮ and B♮) against four flats to create an exotic augmented-second interval.',
    sequence: [
      [65, 1, 1, 'Fm'], [68, 1, 3], [67, 1, 2], [65, 1, 1],
      [64, 2, 1], [65, 1, 2], [67, 1, 3],
      [68, 1, 3, 'Fm'], [71, 1, 5], [72, 1.5, 5], [71, 0.5, 4],
      [68, 1, 3], [67, 1, 2], [65, 2, 1],
      [64, 1.5, 1, 'C7'], [65, 0.5, 2], [67, 1, 3], [68, 1, 4],
      [67, 1, 3], [65, 1, 2], [64, 2, 1],
      [[53, 60, 65, 68], 3, [1, 2, 4, 5], 'Fm'],
    ],
  }),

  makeSong({
    id: 'clair-de-lune',
    title: 'Clair de Lune (Opening Motif)',
    composer: 'Claude Debussy',
    level: 'Intermediate',
    levelColor: '#a994db',
    bpm: 64,
    timeSig: '3/4',
    keyLabel: 'D♭ Major',
    keySigCount: -5,
    preferFlats: true,
    tip: 'Five flats (B♭, E♭, A♭, D♭, G♭) mean almost every black key is in your scale. Let the descending thirds float effortlessly.',
    sequence: [
      [null, 1], [[73, 77], 2, [2, 5], 'D♭'],
      [[70, 73], 2, [1, 3], 'Fm7'], [72, 0.5, 3], [73, 0.5, 4],
      [72, 2, 3, 'G♭maj7'], [70, 0.5, 2], [72, 0.5, 3],
      [70, 2, 2, 'E♭m7'], [68, 0.5, 1], [70, 0.5, 2],
      [68, 2, 2, 'A♭7'], [66, 0.5, 1], [68, 0.5, 2],
      [66, 1.5, 2], [65, 0.5, 1], [66, 1, 2],
      [65, 2, 2, 'D♭maj7'], [[61, 65, 68, 72], 3, [1, 2, 3, 5], 'D♭maj7'],
    ],
  }),

  makeSong({
    id: 'moonlight-motif',
    title: 'Moonlight Sonata (1st Mvt. Motif)',
    composer: 'Ludwig van Beethoven',
    level: 'Intermediate',
    levelColor: '#a994db',
    bpm: 62,
    timeSig: '4/4',
    keyLabel: 'C♯ Minor',
    keySigCount: 4,
    preferFlats: false,
    tip: 'Four sharps (F♯, C♯, G♯, D♯). Keep the rolling arpeggio velvety and even, bridging Bass Clef G♯3 up into Treble E4.',
    sequence: [
      // Bar 1: C#m
      [56, 0.5, 1, 'C♯m'], [61, 0.5, 3], [64, 0.5, 5],
      [56, 0.5, 1], [61, 0.5, 3], [64, 0.5, 5],
      [56, 0.5, 1], [61, 0.5, 3], [64, 0.5, 5],
      [56, 0.5, 1], [61, 0.5, 3], [64, 0.5, 5],
      // Bar 2: A major -> D major (Neapolitan colour)
      [57, 0.5, 1, 'A'], [61, 0.5, 3], [64, 0.5, 5],
      [57, 0.5, 1], [61, 0.5, 3], [64, 0.5, 5],
      [57, 0.5, 1, 'D'], [62, 0.5, 3], [66, 0.5, 5],
      [57, 0.5, 1], [62, 0.5, 3], [66, 0.5, 5],
      // Bar 3: G#7 -> C#m cadence
      [56, 0.5, 1, 'G♯7'], [60, 0.5, 2], [66, 0.5, 5],
      [56, 0.5, 1, 'C♯m'], [61, 0.5, 3], [64, 0.5, 5],
      [56, 0.5, 1, 'G♯7'], [61, 0.5, 3], [63, 0.5, 4],
      [[56, 61, 64], 2.5, [1, 3, 5], 'C♯m'],
    ],
  }),
];

export function getSongById(id) {
  return SONGS.find((s) => s.id === id) || SONGS[0];
}
