// ============================================================================
// Nocturne Keys — Adult Music Pedagogy, Repertoire, Harmony & Sight/Ear Engine
// ============================================================================

import {
  SCALES,
  MAJOR_KEY_SIG_COUNT,
  INTERVAL_INFO,
  getScalePitchClasses,
  getDiatonicChords,
  rootPrefersFlats,
  midiToNoteInfo,
} from './musicTheory.js';
import { SONGS, getSongById } from './songs.js';

export class LearningEngine {
  constructor({ audio, keyboard, stage, onStateUpdate }) {
    this.audio = audio;
    this.keyboard = keyboard;
    this.stage = stage;
    this.onStateUpdate = onStateUpdate || (() => {});

    this.mode = 'freeplay'; // 'freeplay' | 'songs' | 'theory' | 'game'

    // ---- Freeplay Recorder State ----
    this.isRecording = false;
    this.isReplaying = false;
    this.recordedEvents = []; // { type: 'on'|'off', midi, timeMs }
    this._recordStartMs = 0;
    this._replayTimers = [];

    // ---- Repertoire / Song Studio State ----
    this.song = SONGS[0];
    this.songStyle = 'wait';       // 'wait' | 'play' | 'demo'
    this.songView = 'sheet';       // 'sheet' | 'waterfall'
    this.songGuidance = 'guided';  // 'guided' | 'assist' | 'pure'
    this.speedMultiplier = 1.0;
    this.songPlaying = false;
    this.currentBeat = -1.2;
    this.waitIndex = 0;
    this.hitEvents = new Set();
    this.chordBuffer = new Set();
    this.songStats = { hits: 0, misses: 0, streak: 0, bestStreak: 0, finished: false };
    this._songRaf = null;
    this._lastSongTs = 0;
    this._demoTriggered = new Set();
    this._demoReleaseTimers = [];

    // ---- Harmony & Scales Explorer State ----
    this.theoryRootPc = 0; // C
    this.theoryScaleId = 'major';
    this.theorySevenths = true; // Jazz 7th chords by default
    this.activeChordIdx = null;
    this._theoryTimers = [];

    // ---- Sight & Ear Atelier State ----
    this.gameKind = 'sight';       // 'sight' | 'chords' | 'intervals' | 'echo'
    this.gameClef = 'grand';       // 'treble' | 'bass' | 'grand'
    this.gameDifficulty = 'easy';  // 'easy' (Landmarks) | 'medium' (Diatonic) | 'pro' (Accidentals)
    this.gameSolved = 0;
    this.gameAttempts = 0;
    this.gameBest = Number(localStorage.getItem('nocturne_sight_best') || 0);
    this.gameStreak = 0;
    this.gameTargetSeq = [];       // For sight/intervals/echo: sequential MIDI targets
    this.gameChordTargets = [];    // For 'chords' drill: target chord MIDI notes
    this.gameChordHit = new Set();
    this.gameChordName = '';
    this.gameAnchorMidi = null;    // For 'intervals' drill
    this.gameInputIdx = 0;
    this.gameBusy = false;
    this._gameTimers = [];
  }

  // --------------------------------------------------------------------------
  // Mode Switching & Cleanup
  // --------------------------------------------------------------------------
  setMode(newMode) {
    this.stopAllActivities();
    this.mode = newMode;

    // Reset overlays
    this.keyboard.setScaleGuide(null, null);
    this.keyboard.setTargets([]);
    this.keyboard.setChordHighlight([]);
    this.keyboard.setDualRowSuspended(newMode === 'songs' && this.songView === 'waterfall');
    this.stage.setFallingState(null);
    this.stage.setPromptNotes([]);
    this.stage.setTranscribedNotes([]);
    this.stage.setKeySignature(0);
    this.stage.setPreferFlats(false);
    this.keyboard.setPreferFlats(false);

    if (newMode === 'freeplay') {
      this.stage.showNote('Open session — strike a voicing to inspect intervals & notation', 'warm', 3.0);
    } else if (newMode === 'songs') {
      this.selectSong(this.song.id, false);
      this.stage.showNote(`${this.song.title} — ${this.song.keyLabel}, ${this.song.timeSig}`, 'warm', 3.2);
    } else if (newMode === 'theory') {
      this.applyTheoryView();
      this.stage.showNote('Tap any chord pad to hear its voicing and see it highlighted', 'warm', 3.4);
    } else if (newMode === 'game') {
      this.startGameRound();
    }

    this._emit();
  }

  stopAllActivities() {
    this.stopSong(false);
    this.stopReplay();
    this._clearTheoryTimers();
    this._clearGameTimers();
  }

  // --------------------------------------------------------------------------
  // User Note Events (from KeyboardUI or Web MIDI)
  // --------------------------------------------------------------------------
  handleUserNoteOn(midi) {
    if (this.isRecording) {
      this.recordedEvents.push({
        type: 'on',
        midi,
        timeMs: performance.now() - this._recordStartMs,
      });
    }

    if (this.mode === 'songs' && this.songPlaying && this.songStyle !== 'demo') {
      this._handleSongNoteHit(midi);
    }

    if (this.mode === 'theory' && this.activeChordIdx !== null) {
      this._checkTheoryChordPlayed();
    }

    if (this.mode === 'game' && !this.gameBusy) {
      this._handleGameInput(midi);
    }
  }

  handleUserNoteOff(midi) {
    if (this.isRecording) {
      this.recordedEvents.push({
        type: 'off',
        midi,
        timeMs: performance.now() - this._recordStartMs,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Freeplay Phrase Recorder
  // --------------------------------------------------------------------------
  toggleRecording() {
    if (this.isRecording) {
      this.isRecording = false;
      this.stage.showNote(
        this.recordedEvents.length > 0 ? 'Phrase captured — press Replay to listen back' : 'Recording stopped',
        'sage',
        2.8
      );
    } else {
      this.stopReplay();
      this.recordedEvents = [];
      this._recordStartMs = performance.now();
      this.isRecording = true;
      this.stage.showNote('Recording phrase…', 'rose', 3.0);
    }
    this._emit();
  }

  toggleReplay() {
    if (this.isReplaying) {
      this.stopReplay();
      return;
    }
    if (this.recordedEvents.length === 0) {
      this.stage.showNote('Record a short phrase first', 'amber', 2.4);
      return;
    }
    this.isRecording = false;
    this.isReplaying = true;
    this._emit();

    const firstOffset = this.recordedEvents[0].timeMs;
    let maxTime = 0;

    for (const ev of this.recordedEvents) {
      const delay = Math.max(0, ev.timeMs - firstOffset);
      if (delay > maxTime) maxTime = delay;
      const timer = setTimeout(() => {
        if (!this.isReplaying) return;
        if (ev.type === 'on') {
          this.audio.noteOn(ev.midi, 0.76);
          this.keyboard.setExternalActive(ev.midi, true);
          this.stage.triggerNoteVisual(ev.midi, true);
        } else {
          this.audio.noteOff(ev.midi);
          this.keyboard.setExternalActive(ev.midi, false);
          this.stage.releaseNoteVisual(ev.midi);
        }
      }, delay);
      this._replayTimers.push(timer);
    }

    const endTimer = setTimeout(() => {
      this.stopReplay();
    }, maxTime + 450);
    this._replayTimers.push(endTimer);
  }

  stopReplay() {
    this.isReplaying = false;
    for (const t of this._replayTimers) clearTimeout(t);
    this._replayTimers = [];
    for (const midi of this.keyboard.visibleMidis) {
      this.keyboard.setExternalActive(midi, false);
    }
    this._emit();
  }

  // --------------------------------------------------------------------------
  // Repertoire / Song Studio (Sheet Music & Waterfall, Wait / Tempo / Listen)
  // --------------------------------------------------------------------------
  selectSong(songId, autoStart = false) {
    this.stopSong(false);
    this.song = getSongById(songId);
    this.stage.setPreferFlats(Boolean(this.song.preferFlats));
    this.stage.setKeySignature(this.song.keySigCount || 0);
    this.keyboard.setPreferFlats(Boolean(this.song.preferFlats));
    this.keyboard.ensureMidiRangeVisible(this.song.minMidi, this.song.maxMidi);
    this._resetSongProgress();

    this._updateSongTargets();
    this.stage.setFallingState({
      song: this.song,
      currentBeat: -0.5,
      waitIndex: 0,
      lookaheadBeats: 4.2,
      hitEvents: this.hitEvents,
    });

    if (autoStart) {
      this.startSong(this.songStyle);
    } else {
      this._emit();
    }
  }

  setSongStyle(style) {
    this.songStyle = style;
    if (this.songPlaying) {
      this.startSong(style);
    } else {
      this._emit();
    }
  }

  setSongView(view) {
    this.songView = view === 'waterfall' ? 'waterfall' : 'sheet';
    this.stage.setSongView(this.songView);
    this.keyboard.setDualRowSuspended(this.mode === 'songs' && this.songView === 'waterfall');
    this._emit();
  }

  setSongGuidance(level) {
    this.songGuidance = level; // 'guided' | 'assist' | 'pure'
    this.stage.setSongGuidance(level);
    this._updateSongTargets();
    const labelMap = {
      guided: 'Guided — staff, fingerings & glowing keys',
      assist: 'Reading Assist — staff & fingerings only (keys unlit)',
      pure: 'Pure Sheet — clean notation without hints',
    };
    this.stage.showNote(labelMap[level] || '', 'warm', 2.8);
    this._emit();
  }

  setSpeedMultiplier(mult) {
    this.speedMultiplier = Math.max(0.5, Math.min(1.25, mult));
    this._emit();
  }

  _resetSongProgress() {
    this.currentBeat = -0.9;
    this.waitIndex = 0;
    this.hitEvents = new Set();
    this.chordBuffer = new Set();
    this._demoTriggered = new Set();
    this.songStats = { hits: 0, misses: 0, streak: 0, bestStreak: 0, finished: false };
  }

  startSong(style = this.songStyle) {
    this.stopSong(false);
    this.songStyle = style;
    this.stage.setPreferFlats(Boolean(this.song.preferFlats));
    this.stage.setKeySignature(this.song.keySigCount || 0);
    this.keyboard.setPreferFlats(Boolean(this.song.preferFlats));
    this.keyboard.ensureMidiRangeVisible(this.song.minMidi, this.song.maxMidi);
    this._resetSongProgress();
    this.songPlaying = true;
    this._lastSongTs = performance.now();

    if (style === 'demo') {
      this.stage.showNote(`Previewing ${this.song.title} (${this.song.composer})`, 'warm', 3.0);
    } else if (style === 'wait') {
      this.stage.showNote('Wait Mode — read at your own tempo; the score waits for each note', 'warm', 3.2);
    } else {
      this.stage.showNote(`Tempo Mode — ${Math.round(this.song.bpm * this.speedMultiplier)} BPM`, 'warm', 2.8);
    }

    this._updateSongTargets();
    this._emit();
    this._songLoop();
  }

  stopSong(resetPreview = true) {
    this.songPlaying = false;
    if (this._songRaf) {
      cancelAnimationFrame(this._songRaf);
      this._songRaf = null;
    }
    for (const t of this._demoReleaseTimers) clearTimeout(t);
    this._demoReleaseTimers = [];
    for (const midi of this.keyboard.visibleMidis) {
      this.keyboard.setExternalActive(midi, false);
    }
    if (resetPreview && this.mode === 'songs') {
      this._resetSongProgress();
      this._updateSongTargets();
      this.stage.setFallingState({
        song: this.song,
        currentBeat: -0.5,
        waitIndex: 0,
        lookaheadBeats: 4.2,
        hitEvents: this.hitEvents,
      });
    }
    this._emit();
  }

  _songLoop() {
    const step = (now) => {
      if (!this.songPlaying || this.mode !== 'songs') return;
      const dt = Math.min(0.05, (now - this._lastSongTs) / 1000);
      this._lastSongTs = now;

      const beatsPerSec = (this.song.bpm / 60) * this.speedMultiplier;

      if (this.songStyle === 'wait') {
        const targetEv = this.song.events[this.waitIndex];
        if (!targetEv) {
          this._finishSong();
          return;
        }
        if (this.currentBeat < targetEv.beat) {
          this.currentBeat = Math.min(targetEv.beat, this.currentBeat + dt * beatsPerSec);
        }
      } else if (this.songStyle === 'demo') {
        this.currentBeat += dt * beatsPerSec;
        this.song.events.forEach((ev, idx) => {
          if (!this._demoTriggered.has(idx) && this.currentBeat >= ev.beat) {
            this._demoTriggered.add(idx);
            this.hitEvents.add(idx);
            this.waitIndex = idx + 1;
            const durMs = Math.max(150, (ev.duration / beatsPerSec) * 1000 * 0.90);

            ev.notes.forEach((midi) => {
              this.audio.noteOn(midi, 0.74);
              this.keyboard.setExternalActive(midi, true);
              this.stage.triggerNoteVisual(midi, true);

              const rel = setTimeout(() => {
                this.audio.noteOff(midi);
                this.keyboard.setExternalActive(midi, false);
                this.stage.releaseNoteVisual(midi);
              }, durMs);
              this._demoReleaseTimers.push(rel);
            });
            this._updateSongTargets();
          }
        });

        if (this.currentBeat > this.song.totalBeats + 0.8) {
          this.stopSong(true);
          this.stage.showNote('Demo complete — switch to Wait Mode to read through it yourself', 'sage', 3.6);
          return;
        }
      } else if (this.songStyle === 'play') {
        this.currentBeat += dt * beatsPerSec;

        while (this.waitIndex < this.song.events.length) {
          const ev = this.song.events[this.waitIndex];
          if (this.hitEvents.has(this.waitIndex)) {
            this.waitIndex++;
            continue;
          }
          if (this.currentBeat > ev.beat + 0.62) {
            this.songStats.misses++;
            this.songStats.streak = 0;
            this.chordBuffer.clear();
            this.waitIndex++;
            this._updateSongTargets();
            this._emit();
          } else {
            break;
          }
        }

        if (this.currentBeat > this.song.totalBeats + 0.9) {
          this._finishSong();
          return;
        }
      }

      this.stage.setFallingState({
        song: this.song,
        currentBeat: this.currentBeat,
        waitIndex: this.waitIndex,
        lookaheadBeats: 4.2,
        hitEvents: this.hitEvents,
      });

      this._songRaf = requestAnimationFrame(step);
    };

    this._songRaf = requestAnimationFrame(step);
  }

  _handleSongNoteHit(midi) {
    const ev = this.song.events[this.waitIndex];
    if (!ev) return;

    if (this.songStyle === 'play') {
      const dist = Math.abs(this.currentBeat - ev.beat);
      if (dist > 0.75) return;
    }

    if (ev.notes.includes(midi)) {
      this.chordBuffer.add(midi);

      const allHit = ev.notes.every((n) => this.chordBuffer.has(n));
      if (allHit) {
        this.hitEvents.add(this.waitIndex);
        this.chordBuffer.clear();
        this.songStats.hits++;
        this.songStats.streak++;
        if (this.songStats.streak > this.songStats.bestStreak) {
          this.songStats.bestStreak = this.songStats.streak;
        }

        this.waitIndex++;
        if (this.waitIndex >= this.song.events.length) {
          this._finishSong();
          return;
        }

        const prevBeat = ev.beat;
        if (this.songStyle === 'wait' && this.currentBeat < prevBeat) {
          this.currentBeat = prevBeat;
        }
        this._updateSongTargets();
        this._emit();
      }
    } else if (this.songStyle === 'wait') {
      this.songStats.misses++;
      this.songStats.streak = 0;
      const preferFlats = Boolean(this.song.preferFlats);
      const needed = ev.notes.map((n) => midiToNoteInfo(n, preferFlats).fullName).join(' + ');
      if (this.songGuidance === 'pure') {
        const dir = midi < ev.notes[0] ? 'higher' : 'lower';
        this.stage.showNote(`Read a little ${dir} on the staff`, 'amber', 2.0);
      } else {
        this.stage.showNote(`Target: ${needed}`, 'amber', 2.0);
      }
      this._emit();
    }
  }

  _updateSongTargets() {
    if (this.mode !== 'songs') {
      this.keyboard.setTargets([]);
      return;
    }
    const ev = this.song.events[this.waitIndex];
    if (!ev || this.songStyle === 'demo') {
      this.keyboard.setTargets([]);
      return;
    }

    // Keep upcoming phrase framed in the visible keyboard range
    const minN = Math.min(...ev.notes);
    const maxN = Math.max(...ev.notes);
    if (minN < this.keyboard.startMidi || maxN > this.keyboard.getEndMidi()) {
      let phraseMin = minN;
      let phraseMax = maxN;
      for (let k = 1; k <= 2; k++) {
        const nextEv = this.song.events[this.waitIndex + k];
        if (!nextEv) break;
        const candMin = Math.min(phraseMin, ...nextEv.notes);
        const candMax = Math.max(phraseMax, ...nextEv.notes);
        if (candMax - candMin <= 14) {
          phraseMin = candMin;
          phraseMax = candMax;
        }
      }
      this.keyboard.ensureMidiRangeVisible(phraseMin, phraseMax);
    }

    // Only light up target keys in 'guided' mode (in 'assist' & 'pure', learner reads from the staff!)
    if (this.songGuidance !== 'guided') {
      this.keyboard.setTargets([]);
      return;
    }

    const targets = ev.notes.map((midi, i) => ({
      midi,
      finger: ev.fingers[i] || null,
    }));
    this.keyboard.setTargets(targets);
  }

  _finishSong() {
    this.songPlaying = false;
    if (this._songRaf) {
      cancelAnimationFrame(this._songRaf);
      this._songRaf = null;
    }
    this.songStats.finished = true;
    this.keyboard.setTargets([]);

    const total = Math.max(1, this.songStats.hits + this.songStats.misses);
    const accuracy = Math.round((this.songStats.hits / total) * 100);
    const tempoPct = Math.round(this.speedMultiplier * 100);

    this.audio.playCadenceChime([60, 64, 67, 71, 74]);
    this.stage.celebrateBurst(`${this.song.title} — ${accuracy}% accuracy (${tempoPct}% tempo)`);
    this._emit();
  }

  // --------------------------------------------------------------------------
  // Harmony & Scales Explorer (Triads + Jazz 7th Chords)
  // --------------------------------------------------------------------------
  setTheoryKey(rootPc, scaleId = this.theoryScaleId) {
    this.theoryRootPc = ((rootPc % 12) + 12) % 12;
    this.theoryScaleId = scaleId;
    this.activeChordIdx = null;
    this.keyboard.setChordHighlight([]);
    this.applyTheoryView();
    this._emit();
  }

  setTheorySevenths(useSevenths) {
    this.theorySevenths = Boolean(useSevenths);
    this.activeChordIdx = null;
    this.keyboard.setChordHighlight([]);
    this._emit();
  }

  applyTheoryView() {
    const preferFlats = rootPrefersFlats(this.theoryRootPc);
    this.keyboard.setPreferFlats(preferFlats);
    this.stage.setPreferFlats(preferFlats);

    // Derive appropriate key signature for major/minor/dorian modes
    let sigRoot = this.theoryRootPc;
    if (this.theoryScaleId === 'minor') sigRoot = (this.theoryRootPc + 3) % 12;
    else if (this.theoryScaleId === 'dorian') sigRoot = (this.theoryRootPc + 10) % 12;
    else if (this.theoryScaleId === 'mixolydian') sigRoot = (this.theoryRootPc + 5) % 12;
    else if (this.theoryScaleId === 'lydian') sigRoot = (this.theoryRootPc + 7) % 12;
    this.stage.setKeySignature(MAJOR_KEY_SIG_COUNT[sigRoot] || 0);

    const pcs = getScalePitchClasses(this.theoryRootPc, this.theoryScaleId);
    this.keyboard.setScaleGuide(pcs, this.theoryRootPc);
  }

  getTheoryChords() {
    const baseOctave = Math.max(3, Math.min(4, Math.floor(this.keyboard.startMidi / 12) - 1));
    return getDiatonicChords(this.theoryRootPc, this.theoryScaleId, baseOctave, this.theorySevenths);
  }

  previewTheoryChord(chordIndex) {
    this._clearTheoryTimers();
    const chords = this.getTheoryChords();
    const chord = chords[chordIndex];
    if (!chord) return;

    this.activeChordIdx = chordIndex;
    this.keyboard.ensureMidiRangeVisible(Math.min(...chord.notes), Math.max(...chord.notes));
    this.keyboard.setChordHighlight(chord.notes);
    const noteNames = chord.notes.map((m) => midiToNoteInfo(m, rootPrefersFlats(this.theoryRootPc)).name).join(' · ');
    this.stage.showNote(`${chord.symbol} (${chord.roman}) — ${noteNames}`, 'warm', 3.6);

    chord.notes.forEach((midi, idx) => {
      const tOn = setTimeout(() => {
        this.audio.noteOn(midi, 0.72);
        this.keyboard.setExternalActive(midi, true);
        this.stage.triggerNoteVisual(midi, true);
      }, idx * 70);
      const tOff = setTimeout(() => {
        this.audio.noteOff(midi);
        this.keyboard.setExternalActive(midi, false);
        this.stage.releaseNoteVisual(midi);
      }, 1050 + idx * 50);
      this._theoryTimers.push(tOn, tOff);
    });
    this._emit();
  }

  playScaleDemo() {
    this._clearTheoryTimers();
    const scale = SCALES[this.theoryScaleId] || SCALES.major;
    const baseMidi = Math.floor(this.keyboard.startMidi / 12) * 12 + this.theoryRootPc;
    const start = baseMidi < this.keyboard.startMidi ? baseMidi + 12 : baseMidi;
    const seq = [...scale.intervals.map((iv) => start + iv), start + 12];

    this.keyboard.ensureMidiRangeVisible(seq[0], seq[seq.length - 1]);
    this.stage.showNote(`Auditioning ${scale.name}`, 'warm', 3.0);

    seq.forEach((midi, i) => {
      const tOn = setTimeout(() => {
        this.audio.noteOn(midi, 0.74);
        this.keyboard.setExternalActive(midi, true);
        this.stage.triggerNoteVisual(midi, true);
      }, i * 250);
      const tOff = setTimeout(() => {
        this.audio.noteOff(midi);
        this.keyboard.setExternalActive(midi, false);
        this.stage.releaseNoteVisual(midi);
      }, i * 250 + 210);
      this._theoryTimers.push(tOn, tOff);
    });
  }

  _checkTheoryChordPlayed() {
    const chords = this.getTheoryChords();
    const chord = chords[this.activeChordIdx];
    if (!chord) return;

    const held = this.keyboard.getActiveNotes();
    const heldPcs = new Set(held.map((m) => ((m % 12) + 12) % 12));
    const neededPcs = chord.notes.map((m) => ((m % 12) + 12) % 12);

    if (neededPcs.every((pc) => heldPcs.has(pc))) {
      this.stage.showNote(`Clean ${chord.symbol} voicing`, 'sage', 2.4);
      this.activeChordIdx = null;
      this.keyboard.setChordHighlight([]);
      this._emit();
    }
  }

  _clearTheoryTimers() {
    for (const t of this._theoryTimers) clearTimeout(t);
    this._theoryTimers = [];
    for (const midi of this.keyboard.visibleMidis) {
      this.keyboard.setExternalActive(midi, false);
    }
  }

  // --------------------------------------------------------------------------
  // Sight & Ear Atelier (Landmarks, Grand Staff, Chords, Intervals, Echo)
  // --------------------------------------------------------------------------
  setGameKind(kind) {
    this.gameKind = kind; // 'sight' | 'chords' | 'intervals' | 'echo'
    this.startGameRound();
  }

  setGameClef(clef) {
    this.gameClef = clef; // 'treble' | 'bass' | 'grand'
    this.startGameRound();
  }

  setGameDifficulty(diff) {
    this.gameDifficulty = diff; // 'easy' (Landmarks) | 'medium' (Diatonic) | 'pro' (Accidentals)
    this.startGameRound();
  }

  getGameAccuracy() {
    if (this.gameAttempts === 0) return 100;
    return Math.round((this.gameSolved / this.gameAttempts) * 100);
  }

  _getSightPool() {
    // Landmarks method: Middle C (60), Treble G (67), High C (72), Bass F (53), Low C (48) + step neighbours
    const trebleLandmarks = [60, 62, 64, 65, 67, 69, 72];
    const bassLandmarks   = [48, 50, 52, 53, 55, 57, 60];

    const trebleDiatonic  = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77];
    const bassDiatonic    = [43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60];

    const trebleChromatic = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 74, 75, 76];
    const bassChromatic   = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60];

    const pickTier = (t, b) => {
      if (this.gameClef === 'treble') return t.map((midi) => ({ midi, clef: 'treble' }));
      if (this.gameClef === 'bass') return b.map((midi) => ({ midi, clef: 'bass' }));
      return [
        ...t.map((midi) => ({ midi, clef: 'treble' })),
        ...b.filter((m) => m !== 60).map((midi) => ({ midi, clef: 'bass' })),
      ];
    };

    if (this.gameDifficulty === 'easy') return pickTier(trebleLandmarks, bassLandmarks);
    if (this.gameDifficulty === 'medium') return pickTier(trebleDiatonic, bassDiatonic);
    return pickTier(trebleChromatic, bassChromatic);
  }

  startGameRound() {
    this._clearGameTimers();
    this.keyboard.setTargets([]);
    this.stage.setShowStaff(true);
    this.stage.setTranscribedNotes([]);
    this.stage.setKeySignature(0);

    this.gameInputIdx = 0;
    this.gameChordTargets = [];
    this.gameChordHit.clear();
    this.gameAnchorMidi = null;

    if (this.gameKind === 'sight') {
      const pool = this._getSightPool();
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.gameTargetSeq = [pick.midi];

      // Frame keyboard cleanly for the selected clef
      if (pick.clef === 'bass') {
        this.keyboard.ensureMidiRangeVisible(48, 60);
      } else {
        this.keyboard.ensureMidiRangeVisible(60, 76);
      }

      const useFlat = this.gameDifficulty === 'pro' && Math.random() < 0.5;
      this.stage.setPreferFlats(useFlat);
      this.keyboard.setPreferFlats(useFlat);

      this.stage.setPromptNotes([{ midi: pick.midi, state: 'waiting', clef: pick.clef }]);
      const cue =
        this.gameDifficulty === 'easy'
          ? 'Anchor on Middle C, Treble G, or Bass F and read the note'
          : 'Identify and play the engraved pitch';
      this.stage.showNote(cue, 'warm', 3.2);
      this.gameBusy = false;
    } else if (this.gameKind === 'chords') {
      // Sight-Read Triads (easy) or Jazz 7th Chords (medium/pro) on the Grand Staff
      this.keyboard.ensureMidiRangeVisible(57, 76);
      const chordBank =
        this.gameDifficulty === 'easy'
          ? [
              { name: 'C Major', notes: [60, 64, 67], flats: false },
              { name: 'Dm',      notes: [62, 65, 69], flats: false },
              { name: 'Em',      notes: [64, 67, 71], flats: false },
              { name: 'F Major', notes: [65, 69, 72], flats: false },
              { name: 'G Major', notes: [67, 71, 74], flats: false },
              { name: 'Am',      notes: [69, 72, 76], flats: false },
            ]
          : this.gameDifficulty === 'medium'
          ? [
              { name: 'Cmaj7',   notes: [60, 64, 67, 71], flats: false },
              { name: 'Dm7',     notes: [62, 65, 69, 72], flats: false },
              { name: 'Em7',     notes: [64, 67, 71, 74], flats: false },
              { name: 'Fmaj7',   notes: [65, 69, 72, 76], flats: false },
              { name: 'G7',      notes: [62, 65, 67, 71], flats: false },
              { name: 'Am7',     notes: [60, 64, 67, 69], flats: false },
            ]
          : [
              { name: 'B♭maj7',  notes: [58, 62, 65, 69], flats: true },
              { name: 'Cm7',     notes: [60, 63, 67, 70], flats: true },
              { name: 'E♭maj7',  notes: [63, 67, 70, 74], flats: true },
              { name: 'Fm7',     notes: [65, 68, 72, 75], flats: true },
              { name: 'D7',      notes: [62, 66, 69, 72], flats: false },
              { name: 'Bm7♭5',   notes: [59, 62, 65, 69], flats: false },
            ];

      const pick = chordBank[Math.floor(Math.random() * chordBank.length)];
      this.gameChordTargets = pick.notes;
      this.gameChordName = pick.name;
      this.gameTargetSeq = pick.notes;
      this.stage.setPreferFlats(pick.flats);
      this.keyboard.setPreferFlats(pick.flats);
      this.stage.setPromptNotes(
        pick.notes.map((midi) => ({ midi, state: 'waiting', stacked: true }))
      );
      this.stage.showNote(`Read and voice all ${pick.notes.length} notes of this chord`, 'warm', 3.4);
      this.gameBusy = false;
    } else if (this.gameKind === 'intervals') {
      // Ear Interval Recognition: anchor note shown & heard, then target interval heard
      this.keyboard.ensureMidiRangeVisible(60, 76);
      const intervals =
        this.gameDifficulty === 'easy'
          ? [2, 3, 4, 5, 7]             // M2, m3, M3, P4, P5
          : this.gameDifficulty === 'medium'
          ? [2, 3, 4, 5, 7, 9, 10, 11, 12] // + M6, m7, M7, P8
          : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // All chromatic intervals

      const anchor = 60 + [0, 2, 4, 5, 7][Math.floor(Math.random() * 5)];
      const iv = intervals[Math.floor(Math.random() * intervals.length)];
      const target = anchor + iv;

      this.gameAnchorMidi = anchor;
      this.gameTargetSeq = [target];
      this.stage.setPromptNotes([{ midi: anchor, state: 'anchor' }]);
      this.replayGameEcho();
    } else {
      // Melodic Echo with live Grand Staff transcription
      this.keyboard.ensureMidiRangeVisible(60, 76);
      const pool =
        this.gameDifficulty === 'easy'
          ? [60, 62, 64, 65, 67]
          : this.gameDifficulty === 'medium'
          ? [60, 62, 64, 65, 67, 69, 71, 72]
          : [60, 62, 63, 65, 67, 69, 70, 72, 74]; // C Dorian jazzy vocabulary

      const baseLen = this.gameDifficulty === 'easy' ? 2 : this.gameDifficulty === 'medium' ? 3 : 4;
      const len = Math.min(5, baseLen + Math.floor(this.gameStreak / 4));
      const seq = [];
      let prev = pool[Math.floor(Math.random() * pool.length)];
      seq.push(prev);
      for (let i = 1; i < len; i++) {
        const nearby = pool.filter((m) => Math.abs(m - prev) <= 5);
        const candidates = nearby.length > 0 ? nearby : pool;
        prev = candidates[Math.floor(Math.random() * candidates.length)];
        seq.push(prev);
      }
      this.gameTargetSeq = seq;
      this.stage.setPromptNotes([]);
      this.stage.setTranscribedNotes([]);
      this.replayGameEcho();
    }

    this._emit();
  }

  replayGameEcho() {
    if (this.mode !== 'game') return;

    if (this.gameKind === 'sight') {
      const target = this.gameTargetSeq[0];
      if (target != null) {
        this.audio.noteOn(target, 0.72);
        const t = setTimeout(() => this.audio.noteOff(target), 600);
        this._gameTimers.push(t);
      }
      return;
    }

    if (this.gameKind === 'chords') {
      this._clearGameTimers();
      this.gameChordTargets.forEach((m, i) => {
        const t1 = setTimeout(() => this.audio.noteOn(m, 0.70), i * 85);
        const t2 = setTimeout(() => this.audio.noteOff(m), 950 + i * 40);
        this._gameTimers.push(t1, t2);
      });
      return;
    }

    if (this.gameKind === 'intervals') {
      this._clearGameTimers();
      this.gameBusy = true;
      const a = this.gameAnchorMidi;
      const b = this.gameTargetSeq[0];
      const anchorInfo = midiToNoteInfo(a);
      this.stage.showNote(`Anchor: ${anchorInfo.fullName} — listen for the second pitch`, 'warm', 3.0);

      const t1 = setTimeout(() => {
        this.audio.noteOn(a, 0.75);
        this.keyboard.setExternalActive(a, true);
      }, 180);
      const t2 = setTimeout(() => {
        this.audio.noteOff(a);
        this.keyboard.setExternalActive(a, false);
      }, 620);
      const t3 = setTimeout(() => {
        this.audio.noteOn(b, 0.78);
      }, 720);
      const t4 = setTimeout(() => {
        this.audio.noteOff(b);
        this.gameBusy = false;
        this.stage.showNote(`Play the interval above ${anchorInfo.fullName}`, 'warm', 3.0);
        this._emit();
      }, 1300);
      this._gameTimers.push(t1, t2, t3, t4);
      this._emit();
      return;
    }

    // Melodic Echo
    this._clearGameTimers();
    this.gameBusy = true;
    this.gameInputIdx = 0;
    this.stage.setTranscribedNotes([]);
    this.stage.showNote(`Listen to the ${this.gameTargetSeq.length}-note phrase…`, 'warm', 2.8);
    this._emit();

    const stepMs = 460;
    this.gameTargetSeq.forEach((midi, idx) => {
      const tOn = setTimeout(() => {
        this.audio.noteOn(midi, 0.75);
        if (this.gameDifficulty === 'easy' && idx === 0) {
          this.keyboard.setExternalActive(midi, true);
        }
      }, 240 + idx * stepMs);

      const tOff = setTimeout(() => {
        this.audio.noteOff(midi);
        this.keyboard.setExternalActive(midi, false);
      }, 240 + idx * stepMs + 340);

      this._gameTimers.push(tOn, tOff);
    });

    const readyTimer = setTimeout(() => {
      this.gameBusy = false;
      this.stage.showNote('Echo the phrase back — each note engraves onto the staff', 'warm', 3.2);
      this._emit();
    }, 300 + this.gameTargetSeq.length * stepMs);
    this._gameTimers.push(readyTimer);
  }

  showGameHint() {
    if (this.mode !== 'game') return;

    if (this.gameKind === 'chords') {
      const remaining = this.gameChordTargets.filter((m) => !this.gameChordHit.has(m));
      if (remaining.length === 0) return;
      this.keyboard.setTargets(remaining.map((midi) => ({ midi })));
      this.stage.showNote(`Chord: ${this.gameChordName}`, 'amber', 2.4);
      const t = setTimeout(() => {
        if (this.mode === 'game') this.keyboard.setTargets([]);
      }, 1800);
      this._gameTimers.push(t);
      return;
    }

    const expected = this.gameTargetSeq[this.gameInputIdx];
    if (expected == null) return;
    const info = midiToNoteInfo(expected, this.stage.preferFlats);
    this.keyboard.setTargets([{ midi: expected }]);

    if (this.gameKind === 'intervals' && this.gameAnchorMidi != null) {
      const diff = Math.abs(expected - this.gameAnchorMidi) % 12;
      const ivName = expected - this.gameAnchorMidi === 12 ? 'Octave' : INTERVAL_INFO[diff]?.name || '';
      this.stage.showNote(`Hint: ${ivName} (${info.fullName})`, 'amber', 2.4);
    } else {
      this.stage.showNote(`Hint: ${info.fullName}`, 'amber', 2.2);
    }

    const t = setTimeout(() => {
      if (this.mode === 'game') this.keyboard.setTargets([]);
    }, 1700);
    this._gameTimers.push(t);
  }

  _handleGameInput(midi) {
    // 1. Chord Sight-Reading
    if (this.gameKind === 'chords') {
      if (this.gameChordTargets.includes(midi)) {
        this.gameChordHit.add(midi);
        this.stage.setPromptNotes(
          this.gameChordTargets.map((m) => ({
            midi: m,
            state: this.gameChordHit.has(m) ? 'correct' : 'waiting',
            stacked: true,
          }))
        );

        if (this.gameChordTargets.every((m) => this.gameChordHit.has(m))) {
          this.gameBusy = true;
          this.gameSolved++;
          this.gameAttempts++;
          this.gameStreak++;
          this._recordBest();
          this.keyboard.setTargets([]);
          this.stage.showNote(`${this.gameChordName} — clean voicing`, 'sage', 2.2);
          this._emit();
          const nextT = setTimeout(() => {
            if (this.mode === 'game') this.startGameRound();
          }, 1150);
          this._gameTimers.push(nextT);
        }
      } else {
        this.gameAttempts++;
        this.gameStreak = 0;
        this.audio.playSoftNudge();
        this.stage.showNote(`${midiToNoteInfo(midi, this.stage.preferFlats).fullName} is outside this chord`, 'rose', 2.0);
        this._emit();
      }
      return;
    }

    // 2. Single-Note Sight / Ear Interval / Melodic Echo
    const expected = this.gameTargetSeq[this.gameInputIdx];
    if (expected == null) return;

    if (midi === expected) {
      this.keyboard.setTargets([]);
      this.gameInputIdx++;

      if (this.gameKind === 'sight') {
        const curPrompt = this.stage.promptNotes[0] || {};
        this.stage.setPromptNotes([{ ...curPrompt, midi: expected, state: 'correct' }]);
      } else if (this.gameKind === 'intervals') {
        this.stage.setPromptNotes([
          { midi: this.gameAnchorMidi, state: 'anchor' },
          { midi: expected, state: 'correct' },
        ]);
      } else if (this.gameKind === 'echo') {
        this.stage.setTranscribedNotes(
          this.gameTargetSeq.slice(0, this.gameInputIdx).map((m) => ({ midi: m }))
        );
      }

      if (this.gameInputIdx >= this.gameTargetSeq.length) {
        this.gameBusy = true;
        this.gameSolved++;
        this.gameAttempts++;
        this.gameStreak++;
        this._recordBest();

        let msg = `${midiToNoteInfo(expected, this.stage.preferFlats).fullName} — accurate`;
        if (this.gameKind === 'intervals' && this.gameAnchorMidi != null) {
          const diff = expected - this.gameAnchorMidi;
          const ivName = diff === 12 ? 'Perfect Octave' : INTERVAL_INFO[diff % 12]?.name || 'Interval';
          msg = `${ivName} (${midiToNoteInfo(this.gameAnchorMidi).name} → ${midiToNoteInfo(expected).name})`;
        } else if (this.gameKind === 'echo') {
          msg = 'Phrase transcribed cleanly';
        }
        this.stage.showNote(msg, 'sage', 2.2);

        this._emit();
        const nextT = setTimeout(() => {
          if (this.mode === 'game') this.startGameRound();
        }, 1050);
        this._gameTimers.push(nextT);
      } else {
        this._emit();
      }
    } else {
      this.gameAttempts++;
      this.gameStreak = 0;
      this.audio.playSoftNudge();
      const dir = midi < expected ? 'higher' : 'lower';

      if (this.gameKind === 'sight') {
        const curPrompt = this.stage.promptNotes[0] || {};
        this.stage.setPromptNotes([{ ...curPrompt, midi: expected, state: 'wrong' }]);
        const t = setTimeout(() => {
          if (this.mode === 'game') {
            this.stage.setPromptNotes([{ ...curPrompt, midi: expected, state: 'waiting' }]);
          }
        }, 420);
        this._gameTimers.push(t);
        this.stage.showNote(`Close — try a little ${dir}`, 'amber', 2.2);
      } else if (this.gameKind === 'intervals') {
        this.stage.showNote(`Target pitch is ${dir} — press Replay to hear the interval again`, 'amber', 2.4);
      } else {
        this.gameInputIdx = 0;
        this.stage.setTranscribedNotes([]);
        this.stage.showNote(`That note sits ${dir} — restart phrase or tap Replay`, 'amber', 2.5);
      }
      this._emit();
    }
  }

  _recordBest() {
    if (this.gameStreak > this.gameBest) {
      this.gameBest = this.gameStreak;
      localStorage.setItem('nocturne_sight_best', String(this.gameBest));
    }
  }

  _clearGameTimers() {
    for (const t of this._gameTimers) clearTimeout(t);
    this._gameTimers = [];
  }

  _emit() {
    this.onStateUpdate(this);
  }
}
