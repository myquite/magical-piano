// ============================================================================
// Starlight Keys — Main Application Controller
// Wires AudioEngine, KeyboardUI, StageCanvas, and LearningEngine together.
// ============================================================================

import { AudioEngine, INSTRUMENTS } from './audioEngine.js';
import { KeyboardUI } from './keyboardUI.js';
import { StageCanvas } from './stageCanvas.js';
import { LearningEngine } from './learningEngine.js';
import {
  NOTE_NAMES_SHARP,
  SCALES,
  detectHarmony,
  midiToNoteInfo,
  rootPrefersFlats,
} from './musicTheory.js';
import { SONGS } from './songs.js';

// Determine a great default keyboard span based on viewport width
function getRecommendedWhiteKeys() {
  const w = window.innerWidth;
  if (w < 480) return 8;   // 1 octave (big, comfortable iPhone portrait keys!)
  if (w < 760) return 11;  // 1.5 octaves (iPhone landscape / mini tablet)
  if (w < 1180) return 15; // 2 octaves (iPad / laptop)
  return 15;               // 2 crisp spacious octaves on desktop (expandable to 3!)
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem('starlight_prefs') || '{}');
  } catch {
    return {};
  }
}

function savePrefs(patch) {
  try {
    const next = { ...loadPrefs(), ...patch };
    localStorage.setItem('starlight_prefs', JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const prefs = loadPrefs();

  // ---- DOM Elements ----
  const stageArea = document.getElementById('stageArea');
  const stageCanvasEl = document.getElementById('stageCanvas');
  const keyboardEl = document.getElementById('pianoKeyboard');
  const audioHint = document.getElementById('audioHint');

  const modeTabs = document.querySelectorAll('.mode-tab');
  const ribbonPanels = document.querySelectorAll('.ribbon-panel');
  const instrumentSelect = document.getElementById('instrumentSelect');
  const metronomeBtn = document.getElementById('metronomeBtn');
  const metroDot = document.getElementById('metroDot');
  const metroLabel = document.getElementById('metroLabel');

  // Freeplay elements
  const harmonyDot = document.getElementById('harmonyDot');
  const harmonyTitle = document.getElementById('harmonyTitle');
  const harmonySubtitle = document.getElementById('harmonySubtitle');
  const recordBtn = document.getElementById('recordBtn');
  const replayBtn = document.getElementById('replayBtn');

  // Song Studio elements
  const songSelect = document.getElementById('songSelect');
  const songStyleBtns = document.querySelectorAll('[data-song-style]');
  const songPlayBtn = document.getElementById('songPlayBtn');
  const speedSlider = document.getElementById('speedSlider');
  const speedLabel = document.getElementById('speedLabel');
  const songStatPill = document.getElementById('songStatPill');
  const songTipBar = document.getElementById('songTipBar');

  // Theory Explorer elements
  const rootSelect = document.getElementById('rootSelect');
  const scaleSelect = document.getElementById('scaleSelect');
  const playScaleBtn = document.getElementById('playScaleBtn');
  const theoryMood = document.getElementById('theoryMood');
  const chordPadsEl = document.getElementById('chordPads');

  // Game elements
  const gameKindBtns = document.querySelectorAll('[data-game-kind]');
  const gameDiffBtns = document.querySelectorAll('[data-game-diff]');
  const gameReplayBtn = document.getElementById('gameReplayBtn');
  const gameHintBtn = document.getElementById('gameHintBtn');
  const gameNextBtn = document.getElementById('gameNextBtn');
  const gameStreakPill = document.getElementById('gameStreakPill');

  // Keybed Rail elements
  const octDownBtn = document.getElementById('octDownBtn');
  const octUpBtn = document.getElementById('octUpBtn');
  const rangeLabel = document.getElementById('rangeLabel');
  const miniRangeBar = document.getElementById('miniRangeBar');
  const miniWindow = document.getElementById('miniWindow');
  const sustainBtn = document.getElementById('sustainBtn');

  // Settings Drawer elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsBackdrop = document.getElementById('settingsBackdrop');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const labelModeBtns = document.querySelectorAll('[data-label-mode]');
  const spanBtns = document.querySelectorAll('[data-span]');
  const rainbowToggle = document.getElementById('rainbowToggle');
  const staffToggle = document.getElementById('staffToggle');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeVal = document.getElementById('volumeVal');
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmVal = document.getElementById('bpmVal');

  // ---- Core Engines ----
  const audio = new AudioEngine();
  let sustainLatched = false;

  if (prefs.instrument) audio.setInstrument(prefs.instrument);
  if (typeof prefs.volume === 'number') audio.setVolume(prefs.volume);
  if (typeof prefs.bpm === 'number') audio.setBpm(prefs.bpm);

  const initialSpan = prefs.whiteKeyCount || getRecommendedWhiteKeys();
  const initialLabelMode = prefs.labelMode || 'notes';
  const initialRainbow = prefs.rainbowMode !== undefined ? prefs.rainbowMode : true;
  const initialStaff = prefs.showStaff !== undefined ? prefs.showStaff : true;

  let stage = null;
  let learning = null;

  const updateHarmonyBadge = () => {
    const active = keyboard.getActiveNotes();
    const preferFlats = learning && learning.mode === 'theory'
      ? rootPrefersFlats(learning.theoryRootPc)
      : false;
    const result = detectHarmony(active, preferFlats);

    if (!result) {
      harmonyTitle.textContent = 'Tap keys or type A–L to play';
      harmonySubtitle.textContent = 'Play 2+ notes together to discover intervals & chords';
      harmonyDot.style.background = '#ffe066';
      harmonyDot.style.boxShadow = '0 0 12px #ffe066';
      return;
    }

    harmonyTitle.textContent = result.title;
    harmonySubtitle.textContent = result.subtitle;
    harmonyDot.style.background = result.color;
    harmonyDot.style.boxShadow = `0 0 14px ${result.color}`;
  };

  const updateRangeDisplay = (startMidi, endMidi) => {
    const startInfo = midiToNoteInfo(startMidi);
    const endInfo = midiToNoteInfo(endMidi);
    rangeLabel.textContent = `${startInfo.fullName} – ${endInfo.fullName}`;

    // Map C2 (36) .. C7 (96) onto mini-range-bar
    const fullMin = 36;
    const fullSpan = 60;
    const leftPct = Math.max(0, Math.min(100, ((startMidi - fullMin) / fullSpan) * 100));
    const widthPct = Math.max(12, Math.min(100 - leftPct, ((endMidi - startMidi + 1) / fullSpan) * 100));
    miniWindow.style.left = `${leftPct}%`;
    miniWindow.style.width = `${widthPct}%`;
  };

  const setSustainUI = (active) => {
    audio.setSustain(active);
    if (stage) stage.setSustain(active);
    sustainBtn.classList.toggle('active', active);
    sustainBtn.setAttribute('aria-pressed', String(active));
  };

  const keyboard = new KeyboardUI(keyboardEl, {
    startMidi: 60, // C4
    whiteKeyCount: initialSpan,
    labelMode: initialLabelMode,
    rainbowMode: initialRainbow,
    onNoteOn: (midi, velocity) => {
      dismissAudioHint();
      audio.noteOn(midi, velocity);
      if (stage) stage.triggerNoteVisual(midi, false);
      updateHarmonyBadge();
      if (learning) learning.handleUserNoteOn(midi);
    },
    onNoteOff: (midi) => {
      audio.noteOff(midi);
      if (stage) stage.releaseNoteVisual(midi);
      updateHarmonyBadge();
      if (learning) learning.handleUserNoteOff(midi);
    },
    onRangeChange: (startMidi, endMidi) => {
      updateRangeDisplay(startMidi, endMidi);
      if (learning && learning.mode === 'theory') {
        renderChordPads();
      }
    },
    onSustainKey: (down) => {
      dismissAudioHint();
      if (down) {
        setSustainUI(true);
      } else {
        setSustainUI(sustainLatched);
      }
    },
    onOctaveShortcut: (delta) => {
      keyboard.shiftOctave(delta);
    },
  });

  stage = new StageCanvas(stageCanvasEl, keyboard);
  stage.setShowStaff(initialStaff);

  learning = new LearningEngine({
    audio,
    keyboard,
    stage,
    onStateUpdate: () => syncLearningUI(),
  });

  // ---- Audio Unlock Hint Dismissal ----
  let hintDismissed = false;
  function dismissAudioHint() {
    audio.ensureContext();
    if (!hintDismissed) {
      hintDismissed = true;
      audioHint.classList.add('hidden');
      if (stage && learning && learning.mode === 'freeplay' && !stage.owl.speech) {
        stage.owlSay('Starlight sound awakened! Play away ♪', 'happy', 3.0);
      }
    }
  }
  window.addEventListener('pointerdown', dismissAudioHint, { passive: true });
  window.addEventListener('keydown', dismissAudioHint, { passive: true });

  // ---- Populate Dropdowns ----
  INSTRUMENTS.forEach((inst) => {
    const opt = document.createElement('option');
    opt.value = inst.id;
    opt.textContent = `${inst.icon} ${inst.name}`;
    instrumentSelect.appendChild(opt);
  });
  instrumentSelect.value = audio.instrument;

  SONGS.forEach((song) => {
    const opt = document.createElement('option');
    opt.value = song.id;
    opt.textContent = `${song.title} • ${song.level}`;
    songSelect.appendChild(opt);
  });
  songSelect.value = learning.song.id;

  NOTE_NAMES_SHARP.forEach((name, pc) => {
    const opt = document.createElement('option');
    opt.value = String(pc);
    opt.textContent = `Key of ${name}`;
    rootSelect.appendChild(opt);
  });
  rootSelect.value = String(learning.theoryRootPc);

  Object.values(SCALES).forEach((sc) => {
    const opt = document.createElement('option');
    opt.value = sc.id;
    opt.textContent = sc.name;
    scaleSelect.appendChild(opt);
  });
  scaleSelect.value = learning.theoryScaleId;

  // ---- Render Diatonic Chord Pads ----
  function renderChordPads() {
    const chords = learning.getTheoryChords();
    chordPadsEl.innerHTML = '';
    chords.forEach((ch, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chord-pad' + (learning.activeChordIdx === idx ? ' active' : '');
      btn.style.setProperty('--pad-color', ch.color.hex);
      btn.innerHTML = `<span class="pad-roman">${ch.roman}</span><span class="pad-symbol">${ch.symbol}</span>`;
      btn.addEventListener('click', () => {
        dismissAudioHint();
        learning.previewTheoryChord(idx);
      });
      chordPadsEl.appendChild(btn);
    });
    const sc = SCALES[learning.theoryScaleId];
    theoryMood.textContent = sc ? sc.mood : '';
  }

  // ---- Sync All Dynamic Learning UI ----
  function syncLearningUI() {
    // Active Mode Tab & Panel
    modeTabs.forEach((tab) => {
      const isMatch = tab.dataset.mode === learning.mode;
      tab.classList.toggle('active', isMatch);
      tab.setAttribute('aria-selected', String(isMatch));
    });
    ribbonPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.panel === learning.mode);
    });

    // Freeplay Recorder
    recordBtn.classList.toggle('recording', learning.isRecording);
    recordBtn.innerHTML = learning.isRecording
      ? '<span class="rec-dot"></span> Stop Rec'
      : '<span class="rec-dot"></span> Record';
    replayBtn.disabled = learning.recordedEvents.length === 0 && !learning.isReplaying;
    replayBtn.textContent = learning.isReplaying ? '■ Stop' : '▶ Replay';

    // Song Studio
    songSelect.value = learning.song.id;
    songStyleBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.songStyle === learning.songStyle);
    });
    songPlayBtn.textContent = learning.songPlaying ? '■ Stop' : '▶ Start';
    speedSlider.value = String(Math.round(learning.speedMultiplier * 100));
    speedLabel.textContent = `${Math.round(learning.speedMultiplier * 100)}%`;

    const totalEv = learning.song.events.length;
    const doneEv = Math.min(totalEv, learning.hitEvents.size);
    songStatPill.textContent = learning.songStats.streak >= 3
      ? `${doneEv}/${totalEv} • 🔥 ${learning.songStats.streak}`
      : `${doneEv} / ${totalEv}`;
    songTipBar.textContent = `💡 Tip: ${learning.song.tip}`;

    // Theory
    if (learning.mode === 'theory') {
      renderChordPads();
    }

    // Ear & Sight Game
    gameKindBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.gameKind === learning.gameKind);
    });
    gameDiffBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.gameDiff === learning.gameDifficulty);
    });
    gameReplayBtn.textContent = learning.gameKind === 'sight' ? '🔊 Clue' : '🔊 Replay';
    gameStreakPill.textContent = `🔥 ${learning.gameStreak} • Best ${learning.gameBest}`;
  }

  // ---- Wire Top Bar Events ----
  modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      dismissAudioHint();
      learning.setMode(tab.dataset.mode);
    });
  });

  instrumentSelect.addEventListener('change', () => {
    dismissAudioHint();
    audio.setInstrument(instrumentSelect.value);
    savePrefs({ instrument: instrumentSelect.value });
    const inst = INSTRUMENTS.find((i) => i.id === instrumentSelect.value);
    if (inst) stage.owlSay(`${inst.icon} Switched to ${inst.name}!`, 'happy', 2.2);
  });

  // Metronome
  metroLabel.textContent = String(audio.bpm);
  bpmSlider.value = String(audio.bpm);
  bpmVal.textContent = `${audio.bpm} BPM`;

  audio.onMetronomeBeat = (beat) => {
    metroDot.classList.remove('beat-on', 'beat-accent');
    // Force reflow for crisp pulse
    void metroDot.offsetWidth;
    metroDot.classList.add(beat === 0 ? 'beat-accent' : 'beat-on');
    setTimeout(() => metroDot.classList.remove('beat-on', 'beat-accent'), 110);
  };

  metronomeBtn.addEventListener('click', () => {
    dismissAudioHint();
    const running = audio.toggleMetronome();
    metronomeBtn.classList.toggle('active', running);
    metronomeBtn.setAttribute('aria-pressed', String(running));
  });

  // ---- Wire Freeplay Events ----
  recordBtn.addEventListener('click', () => {
    dismissAudioHint();
    learning.toggleRecording();
  });

  replayBtn.addEventListener('click', () => {
    dismissAudioHint();
    learning.toggleReplay();
  });

  // ---- Wire Song Studio Events ----
  songSelect.addEventListener('change', () => {
    dismissAudioHint();
    learning.selectSong(songSelect.value, false);
  });

  songStyleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dismissAudioHint();
      learning.setSongStyle(btn.dataset.songStyle);
    });
  });

  songPlayBtn.addEventListener('click', () => {
    dismissAudioHint();
    if (learning.songPlaying) {
      learning.stopSong(true);
    } else {
      learning.startSong(learning.songStyle);
    }
  });

  speedSlider.addEventListener('input', () => {
    const val = Number(speedSlider.value);
    learning.setSpeedMultiplier(val / 100);
  });

  // ---- Wire Theory Explorer Events ----
  rootSelect.addEventListener('change', () => {
    dismissAudioHint();
    learning.setTheoryKey(Number(rootSelect.value), learning.theoryScaleId);
  });

  scaleSelect.addEventListener('change', () => {
    dismissAudioHint();
    learning.setTheoryKey(learning.theoryRootPc, scaleSelect.value);
  });

  playScaleBtn.addEventListener('click', () => {
    dismissAudioHint();
    learning.playScaleDemo();
  });

  // ---- Wire Game Events ----
  gameKindBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dismissAudioHint();
      learning.setGameKind(btn.dataset.gameKind);
    });
  });

  gameDiffBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dismissAudioHint();
      learning.setGameDifficulty(btn.dataset.gameDiff);
    });
  });

  gameReplayBtn.addEventListener('click', () => {
    dismissAudioHint();
    learning.replayGameEcho();
  });

  gameHintBtn.addEventListener('click', () => {
    dismissAudioHint();
    learning.showGameHint();
  });

  gameNextBtn.addEventListener('click', () => {
    dismissAudioHint();
    learning.startGameRound();
  });

  // ---- Wire Keybed Rail Controls ----
  octDownBtn.addEventListener('click', () => keyboard.shiftOctave(-1));
  octUpBtn.addEventListener('click', () => keyboard.shiftOctave(1));

  miniRangeBar.addEventListener('pointerdown', (e) => {
    const rect = miniRangeBar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetCenter = 36 + Math.round(ratio * 60);
    const halfSpan = Math.round(((keyboard.whiteKeyCount / 7) * 12) / 2);
    const desiredStart = Math.max(36, Math.min(72, targetCenter - halfSpan));
    keyboard.setRange(desiredStart, keyboard.whiteKeyCount);
  });

  sustainBtn.addEventListener('click', () => {
    dismissAudioHint();
    sustainLatched = !sustainLatched;
    setSustainUI(sustainLatched);
  });

  // ---- Wire Settings Drawer ----
  const syncSettingsUI = () => {
    labelModeBtns.forEach((b) => b.classList.toggle('active', b.dataset.labelMode === keyboard.labelMode));
    spanBtns.forEach((b) => b.classList.toggle('active', Number(b.dataset.span) === keyboard.whiteKeyCount));
    rainbowToggle.checked = keyboard.rainbowMode;
    staffToggle.checked = stage.showStaff;
    volumeSlider.value = String(Math.round(audio.volume * 100));
    volumeVal.textContent = `${Math.round(audio.volume * 100)}%`;
    bpmSlider.value = String(audio.bpm);
    bpmVal.textContent = `${audio.bpm} BPM`;
    metroLabel.textContent = String(audio.bpm);
  };

  const openSettings = () => {
    syncSettingsUI();
    settingsBackdrop.hidden = false;
    settingsBtn.setAttribute('aria-expanded', 'true');
  };

  const closeSettings = () => {
    settingsBackdrop.hidden = true;
    settingsBtn.setAttribute('aria-expanded', 'false');
  };

  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', (e) => {
    if (e.target === settingsBackdrop) closeSettings();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsBackdrop.hidden) closeSettings();
  });

  labelModeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.labelMode;
      keyboard.setLabelMode(mode);
      savePrefs({ labelMode: mode });
      syncSettingsUI();
    });
  });

  spanBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const span = Number(btn.dataset.span);
      keyboard.setRange(keyboard.startMidi, span);
      savePrefs({ whiteKeyCount: span });
      syncSettingsUI();
    });
  });

  rainbowToggle.addEventListener('change', () => {
    keyboard.setRainbowMode(rainbowToggle.checked);
    savePrefs({ rainbowMode: rainbowToggle.checked });
  });

  staffToggle.addEventListener('change', () => {
    stage.setShowStaff(staffToggle.checked);
    savePrefs({ showStaff: staffToggle.checked });
  });

  volumeSlider.addEventListener('input', () => {
    const vol = Number(volumeSlider.value) / 100;
    audio.setVolume(vol);
    volumeVal.textContent = `${volumeSlider.value}%`;
    savePrefs({ volume: vol });
  });

  bpmSlider.addEventListener('input', () => {
    const bpm = Number(bpmSlider.value);
    audio.setBpm(bpm);
    bpmVal.textContent = `${bpm} BPM`;
    metroLabel.textContent = String(bpm);
    savePrefs({ bpm });
  });

  // ---- Responsive Canvas Resize Observer ----
  const ro = new ResizeObserver(() => stage.resize());
  ro.observe(stageArea);
  window.addEventListener('resize', () => stage.resize());

  // ---- Initial Render Sync ----
  updateRangeDisplay(keyboard.startMidi, keyboard.getEndMidi());
  syncLearningUI();
  syncSettingsUI();
});
