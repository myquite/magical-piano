// ============================================================================
// Starlight Keys — Tactile Multi-Touch, Mouse & Computer-Keyboard Piano UI
// Supports 10-finger polyphony, touch/mouse glissando, authentic piano key
// geometry, Chroma-Notes glow, scale guides, and finger-number beacons.
// ============================================================================

import { isBlackKey, midiToNoteInfo } from './musicTheory.js';

// Intuitive piano-shaped computer keyboard layout relative to startMidi
// Covers 18 semitones (1.5 octaves: C..F)
const KEY_BINDINGS = [
  { code: 'KeyA',      label: 'A', offset: 0 },  // C
  { code: 'KeyW',      label: 'W', offset: 1 },  // C#
  { code: 'KeyS',      label: 'S', offset: 2 },  // D
  { code: 'KeyE',      label: 'E', offset: 3 },  // D#
  { code: 'KeyD',      label: 'D', offset: 4 },  // E
  { code: 'KeyF',      label: 'F', offset: 5 },  // F
  { code: 'KeyT',      label: 'T', offset: 6 },  // F#
  { code: 'KeyG',      label: 'G', offset: 7 },  // G
  { code: 'KeyY',      label: 'Y', offset: 8 },  // G#
  { code: 'KeyH',      label: 'H', offset: 9 },  // A
  { code: 'KeyU',      label: 'U', offset: 10 }, // A#
  { code: 'KeyJ',      label: 'J', offset: 11 }, // B
  { code: 'KeyK',      label: 'K', offset: 12 }, // C+1
  { code: 'KeyO',      label: 'O', offset: 13 }, // C#+1
  { code: 'KeyL',      label: 'L', offset: 14 }, // D+1
  { code: 'KeyP',      label: 'P', offset: 15 }, // D#+1
  { code: 'Semicolon', label: ';', offset: 16 }, // E+1
  { code: 'Quote',     label: "'", offset: 17 }, // F+1
];

const CODE_TO_OFFSET = new Map(KEY_BINDINGS.map((b) => [b.code, b.offset]));
const OFFSET_TO_LABEL = new Map(KEY_BINDINGS.map((b) => [b.offset, b.label]));

// Authentic piano black-key fine offset adjustments (as fraction of white-key width)
// Places C# slightly left of seam, D# slightly right, F# left, G# centered, A# right
const BLACK_KEY_FINE_OFFSET = {
  1: -0.055, // C#
  3:  0.055, // D#
  6: -0.065, // F#
  8:  0.000, // G#
  10: 0.065, // A#
};

export class KeyboardUI {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onNoteOn = options.onNoteOn || (() => {});
    this.onNoteOff = options.onNoteOff || (() => {});
    this.onRangeChange = options.onRangeChange || (() => {});
    this.onSustainKey = options.onSustainKey || (() => {});
    this.onOctaveShortcut = options.onOctaveShortcut || (() => {});

    this.startMidi = options.startMidi ?? 60; // C4
    this.whiteKeyCount = options.whiteKeyCount ?? 15; // 2 octaves (C4..C6)
    this.labelMode = options.labelMode || 'notes'; // 'notes' | 'solfege' | 'keys' | 'none'
    this.rainbowMode = options.rainbowMode ?? true;
    this.preferFlats = false;

    // Pedagogical overlays
    this.scalePcs = null;     // Set<pc> or null
    this.scaleRootPc = null;  // pc 0..11 or null
    this.targetMap = new Map(); // midi -> { finger?: number, label?: string, color?: string }
    this.highlightSet = new Set(); // midi notes softly highlighted (e.g. chord preview)

    // Interaction state
    this.keyElements = new Map(); // midi -> HTMLElement
    this.pointerNotes = new Map(); // pointerId -> midi
    this.heldSources = new Map(); // midi -> Set<sourceId>
    this.activeComputerKeys = new Map(); // code -> midi
    this.visibleMidis = [];

    this._bindGlobalEvents();
    this.render();
  }

  getEndMidi() {
    return this.visibleMidis.length > 0
      ? this.visibleMidis[this.visibleMidis.length - 1]
      : this.startMidi + 24;
  }

  setRange(startMidi, whiteKeyCount = this.whiteKeyCount) {
    // Snap startMidi to a white key (C or F feels best; snap to nearest C or white key)
    let clampedStart = Math.max(36, Math.min(84, startMidi));
    if (isBlackKey(clampedStart)) clampedStart -= 1;

    // Ensure top doesn't exceed C7 (96)
    this.startMidi = clampedStart;
    this.whiteKeyCount = Math.max(8, Math.min(22, whiteKeyCount));

    // Release any held computer/pointer notes cleanly before re-rendering
    this.releaseAllUserNotes();
    this.render();
    this.onRangeChange(this.startMidi, this.getEndMidi(), this.whiteKeyCount);
  }

  shiftOctave(delta) {
    const next = Math.max(36, Math.min(84 - (this.whiteKeyCount >= 15 ? 12 : 0), this.startMidi + delta * 12));
    if (next !== this.startMidi) {
      this.setRange(next, this.whiteKeyCount);
    }
  }

  ensureMidiRangeVisible(minMidi, maxMidi) {
    if (minMidi == null || maxMidi == null) return;
    const currentEnd = this.getEndMidi();
    if (minMidi >= this.startMidi && maxMidi <= currentEnd) return;

    // Pick lowest C <= minMidi so the song fits naturally
    let targetStart = Math.floor(minMidi / 12) * 12;
    targetStart = Math.max(36, Math.min(72, targetStart));
    // If maxMidi still overflows and we have a small span, center around song's lowest note
    const spanSemitones = Math.round((this.whiteKeyCount / 7) * 12);
    if (maxMidi > targetStart + spanSemitones) {
      targetStart = Math.max(36, minMidi - 2);
      if (isBlackKey(targetStart)) targetStart -= 1;
    }
    this.setRange(targetStart, this.whiteKeyCount);
  }

  setLabelMode(mode) {
    this.labelMode = mode;
    this._updateKeyDecorations();
  }

  setRainbowMode(enabled) {
    this.rainbowMode = Boolean(enabled);
    this.container.classList.toggle('rainbow-off', !this.rainbowMode);
  }

  setPreferFlats(preferFlats) {
    if (this.preferFlats !== preferFlats) {
      this.preferFlats = preferFlats;
      this._updateKeyDecorations();
    }
  }

  setScaleGuide(scalePcs, rootPc) {
    this.scalePcs = scalePcs || null;
    this.scaleRootPc = rootPc ?? null;
    this._updateKeyDecorations();
  }

  setTargets(targetEntries) {
    // targetEntries: Array<{ midi, finger?, color? }>
    this.targetMap.clear();
    if (targetEntries) {
      for (const t of targetEntries) {
        this.targetMap.set(t.midi, t);
      }
    }
    this._updateKeyDecorations();
  }

  setChordHighlight(midiList) {
    this.highlightSet = new Set(midiList || []);
    this._updateKeyDecorations();
  }

  /**
   * Externally animate a key (e.g., Demo playback, Echo Ear-Training, Recorder replay)
   */
  setExternalActive(midi, active) {
    const el = this.keyElements.get(midi);
    if (!el) return;
    el.classList.toggle('demo-active', Boolean(active));
  }

  getActiveNotes() {
    return [...this.heldSources.keys()].sort((a, b) => a - b);
  }

  /**
   * Returns exact key horizontal geometry relative to a reference element (e.g., Stage Canvas)
   * so falling starlight notes and firefly emitters line up pixel-for-pixel!
   */
  getKeyGeometry(midi, referenceRect) {
    const el = this.keyElements.get(midi);
    if (!el || !referenceRect) return null;
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left - referenceRect.left,
      centerX: rect.left - referenceRect.left + rect.width / 2,
      width: rect.width,
      isBlack: isBlackKey(midi),
    };
  }

  render() {
    this.container.innerHTML = '';
    this.keyElements.clear();
    this.visibleMidis = [];
    this.container.classList.toggle('rainbow-off', !this.rainbowMode);

    const whiteLayer = document.createElement('div');
    whiteLayer.className = 'keys-white-layer';

    const blackLayer = document.createElement('div');
    blackLayer.className = 'keys-black-layer';

    const whites = [];
    const blacks = [];

    let midi = this.startMidi;
    while (whites.length < this.whiteKeyCount && midi <= 108) {
      if (!isBlackKey(midi)) {
        whites.push({ midi, whiteIdx: whites.length });
        this.visibleMidis.push(midi);
      } else if (whites.length > 0) {
        blacks.push({ midi, afterWhiteIdx: whites.length - 1 });
        this.visibleMidis.push(midi);
      }
      midi++;
    }

    const totalWhites = whites.length;
    const whiteWidthPct = 100 / totalWhites;
    const blackWidthPct = whiteWidthPct * 0.62;

    // Render White Keys
    for (const w of whites) {
      const info = midiToNoteInfo(w.midi, this.preferFlats);
      const keyEl = document.createElement('button');
      keyEl.type = 'button';
      keyEl.className = 'piano-key white-key';
      keyEl.dataset.midi = String(w.midi);
      keyEl.setAttribute('aria-label', info.fullName);
      keyEl.style.setProperty('--note-color', info.color.hex);
      keyEl.style.setProperty('--note-glow', info.color.glow);

      keyEl.innerHTML = `
        <span class="key-scale-dot" aria-hidden="true"></span>
        <span class="key-finger-badge" aria-hidden="true"></span>
        <span class="key-label"></span>
        <span class="key-chroma-bar" aria-hidden="true"></span>
      `;

      whiteLayer.appendChild(keyEl);
      this.keyElements.set(w.midi, keyEl);
    }

    // Render Black Keys positioned accurately over white key seams
    for (const b of blacks) {
      const info = midiToNoteInfo(b.midi, this.preferFlats);
      const fineOffset = BLACK_KEY_FINE_OFFSET[info.pc] || 0;
      const centerPct = (b.afterWhiteIdx + 1 + fineOffset) * whiteWidthPct;
      const leftPct = centerPct - blackWidthPct / 2;

      const keyEl = document.createElement('button');
      keyEl.type = 'button';
      keyEl.className = 'piano-key black-key';
      keyEl.dataset.midi = String(b.midi);
      keyEl.setAttribute('aria-label', info.fullName);
      keyEl.style.left = `${leftPct}%`;
      keyEl.style.width = `${blackWidthPct}%`;
      keyEl.style.setProperty('--note-color', info.color.hex);
      keyEl.style.setProperty('--note-glow', info.color.glow);

      keyEl.innerHTML = `
        <span class="key-scale-dot" aria-hidden="true"></span>
        <span class="key-finger-badge" aria-hidden="true"></span>
        <span class="key-label"></span>
      `;

      blackLayer.appendChild(keyEl);
      this.keyElements.set(b.midi, keyEl);
    }

    this.container.appendChild(whiteLayer);
    this.container.appendChild(blackLayer);

    this._updateKeyDecorations();
  }

  _updateKeyDecorations() {
    for (const [midi, el] of this.keyElements.entries()) {
      const info = midiToNoteInfo(midi, this.preferFlats);
      const labelEl = el.querySelector('.key-label');
      const dotEl = el.querySelector('.key-scale-dot');
      const fingerEl = el.querySelector('.key-finger-badge');

      // Label text
      let text = '';
      if (this.labelMode === 'notes') {
        text = info.isBlack ? info.name : (info.pc === 0 ? info.fullName : info.name);
      } else if (this.labelMode === 'solfege') {
        text = info.solfege;
      } else if (this.labelMode === 'keys') {
        const offset = midi - this.startMidi;
        text = OFFSET_TO_LABEL.get(offset) || '';
      }
      if (labelEl) {
        labelEl.textContent = text;
        labelEl.classList.toggle('is-c-note', this.labelMode === 'notes' && info.pc === 0);
      }

      // Scale guide dots & root star
      const inScale = this.scalePcs ? this.scalePcs.has(info.pc) : false;
      const isRoot = this.scaleRootPc !== null && info.pc === this.scaleRootPc && inScale;
      el.classList.toggle('in-scale', inScale);
      el.classList.toggle('is-scale-root', isRoot);
      el.classList.toggle('out-of-scale', Boolean(this.scalePcs && !inScale));
      if (dotEl) {
        dotEl.textContent = isRoot ? '★' : '';
      }

      // Chord highlight
      el.classList.toggle('chord-highlight', this.highlightSet.has(midi));

      // Guided target beacon + finger number
      const target = this.targetMap.get(midi);
      el.classList.toggle('is-target', Boolean(target));
      if (fingerEl) {
        if (target && target.finger) {
          fingerEl.textContent = String(target.finger);
          fingerEl.classList.add('visible');
        } else {
          fingerEl.textContent = '';
          fingerEl.classList.remove('visible');
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Pointer (Multi-Touch + Mouse + Glissando) & Computer Keyboard Handling
  // --------------------------------------------------------------------------
  _bindGlobalEvents() {
    this.container.addEventListener('pointerdown', (e) => this._handlePointerDown(e));
    window.addEventListener('pointermove', (e) => this._handlePointerMove(e));
    window.addEventListener('pointerup', (e) => this._handlePointerUp(e));
    window.addEventListener('pointercancel', (e) => this._handlePointerUp(e));

    // Prevent iOS Safari long-press context menu / accidental scroll on keybed
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
    this.container.addEventListener('touchstart', (e) => {
      if (e.target.closest('.piano-key')) {
        e.preventDefault();
      }
    }, { passive: false });

    // Computer Keyboard
    window.addEventListener('keydown', (e) => this._handleKeyDown(e));
    window.addEventListener('keyup', (e) => this._handleKeyUp(e));
    window.addEventListener('blur', () => this.releaseAllUserNotes());
  }

  _computeVelocity(keyEl, clientY) {
    const rect = keyEl.getBoundingClientRect();
    if (!rect.height) return 0.78;
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    // Pressing closer to the front edge of the key produces slightly fuller dynamics
    return 0.56 + ratio * 0.38;
  }

  _pressNote(midi, sourceId, velocity = 0.78) {
    let sources = this.heldSources.get(midi);
    const wasHeld = Boolean(sources && sources.size > 0);
    if (!sources) {
      sources = new Set();
      this.heldSources.set(midi, sources);
    }
    sources.add(sourceId);

    const el = this.keyElements.get(midi);
    if (el) el.classList.add('pressed');

    if (!wasHeld) {
      this.onNoteOn(midi, velocity);
    }
  }

  _releaseNote(midi, sourceId) {
    const sources = this.heldSources.get(midi);
    if (!sources) return;
    sources.delete(sourceId);

    if (sources.size === 0) {
      this.heldSources.delete(midi);
      const el = this.keyElements.get(midi);
      if (el) el.classList.remove('pressed');
      this.onNoteOff(midi);
    }
  }

  releaseAllUserNotes() {
    for (const [midi] of this.heldSources.entries()) {
      const el = this.keyElements.get(midi);
      if (el) el.classList.remove('pressed');
      this.onNoteOff(midi);
    }
    this.heldSources.clear();
    this.pointerNotes.clear();
    this.activeComputerKeys.clear();
  }

  _handlePointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const keyEl = e.target.closest('.piano-key');
    if (!keyEl) return;

    e.preventDefault();
    const midi = Number(keyEl.dataset.midi);
    const velocity = this._computeVelocity(keyEl, e.clientY);
    this.pointerNotes.set(e.pointerId, midi);
    this._pressNote(midi, `ptr:${e.pointerId}`, velocity);
  }

  _handlePointerMove(e) {
    if (!this.pointerNotes.has(e.pointerId)) return;
    // For mouse, verify button is still held
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      this._handlePointerUp(e);
      return;
    }

    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const keyEl = hit ? hit.closest('.piano-key') : null;
    const prevMidi = this.pointerNotes.get(e.pointerId);
    const nextMidi = keyEl && this.container.contains(keyEl) ? Number(keyEl.dataset.midi) : null;

    if (nextMidi !== prevMidi) {
      if (prevMidi != null) {
        this._releaseNote(prevMidi, `ptr:${e.pointerId}`);
      }
      if (nextMidi != null) {
        this.pointerNotes.set(e.pointerId, nextMidi);
        const velocity = this._computeVelocity(keyEl, e.clientY);
        this._pressNote(nextMidi, `ptr:${e.pointerId}`, velocity);
      } else {
        this.pointerNotes.set(e.pointerId, null);
      }
    }
  }

  _handlePointerUp(e) {
    if (!this.pointerNotes.has(e.pointerId)) return;
    const prevMidi = this.pointerNotes.get(e.pointerId);
    this.pointerNotes.delete(e.pointerId);
    if (prevMidi != null) {
      this._releaseNote(prevMidi, `ptr:${e.pointerId}`);
    }
  }

  _handleKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.onSustainKey(true);
      return;
    }

    if (e.code === 'KeyZ' && !e.repeat) {
      e.preventDefault();
      this.onOctaveShortcut(-1);
      return;
    }

    if (e.code === 'KeyX' && !e.repeat) {
      e.preventDefault();
      this.onOctaveShortcut(1);
      return;
    }

    if (e.repeat) return;

    const offset = CODE_TO_OFFSET.get(e.code);
    if (offset === undefined) return;

    const midi = this.startMidi + offset;
    if (!this.keyElements.has(midi)) return;

    e.preventDefault();
    this.activeComputerKeys.set(e.code, midi);
    this._pressNote(midi, `kbd:${e.code}`, 0.8);
  }

  _handleKeyUp(e) {
    if (e.code === 'Space') {
      this.onSustainKey(false);
      return;
    }
    const midi = this.activeComputerKeys.get(e.code);
    if (midi !== undefined) {
      this.activeComputerKeys.delete(e.code);
      this._releaseNote(midi, `kbd:${e.code}`);
    }
  }
}
