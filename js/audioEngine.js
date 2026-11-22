// ============================================================================
// Starlight Keys — Expressive Web Audio Polyphonic Synthesizer & Metronome
// Zero external samples: lush procedural instruments, stereo hall reverb,
// true sustain pedal physics, and bulletproof iOS/iPadOS audio unlock.
// ============================================================================

import { midiToFreq } from './musicTheory.js';

export const INSTRUMENTS = [
  { id: 'piano',   name: 'Concert Piano',     icon: '🎹', desc: 'Warm acoustic grand with felt hammer attack' },
  { id: 'celesta', name: 'Starlight Celesta', icon: '✨', desc: 'Sparkling enchanted music-box bell piano' },
  { id: 'marimba', name: 'Storybook Marimba', icon: '🪵', desc: 'Playful, warm wooden concert mallets' },
  { id: 'harp',    name: 'Cloud Harp',        icon: '🪽', desc: 'Luminous plucked strings with dreamy shimmer' },
  { id: 'synth',   name: 'Moonbeam Synth',    icon: '🌙', desc: 'Silky twilight analog melody voice' },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.dryGain = null;
    this.noiseBuffer = null;

    this.instrument = 'piano';
    this.volume = 0.82;
    this.reverbMix = 0.28;
    this.sustain = false;
    this.isUnlocked = false;

    // Active & sustained voice maps: midi -> voice object
    this.activeVoices = new Map();
    this.sustainedVoices = new Map();

    // Metronome state
    this.metronomeRunning = false;
    this.bpm = 96;
    this.beatsPerBar = 4;
    this._metroTimer = null;
    this._nextBeatTime = 0;
    this._currentBeat = 0;
    this.onMetronomeBeat = null;

    // Automatically recover iOS Safari AudioContext after app switch / screen lock
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.ctx && this.ctx.state !== 'running') {
          this.ctx.resume().catch(() => {});
        }
      });
      window.addEventListener('pageshow', () => {
        if (this.ctx && this.ctx.state !== 'running') {
          this.ctx.resume().catch(() => {});
        }
      });
    }
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx({ latencyHint: 'interactive' });

      // Master bus with soft limiter
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 0.88;

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = this.reverbMix;

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this._createReverbImpulse(2.1, 2.8);

      this.dryGain.connect(this.compressor);
      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.compressor);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this._createNoiseBuffer(0.08);
    }

    if (this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.isUnlocked && this.ctx) {
      // Silent buffer unlock trick for iOS / iPadOS Safari
      try {
        const silent = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silent;
        src.connect(this.ctx.destination);
        src.start(0);
        this.isUnlocked = true;
      } catch {
        // Ignore if not yet inside gesture
      }
    }

    return this.ctx;
  }

  _createReverbImpulse(durationSec, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = this.ctx.createBuffer(2, length, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        // Gentle lowpass smoothing so the reverb tail is velvety, not harsh
        const white = (Math.random() * 2 - 1) * env;
        lp = lp * 0.65 + white * 0.35;
        data[i] = lp * 0.45;
      }
    }
    return impulse;
  }

  _createNoiseBuffer(durationSec) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const buf = this.ctx.createBuffer(1, length, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.25));
    }
    return buf;
  }

  setInstrument(id) {
    if (INSTRUMENTS.some((inst) => inst.id === id)) {
      this.instrument = id;
      // Adjust reverb sweetness slightly per instrument
      const mixMap = {
        piano: 0.26,
        celesta: 0.44,
        marimba: 0.22,
        harp: 0.48,
        synth: 0.38,
      };
      this.reverbMix = mixMap[id] ?? 0.28;
      if (this.reverbGain && this.ctx) {
        this.reverbGain.gain.setTargetAtTime(this.reverbMix, this.ctx.currentTime, 0.05);
      }
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  setSustain(enabled) {
    this.sustain = Boolean(enabled);
    if (!this.sustain) {
      for (const [midi, voice] of this.sustainedVoices.entries()) {
        this._releaseVoice(voice, 0.22);
        this.sustainedVoices.delete(midi);
      }
    }
  }

  noteOn(midi, velocity = 0.78) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clampedVel = Math.max(0.18, Math.min(1, velocity));

    // Gently fade any existing voice on this exact MIDI key to prevent clicking/stacking
    if (this.activeVoices.has(midi)) {
      this._releaseVoice(this.activeVoices.get(midi), 0.035);
      this.activeVoices.delete(midi);
    }
    if (this.sustainedVoices.has(midi)) {
      this._releaseVoice(this.sustainedVoices.get(midi), 0.045);
      this.sustainedVoices.delete(midi);
    }

    const freq = midiToFreq(midi);
    let voice;
    switch (this.instrument) {
      case 'celesta':
        voice = this._buildCelestaVoice(ctx, now, freq, midi, clampedVel);
        break;
      case 'marimba':
        voice = this._buildMarimbaVoice(ctx, now, freq, midi, clampedVel);
        break;
      case 'harp':
        voice = this._buildHarpVoice(ctx, now, freq, midi, clampedVel);
        break;
      case 'synth':
        voice = this._buildSynthVoice(ctx, now, freq, midi, clampedVel);
        break;
      case 'piano':
      default:
        voice = this._buildPianoVoice(ctx, now, freq, midi, clampedVel);
        break;
    }

    this.activeVoices.set(midi, voice);
  }

  noteOff(midi) {
    const voice = this.activeVoices.get(midi);
    if (!voice) return;
    this.activeVoices.delete(midi);

    if (this.sustain) {
      this.sustainedVoices.set(midi, voice);
    } else {
      this._releaseVoice(voice, voice.defaultRelease ?? 0.28);
    }
  }

  stopAll() {
    for (const voice of this.activeVoices.values()) {
      this._releaseVoice(voice, 0.08);
    }
    for (const voice of this.sustainedVoices.values()) {
      this._releaseVoice(voice, 0.08);
    }
    this.activeVoices.clear();
    this.sustainedVoices.clear();
  }

  _connectToBus(node, reverbSendLevel = 1.0) {
    node.connect(this.dryGain);
    if (reverbSendLevel > 0) {
      node.connect(this.reverbNode);
    }
  }

  _releaseVoice(voice, releaseTime = 0.25) {
    if (!voice || voice.released || !this.ctx) return;
    voice.released = true;

    const now = this.ctx.currentTime;
    const gain = voice.envGain.gain;
    try {
      gain.cancelScheduledValues(now);
      const currentVal = Math.max(0.0001, gain.value);
      gain.setValueAtTime(currentVal, now);
      gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
    } catch {
      // Fallback linear fade
      gain.setTargetAtTime(0, now, releaseTime * 0.35);
    }

    const stopAt = now + releaseTime + 0.05;
    for (const osc of voice.nodes) {
      try {
        osc.stop(stopAt);
      } catch {
        // Already stopped
      }
    }
  }

  // --------------------------------------------------------------------------
  // Instrument Builders
  // --------------------------------------------------------------------------

  _buildPianoVoice(ctx, now, freq, midi, vel) {
    // Stereo slight pan based on keyboard register (bass left, treble right!)
    const pan = Math.max(-0.55, Math.min(0.55, (midi - 60) / 36));
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const brightPeak = Math.min(11500, freq * (4.5 + vel * 5.2));
    const warmHold = Math.min(4800, freq * (1.8 + vel * 1.4));
    filter.frequency.setValueAtTime(brightPeak, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(220, warmHold), now + 0.55);
    filter.Q.value = 0.9;

    const envGain = ctx.createGain();
    // Longer natural ring for low notes, brisker decay for high notes
    const decayTime = Math.max(1.1, 4.4 - (midi - 36) * 0.055);
    const peakGain = 0.34 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peakGain, now + 0.008);
    envGain.gain.exponentialRampToValueAtTime(peakGain * 0.42, now + 0.24);
    envGain.gain.exponentialRampToValueAtTime(0.0008, now + decayTime);

    // Rich piano harmonic stack
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.0006, now); // Subtle unison string warmth
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.22;

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 2, now);
    const osc3Gain = ctx.createGain();
    osc3Gain.gain.setValueAtTime(0.28, now);
    osc3Gain.gain.exponentialRampToValueAtTime(0.04, now + 0.7);

    // Felt hammer strike transient
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = Math.min(3400, freq * 3.2);
    noiseFilter.Q.value = 1.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.09 * vel, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    osc3.connect(osc3Gain);
    osc3Gain.connect(filter);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(filter);

    filter.connect(envGain);
    if (panner) {
      envGain.connect(panner);
      this._connectToBus(panner);
    } else {
      this._connectToBus(envGain);
    }

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    noise.start(now);

    const autoStop = now + decayTime + 0.15;
    osc1.stop(autoStop);
    osc2.stop(autoStop);
    osc3.stop(autoStop);

    return {
      envGain,
      nodes: [osc1, osc2, osc3, noise],
      defaultRelease: 0.32,
      released: false,
    };
  }

  _buildCelestaVoice(ctx, now, freq, midi, vel) {
    const pan = Math.max(-0.5, Math.min(0.5, (midi - 60) / 34));
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    const envGain = ctx.createGain();
    const decayTime = Math.max(1.4, 3.2 - (midi - 48) * 0.03);
    const peak = 0.30 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peak, now + 0.005);
    envGain.gain.exponentialRampToValueAtTime(peak * 0.35, now + 0.35);
    envGain.gain.exponentialRampToValueAtTime(0.0006, now + decayTime);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    // Sparkling celesta upper partials
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    osc2.detune.value = 3.5;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.32, now);
    g2.gain.exponentialRampToValueAtTime(0.02, now + 0.85);

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 4.01, now);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.14 * vel, now);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(envGain);
    osc2.connect(g2);
    g2.connect(envGain);
    osc3.connect(g3);
    g3.connect(envGain);

    if (panner) {
      envGain.connect(panner);
      this._connectToBus(panner);
    } else {
      this._connectToBus(envGain);
    }

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    const autoStop = now + decayTime + 0.1;
    osc1.stop(autoStop);
    osc2.stop(autoStop);
    osc3.stop(autoStop);

    return {
      envGain,
      nodes: [osc1, osc2, osc3],
      defaultRelease: 0.55,
      released: false,
    };
  }

  _buildMarimbaVoice(ctx, now, freq, midi, vel) {
    const pan = Math.max(-0.5, Math.min(0.5, (midi - 60) / 34));
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    const envGain = ctx.createGain();
    const decayTime = Math.max(0.55, 1.55 - (midi - 48) * 0.022);
    const peak = 0.42 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peak, now + 0.004);
    envGain.gain.exponentialRampToValueAtTime(0.0008, now + decayTime);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    // Classic marimba bar tuning: strong 4th harmonic (2 octaves up) with short decay
    const osc4 = ctx.createOscillator();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(freq * 4, now);
    const g4 = ctx.createGain();
    g4.gain.setValueAtTime(0.28 * vel, now);
    g4.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    // Soft mallet thump
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(2400, freq * 2.5);
    bp.Q.value = 2.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.14 * vel, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    osc1.connect(envGain);
    osc4.connect(g4);
    g4.connect(envGain);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(envGain);

    if (panner) {
      envGain.connect(panner);
      this._connectToBus(panner);
    } else {
      this._connectToBus(envGain);
    }

    osc1.start(now);
    osc4.start(now);
    noise.start(now);
    const autoStop = now + decayTime + 0.1;
    osc1.stop(autoStop);
    osc4.stop(autoStop);

    return {
      envGain,
      nodes: [osc1, osc4, noise],
      defaultRelease: 0.22,
      released: false,
    };
  }

  _buildHarpVoice(ctx, now, freq, midi, vel) {
    const pan = Math.max(-0.55, Math.min(0.55, (midi - 60) / 30));
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(9000, freq * 7), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.5), now + 0.9);
    filter.Q.value = 1.4;

    const envGain = ctx.createGain();
    const decayTime = Math.max(1.8, 3.8 - (midi - 48) * 0.035);
    const peak = 0.30 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peak, now + 0.01);
    envGain.gain.exponentialRampToValueAtTime(peak * 0.4, now + 0.4);
    envGain.gain.exponentialRampToValueAtTime(0.0006, now + decayTime);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.value = -5;
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 2, now);
    osc3.detune.value = 4;
    const g3 = ctx.createGain();
    g3.gain.value = 0.16;

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    osc3.connect(g3);
    g3.connect(filter);
    filter.connect(envGain);

    if (panner) {
      envGain.connect(panner);
      this._connectToBus(panner);
    } else {
      this._connectToBus(envGain);
    }

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    const autoStop = now + decayTime + 0.1;
    osc1.stop(autoStop);
    osc2.stop(autoStop);
    osc3.stop(autoStop);

    return {
      envGain,
      nodes: [osc1, osc2, osc3],
      defaultRelease: 0.7,
      released: false,
    };
  }

  _buildSynthVoice(ctx, now, freq, midi, vel) {
    const pan = Math.max(-0.45, Math.min(0.45, (midi - 60) / 36));
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.6, now);
    filter.frequency.exponentialRampToValueAtTime(Math.min(6200, freq * 4.5), now + 0.14);
    filter.frequency.exponentialRampToValueAtTime(Math.max(420, freq * 2.2), now + 1.1);
    filter.Q.value = 2.0;

    const envGain = ctx.createGain();
    const peak = 0.25 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peak, now + 0.035);
    envGain.gain.setTargetAtTime(peak * 0.72, now + 0.06, 0.22);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.detune.value = -6;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.value = 6;

    // Gentle dreamy LFO vibrato
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 4.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5.5; // cents
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.detune);
    lfoGain.connect(osc2.detune);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(envGain);

    if (panner) {
      envGain.connect(panner);
      this._connectToBus(panner);
    } else {
      this._connectToBus(envGain);
    }

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);

    return {
      envGain,
      nodes: [osc1, osc2, lfo],
      defaultRelease: 0.42,
      released: false,
    };
  }

  // --------------------------------------------------------------------------
  // Magical Feedback Sounds (gentle, musical)
  // --------------------------------------------------------------------------
  playSparkleChime(notes = [72, 76, 79, 84]) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    notes.forEach((midi, idx) => {
      const t = now + idx * 0.075;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(midiToFreq(midi), t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.65);

      osc.connect(g);
      this._connectToBus(g);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  playSoftNudge() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(175, now + 0.14);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.10, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.16);

    osc.connect(g);
    g.connect(this.dryGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  // --------------------------------------------------------------------------
  // Lookahead Precision Metronome
  // --------------------------------------------------------------------------
  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(180, Math.round(bpm)));
  }

  toggleMetronome() {
    if (this.metronomeRunning) {
      this.stopMetronome();
    } else {
      this.startMetronome();
    }
    return this.metronomeRunning;
  }

  startMetronome() {
    const ctx = this.ensureContext();
    if (!ctx || this.metronomeRunning) return;
    this.metronomeRunning = true;
    this._currentBeat = 0;
    this._nextBeatTime = ctx.currentTime + 0.05;
    this._metroTimer = setInterval(() => this._scheduleMetronome(), 25);
  }

  stopMetronome() {
    this.metronomeRunning = false;
    if (this._metroTimer) {
      clearInterval(this._metroTimer);
      this._metroTimer = null;
    }
  }

  _scheduleMetronome() {
    if (!this.ctx || !this.metronomeRunning) return;
    while (this._nextBeatTime < this.ctx.currentTime + 0.12) {
      const beat = this._currentBeat;
      const time = this._nextBeatTime;
      const isAccent = beat === 0;
      this._playWoodblock(time, isAccent);

      const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
      if (this.onMetronomeBeat) {
        setTimeout(() => {
          if (this.metronomeRunning && this.onMetronomeBeat) {
            this.onMetronomeBeat(beat, this.beatsPerBar);
          }
        }, delayMs);
      }

      this._nextBeatTime += 60 / this.bpm;
      this._currentBeat = (this._currentBeat + 1) % this.beatsPerBar;
    }
  }

  _playWoodblock(time, isAccent) {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isAccent ? 1180 : 840, time);
    osc.frequency.exponentialRampToValueAtTime(isAccent ? 620 : 480, time + 0.035);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(isAccent ? 0.24 : 0.14, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0005, time + 0.045);

    osc.connect(g);
    g.connect(this.dryGain);
    osc.start(time);
    osc.stop(time + 0.05);
  }
}
