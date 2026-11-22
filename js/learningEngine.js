// ============================================================================
// Starlight Keys — Interactive Learning, Song Studio, Theory & Ear-Training
// ============================================================================

import {
  SCALES,
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

    // ---- Song Studio State ----
    this.song = SONGS[0];
    this.songStyle = 'wait'; // 'wait' | 'play' | 'demo'
    this.speedMultiplier = 1.0;
    this.songPlaying = false;
    this.currentBeat = -1.2; // Gentle count-in lead
    this.waitIndex = 0;
    this.hitEvents = new Set();
    this.chordBuffer = new Set(); // Tracks notes hit toward current multi-note chord event
    this.songStats = { hits: 0, misses: 0, streak: 0, bestStreak: 0, finished: false };
    this._songRaf = null;
    this._lastSongTs = 0;
    this._demoTriggered = new Set();
    this._demoReleaseTimers = [];

    // ---- Theory Explorer State ----
    this.theoryRootPc = 0; // C
    this.theoryScaleId = 'major';
    this.activeChordIdx = null;
    this._theoryTimers = [];

    // ---- Ear & Sight Game State ----
    this.gameKind = 'sight'; // 'sight' | 'echo'
    this.gameDifficulty = 'easy'; // 'easy' | 'medium' | 'pro'
    this.gameStreak = 0;
    this.gameBest = Number(localStorage.getItem('starlight_game_best') || 0);
    this.gameTargetSeq = [];
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

    // Clear previous overlays
    this.keyboard.setScaleGuide(null, null);
    this.keyboard.setTargets([]);
    this.keyboard.setChordHighlight([]);
    this.keyboard.setDualRowSuspended(newMode === 'songs');
    this.stage.setFallingState(null);
    this.stage.setPromptNotes([]);

    if (newMode === 'freeplay') {
      this.stage.owlSay('Play anything your heart imagines! ♪', 'happy', 2.8);
    } else if (newMode === 'songs') {
      this.selectSong(this.song.id, false);
      this.stage.owlSay('Pick a melody and press Play — I’ll wait for you!', 'happy', 3.4);
    } else if (newMode === 'theory') {
      this.applyTheoryView();
      this.stage.owlSay('Glow-dots mark every note in the scale. Tap a chord!', 'happy', 3.4);
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
  // User Note Events (routed from app.js)
  // --------------------------------------------------------------------------
  handleUserNoteOn(midi) {
    // 1. Recorder capture (in freeplay or theory)
    if (this.isRecording) {
      this.recordedEvents.push({
        type: 'on',
        midi,
        timeMs: performance.now() - this._recordStartMs,
      });
    }

    // 2. Song Studio checking
    if (this.mode === 'songs' && this.songPlaying && this.songStyle !== 'demo') {
      this._handleSongNoteHit(midi);
    }

    // 3. Theory Chord Practice feedback
    if (this.mode === 'theory' && this.activeChordIdx !== null) {
      this._checkTheoryChordPlayed();
    }

    // 4. Ear & Sight Game checking
    if (this.mode === 'game' && !this.gameBusy && this.gameTargetSeq.length > 0) {
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
  // Freeplay Melody Recorder
  // --------------------------------------------------------------------------
  toggleRecording() {
    if (this.isRecording) {
      this.isRecording = false;
      this.stage.owlSay(
        this.recordedEvents.length > 0 ? 'Saved your melody! Tap Play to hear it ♪' : 'Recording stopped',
        'happy',
        2.8
      );
    } else {
      this.stopReplay();
      this.recordedEvents = [];
      this._recordStartMs = performance.now();
      this.isRecording = true;
      this.stage.owlSay('Recording... play your magical tune!', 'singing', 3.0);
    }
    this._emit();
  }

  toggleReplay() {
    if (this.isReplaying) {
      this.stopReplay();
      return;
    }
    if (this.recordedEvents.length === 0) {
      this.stage.owlSay('Record a little melody first!', 'curious', 2.4);
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
          this.audio.noteOn(ev.midi, 0.78);
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
  // Guided Song Studio (Wait Mode, Play-Along Tempo, Demo Auto-Play)
  // --------------------------------------------------------------------------
  selectSong(songId, autoStart = false) {
    this.stopSong(false);
    this.song = getSongById(songId);
    this.keyboard.ensureMidiRangeVisible(this.song.minMidi, this.song.maxMidi);
    this._resetSongProgress();

    // Preview first target note immediately so learner sees where to place their hand!
    this._updateSongTargets();
    this.stage.setFallingState({
      song: this.song,
      currentBeat: -0.6,
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

  setSpeedMultiplier(mult) {
    this.speedMultiplier = Math.max(0.5, Math.min(1.25, mult));
    this._emit();
  }

  _resetSongProgress() {
    this.currentBeat = -1.0;
    this.waitIndex = 0;
    this.hitEvents = new Set();
    this.chordBuffer = new Set();
    this._demoTriggered = new Set();
    this.songStats = { hits: 0, misses: 0, streak: 0, bestStreak: 0, finished: false };
  }

  startSong(style = this.songStyle) {
    this.stopSong(false);
    this.songStyle = style;
    this.keyboard.ensureMidiRangeVisible(this.song.minMidi, this.song.maxMidi);
    this._resetSongProgress();
    this.songPlaying = true;
    this._lastSongTs = performance.now();

    if (style === 'demo') {
      this.stage.owlSay(`Listening to ${this.song.title} ♪`, 'singing', 3.0);
    } else if (style === 'wait') {
      this.stage.owlSay('Play the glowing starlight keys — take your time!', 'happy', 3.0);
    } else {
      this.stage.owlSay('Follow the falling starlight in rhythm!', 'happy', 3.0);
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
        currentBeat: -0.6,
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
        // Glide smoothly up to the target note's beat, then pause patiently until played!
        if (this.currentBeat < targetEv.beat) {
          this.currentBeat = Math.min(targetEv.beat, this.currentBeat + dt * beatsPerSec);
        }
      } else if (this.songStyle === 'demo') {
        this.currentBeat += dt * beatsPerSec;
        // Trigger notes as currentBeat crosses them
        this.song.events.forEach((ev, idx) => {
          if (!this._demoTriggered.has(idx) && this.currentBeat >= ev.beat) {
            this._demoTriggered.add(idx);
            this.hitEvents.add(idx);
            this.waitIndex = idx + 1;
            const durMs = Math.max(140, (ev.duration / beatsPerSec) * 1000 * 0.88);

            ev.notes.forEach((midi) => {
              this.audio.noteOn(midi, 0.76);
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
          this.stage.owlSay('Now try it yourself in Wait Mode! ✨', 'happy', 3.4);
          return;
        }
      } else if (this.songStyle === 'play') {
        this.currentBeat += dt * beatsPerSec;

        // Advance past missed notes after a generous timing window (+0.55 beat)
        while (this.waitIndex < this.song.events.length) {
          const ev = this.song.events[this.waitIndex];
          if (this.hitEvents.has(this.waitIndex)) {
            this.waitIndex++;
            continue;
          }
          if (this.currentBeat > ev.beat + 0.58) {
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

    // In play-along mode, also check if user hit slightly early on the current or next note
    if (this.songStyle === 'play') {
      const dist = Math.abs(this.currentBeat - ev.beat);
      if (dist > 0.72) {
        // Still waiting for note to arrive
        return;
      }
    }

    if (ev.notes.includes(midi)) {
      this.chordBuffer.add(midi);

      // Check if all notes in this event (1 for melody, 3+ for chords) are hit!
      const allHit = ev.notes.every((n) => this.chordBuffer.has(n));
      if (allHit) {
        this.hitEvents.add(this.waitIndex);
        this.chordBuffer.clear();
        this.songStats.hits++;
        this.songStats.streak++;
        if (this.songStats.streak > this.songStats.bestStreak) {
          this.songStats.bestStreak = this.songStats.streak;
        }

        // Cheer on streak milestones
        if (this.songStats.streak > 0 && this.songStats.streak % 8 === 0) {
          this.stage.owlSay(`✨ ${this.songStats.streak} in a row! Wonderful!`, 'celebrate', 2.4);
        }

        this.waitIndex++;
        if (this.waitIndex >= this.song.events.length) {
          this._finishSong();
          return;
        }

        // In wait mode, jump beat forward cleanly if user played slightly ahead of glide
        const prevBeat = ev.beat;
        if (this.songStyle === 'wait' && this.currentBeat < prevBeat) {
          this.currentBeat = prevBeat;
        }
        this._updateSongTargets();
        this._emit();
      }
    } else if (this.songStyle === 'wait') {
      // Gentle nudge without harshness
      this.songStats.misses++;
      this.songStats.streak = 0;
      const needed = ev.notes.map((n) => midiToNoteInfo(n).name).join(' + ');
      this.stage.owlSay(`Try ${needed} — look for the glowing star key!`, 'curious', 2.2);
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

    // Ensure current note is visible; when shifting on a narrow phone, look ahead 2 notes
    // so the whole mini-phrase frames cleanly without bouncing back and forth!
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
        if (candMax - candMin <= 12) {
          phraseMin = candMin;
          phraseMax = candMax;
        }
      }
      this.keyboard.ensureMidiRangeVisible(phraseMin, phraseMax);
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
    const stars = accuracy >= 92 ? '★★★' : accuracy >= 75 ? '★★☆' : '★☆☆';

    this.audio.playSparkleChime([72, 76, 79, 84]);
    this.stage.celebrateBurst(`${stars} ${this.song.title} Complete! (${accuracy}%)`);
    this._emit();
  }

  // --------------------------------------------------------------------------
  // Scales & Chords Explorer
  // --------------------------------------------------------------------------
  setTheoryKey(rootPc, scaleId = this.theoryScaleId) {
    this.theoryRootPc = ((rootPc % 12) + 12) % 12;
    this.theoryScaleId = scaleId;
    this.activeChordIdx = null;
    this.keyboard.setChordHighlight([]);
    this.applyTheoryView();
    this._emit();
  }

  applyTheoryView() {
    const preferFlats = rootPrefersFlats(this.theoryRootPc);
    this.keyboard.setPreferFlats(preferFlats);
    this.stage.setPreferFlats(preferFlats);

    const pcs = getScalePitchClasses(this.theoryRootPc, this.theoryScaleId);
    this.keyboard.setScaleGuide(pcs, this.theoryRootPc);
  }

  getTheoryChords() {
    const baseOctave = Math.max(3, Math.min(4, Math.floor(this.keyboard.startMidi / 12) - 1));
    return getDiatonicChords(this.theoryRootPc, this.theoryScaleId, baseOctave);
  }

  previewTheoryChord(chordIndex) {
    this._clearTheoryTimers();
    const chords = this.getTheoryChords();
    const chord = chords[chordIndex];
    if (!chord) return;

    this.activeChordIdx = chordIndex;
    this.keyboard.ensureMidiRangeVisible(Math.min(...chord.notes), Math.max(...chord.notes));
    this.keyboard.setChordHighlight(chord.notes);
    this.stage.owlSay(`Try playing ${chord.symbol} (${chord.roman}) together!`, 'singing', 3.4);

    // Gentle arpeggiated strum so user hears every note clearly
    chord.notes.forEach((midi, idx) => {
      const tOn = setTimeout(() => {
        this.audio.noteOn(midi, 0.72);
        this.keyboard.setExternalActive(midi, true);
        this.stage.triggerNoteVisual(midi, true);
      }, idx * 75);
      const tOff = setTimeout(() => {
        this.audio.noteOff(midi);
        this.keyboard.setExternalActive(midi, false);
        this.stage.releaseNoteVisual(midi);
      }, 950 + idx * 50);
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
    this.stage.owlSay(`Listening to the ${scale.shortName} scale ♪`, 'singing', 3.2);

    seq.forEach((midi, i) => {
      const tOn = setTimeout(() => {
        this.audio.noteOn(midi, 0.76);
        this.keyboard.setExternalActive(midi, true);
        this.stage.triggerNoteVisual(midi, true);
      }, i * 260);
      const tOff = setTimeout(() => {
        this.audio.noteOff(midi);
        this.keyboard.setExternalActive(midi, false);
        this.stage.releaseNoteVisual(midi);
      }, i * 260 + 220);
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
      this.stage.owlSay(`✨ Lovely ${chord.symbol} chord!`, 'celebrate', 2.4);
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
  // Ear Training & Sight-Reading Game ("Catch the Firefly")
  // --------------------------------------------------------------------------
  setGameKind(kind) {
    this.gameKind = kind;
    this.gameStreak = 0;
    this.startGameRound();
  }

  setGameDifficulty(diff) {
    this.gameDifficulty = diff;
    this.gameStreak = 0;
    this.startGameRound();
  }

  _getGameNotePool() {
    // Pools stay inside C4–E5 so they sit cleanly on the Treble Staff & visible keys
    if (this.gameDifficulty === 'easy') {
      return [60, 62, 64, 65, 67]; // C4 D4 E4 F4 G4 (classic 5-finger position)
    }
    if (this.gameDifficulty === 'medium') {
      return [60, 62, 64, 65, 67, 69, 71, 72]; // Full C4..C5 Major scale
    }
    return [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 74, 76]; // Chromatic + upper notes
  }

  startGameRound() {
    this._clearGameTimers();
    this.keyboard.setTargets([]);
    this.keyboard.ensureMidiRangeVisible(60, 76);

    const pool = this._getGameNotePool();
    this.gameInputIdx = 0;

    if (this.gameKind === 'sight') {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.gameTargetSeq = [pick];
      this.stage.setShowStaff(true);
      this.stage.setPromptNotes([{ midi: pick, state: 'waiting' }]);
      this.stage.owlSay('Read the glowing note on the staff and play it!', 'curious', 3.4);
      this.gameBusy = false;
    } else {
      // Melodic Echo: starts at 2 notes on Easy, scales gently up to 4-5 notes with streak
      const baseLen = this.gameDifficulty === 'easy' ? 2 : this.gameDifficulty === 'medium' ? 3 : 4;
      const len = Math.min(5, baseLen + Math.floor(this.gameStreak / 3));
      const seq = [];
      let prev = pool[Math.floor(Math.random() * pool.length)];
      seq.push(prev);
      for (let i = 1; i < len; i++) {
        // Choose musical stepwise/small-leap intervals so phrases sound melodic!
        const nearby = pool.filter((m) => Math.abs(m - prev) <= 5);
        const candidates = nearby.length > 0 ? nearby : pool;
        prev = candidates[Math.floor(Math.random() * candidates.length)];
        seq.push(prev);
      }
      this.gameTargetSeq = seq;
      this.stage.setPromptNotes([]);
      this.replayGameEcho();
    }

    this._emit();
  }

  replayGameEcho() {
    if (this.mode !== 'game') return;
    if (this.gameKind === 'sight') {
      // Play the target note gently as an audio clue
      const target = this.gameTargetSeq[0];
      if (target != null) {
        this.audio.noteOn(target, 0.72);
        const t = setTimeout(() => this.audio.noteOff(target), 550);
        this._gameTimers.push(t);
      }
      return;
    }

    this._clearGameTimers();
    this.gameBusy = true;
    this.gameInputIdx = 0;
    this.stage.owlSay(`Listen closely... (${this.gameTargetSeq.length} notes) 🎵`, 'singing', 2.8);
    this._emit();

    const stepMs = 480;
    this.gameTargetSeq.forEach((midi, idx) => {
      const tOn = setTimeout(() => {
        this.audio.noteOn(midi, 0.76);
        // Only reveal visual fireflies in Easy mode on first note to anchor the pitch!
        if (this.gameDifficulty === 'easy' && idx === 0) {
          this.keyboard.setExternalActive(midi, true);
        }
        this.stage.owl.hopVel = -100;
        this.stage.owl.wingFlap = 0.55;
      }, 280 + idx * stepMs);

      const tOff = setTimeout(() => {
        this.audio.noteOff(midi);
        this.keyboard.setExternalActive(midi, false);
      }, 280 + idx * stepMs + 340);

      this._gameTimers.push(tOn, tOff);
    });

    const readyTimer = setTimeout(() => {
      this.gameBusy = false;
      this.stage.owlSay('Your turn! Echo the melody back ♪', 'curious', 3.0);
      this._emit();
    }, 340 + this.gameTargetSeq.length * stepMs);
    this._gameTimers.push(readyTimer);
  }

  showGameHint() {
    if (this.mode !== 'game' || this.gameTargetSeq.length === 0) return;
    const expected = this.gameTargetSeq[this.gameInputIdx];
    if (expected == null) return;
    const info = midiToNoteInfo(expected);

    this.keyboard.setTargets([{ midi: expected }]);
    this.stage.owlSay(`Psst... try ${info.fullName}! ✨`, 'happy', 2.2);

    const t = setTimeout(() => {
      if (this.mode === 'game') this.keyboard.setTargets([]);
    }, 1700);
    this._gameTimers.push(t);
  }

  _handleGameInput(midi) {
    const expected = this.gameTargetSeq[this.gameInputIdx];
    if (midi === expected) {
      this.keyboard.setTargets([]);
      this.gameInputIdx++;

      if (this.gameKind === 'sight') {
        this.stage.setPromptNotes([{ midi: expected, state: 'correct' }]);
      }

      if (this.gameInputIdx >= this.gameTargetSeq.length) {
        // Round Won!
        this.gameBusy = true;
        this.gameStreak++;
        if (this.gameStreak > this.gameBest) {
          this.gameBest = this.gameStreak;
          localStorage.setItem('starlight_game_best', String(this.gameBest));
        }

        const cheers = ['✨ Spot on!', '🌟 Musical magic!', '🎵 You caught the firefly!', '🦉 Bravo!'];
        const msg = cheers[this.gameStreak % cheers.length];
        this.stage.owlSay(`${msg} Streak: ${this.gameStreak}`, 'celebrate', 2.0);
        if (this.gameStreak % 5 === 0) {
          this.stage.celebrateBurst(`🌟 ${this.gameStreak} Streak!`);
        }

        this._emit();
        const nextT = setTimeout(() => {
          if (this.mode === 'game') this.startGameRound();
        }, 950);
        this._gameTimers.push(nextT);
      } else {
        this._emit();
      }
    } else {
      // Gentle try-again feedback
      this.gameStreak = 0;
      this.audio.playSoftNudge();
      if (this.gameKind === 'sight') {
        this.stage.setPromptNotes([{ midi: expected, state: 'wrong' }]);
        const t = setTimeout(() => {
          if (this.mode === 'game') {
            this.stage.setPromptNotes([{ midi: expected, state: 'waiting' }]);
          }
        }, 420);
        this._gameTimers.push(t);
        const dir = midi < expected ? 'higher' : 'lower';
        this.stage.owlSay(`Close! Try a little ${dir} ♪`, 'curious', 2.2);
      } else {
        this.gameInputIdx = 0;
        const dir = midi < expected ? 'higher' : 'lower';
        this.stage.owlSay(`Almost! That note is ${dir} — tap Replay anytime`, 'curious', 2.5);
      }
      this._emit();
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
