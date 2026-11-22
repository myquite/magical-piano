// ============================================================================
// Nocturne Keys — Expressive Jazz & Lo-Fi Web Audio Synthesizer + Vinyl Bed
// Zero external samples: Velvet Rhodes, Lo-Fi Felt Upright, Midnight Grand,
// Lounge Vibraphone, Nocturne Tape Pad, warm hall reverb, subtle procedural
// vinyl/rain ambience, true sustain pedal physics, and iOS/iPadOS audio unlock.
// ============================================================================

import { midiToFreq } from './musicTheory.js';

export const INSTRUMENTS = [
  { id: 'rhodes', name: 'Velvet Rhodes',      desc: 'Warm electric piano tines with gentle stereo tremolo' },
  { id: 'felt',   name: 'Lo-Fi Felt Piano',   desc: 'Intimate damped upright with soft felt hammer & tape warmth' },
  { id: 'grand',  name: 'Midnight Grand',     desc: 'Rich acoustic jazz grand piano' },
  { id: 'vibes',  name: 'Lounge Vibraphone',  desc: 'Silky jazz vibraphone with slow motor shimmer' },
  { id: 'pad',    name: 'Nocturne Tape Pad',  desc: 'Hazy analog lo-fi synth pad with warm flutter' },
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

    this.instrument = 'rhodes';
    this.volume = 0.82;
    this.reverbMix = 0.30;
    this.sustain = false;
    this.isUnlocked = false;

    // Active & sustained voice maps: midi -> voice object
    this.activeVoices = new Map();
    this.sustainedVoices = new Map();

    // Optional Lo-Fi Vinyl & Soft Rain Ambience
    this.vinylEnabled = false;
    this._vinylNode = null;
    this._vinylGain = null;
    this._vinylCrackleTimer = null;

    // Metronome state
    this.metronomeRunning = false;
    this.bpm = 84;
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

      // Master bus with gentle tape-style glue compression
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -13;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 3.5;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.2;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 0.88;

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = this.reverbMix;

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this._createReverbImpulse(2.3, 2.7);

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
        // Warm lowpass smoothing for velvety lounge-room decay
        const white = (Math.random() * 2 - 1) * env;
        lp = lp * 0.72 + white * 0.28;
        data[i] = lp * 0.44;
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
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.28));
    }
    return buf;
  }

  setInstrument(id) {
    // Gracefully map legacy saved instrument IDs to new jazz/lo-fi voices
    const legacyMap = {
      piano: 'grand',
      celesta: 'rhodes',
      marimba: 'vibes',
      harp: 'felt',
      synth: 'pad',
    };
    const resolved = INSTRUMENTS.some((inst) => inst.id === id) ? id : (legacyMap[id] || 'rhodes');
    this.instrument = resolved;

    const mixMap = {
      rhodes: 0.30,
      felt: 0.34,
      grand: 0.26,
      vibes: 0.42,
      pad: 0.44,
    };
    this.reverbMix = mixMap[resolved] ?? 0.30;
    if (this.reverbGain && this.ctx) {
      this.reverbGain.gain.setTargetAtTime(this.reverbMix, this.ctx.currentTime, 0.05);
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
        this._releaseVoice(voice, 0.24);
        this.sustainedVoices.delete(midi);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Subtle Lo-Fi Vinyl & Soft Rain Ambience Bed
  // --------------------------------------------------------------------------
  toggleVinylAmbience() {
    this.setVinylAmbience(!this.vinylEnabled);
    return this.vinylEnabled;
  }

  setVinylAmbience(enabled) {
    const next = Boolean(enabled);
    if (next === this.vinylEnabled) return;
    this.vinylEnabled = next;

    if (next) {
      const ctx = this.ensureContext();
      if (!ctx) return;

      // 3-second seamless pink/brownish noise loop for warm tape hiss + distant rain
      const dur = 3.0;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + w * 0.029;
          b1 = 0.985 * b1 + w * 0.032;
          b2 = 0.950 * b2 + w * 0.048;
          // Gentle occasional dust pops baked softly into the loop
          const pop = Math.random() < 0.00018 ? (Math.random() - 0.5) * 0.45 : 0;
          d[i] = (b0 + b1 + b2) * 0.14 + pop;
        }
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 340;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4200;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 0.6);

      src.connect(hp);
      hp.connect(lp);
      lp.connect(gain);
      gain.connect(this.masterGain);
      src.start();

      this._vinylNode = src;
      this._vinylGain = gain;
    } else {
      if (this._vinylGain && this.ctx) {
        const now = this.ctx.currentTime;
        this._vinylGain.gain.cancelScheduledValues(now);
        this._vinylGain.gain.setTargetAtTime(0.0001, now, 0.15);
        const nodeToStop = this._vinylNode;
        setTimeout(() => {
          try { nodeToStop?.stop(); } catch {}
        }, 550);
      }
      this._vinylNode = null;
      this._vinylGain = null;
    }
  }

  noteOn(midi, velocity = 0.78) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clampedVel = Math.max(0.18, Math.min(1, velocity));

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
      case 'felt':
        voice = this._buildFeltPianoVoice(ctx, now, freq, midi, clampedVel);
        break;
      case 'grand':
        voice = this._buildGrandPianoVoice(ctx, now, freq, midi, clampedVel);
        break;
      case 'vibes':
        voice = this._buildVibraphoneVoice(ctx, now, freq, midi, clampedVel);
        break;
      case 'pad':
        voice = this._buildTapePadVoice(ctx, now, freq, midi, clampedVel);
        break;
      case 'rhodes':
      default:
        voice = this._buildRhodesVoice(ctx, now, freq, midi, clampedVel);
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
      this._releaseVoice(voice, voice.defaultRelease ?? 0.30);
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

  _releaseVoice(voice, releaseTime = 0.26) {
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
  // Jazz & Lo-Fi Instrument Builders
  // --------------------------------------------------------------------------

  _buildRhodesVoice(ctx, now, freq, midi, vel) {
    // Classic electric piano: warm sine fundamental + bell tine attack + gentle stereo pan tremolo
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const basePan = Math.max(-0.4, Math.min(0.4, (midi - 60) / 42));
    if (panner) panner.pan.value = basePan;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(5400, freq * (3.2 + vel * 3.8)), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(380, freq * 2.1), now + 0.65);
    filter.Q.value = 0.7;

    const envGain = ctx.createGain();
    const decayTime = Math.max(1.8, 4.6 - (midi - 40) * 0.045);
    const peak = 0.33 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peak, now + 0.007);
    envGain.gain.exponentialRampToValueAtTime(peak * 0.52, now + 0.32);
    envGain.gain.exponentialRampToValueAtTime(0.0008, now + decayTime);

    // Warm Rhodes body
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    // Subtle 2nd harmonic warmth (slight bark on harder velocity)
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.14 * vel, now);
    g2.gain.exponentialRampToValueAtTime(0.02, now + 0.55);

    // Signature glassy tine chime (7th harmonic decaying swiftly)
    const tine = ctx.createOscillator();
    tine.type = 'sine';
    tine.frequency.setValueAtTime(freq * 7.01, now);
    const tineGain = ctx.createGain();
    tineGain.gain.setValueAtTime(0.08 * vel * vel, now);
    tineGain.gain.exponentialRampToValueAtTime(0.0004, now + 0.11);

    // Gentle stereo tremolo LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 3.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.22;
    if (panner) {
      lfo.connect(lfoGain);
      lfoGain.connect(panner.pan);
    }

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    tine.connect(tineGain);
    tineGain.connect(filter);
    filter.connect(envGain);

    if (panner) {
      envGain.connect(panner);
      this._connectToBus(panner);
    } else {
      this._connectToBus(envGain);
    }

    osc1.start(now);
    osc2.start(now);
    tine.start(now);
    lfo.start(now);

    const autoStop = now + decayTime + 0.15;
    osc1.stop(autoStop);
    osc2.stop(autoStop);
    tine.stop(now + 0.18);
    lfo.stop(autoStop);

    return {
      envGain,
      nodes: [osc1, osc2, tine, lfo],
      defaultRelease: 0.36,
      released: false,
    };
  }

  _buildFeltPianoVoice(ctx, now, freq, midi, vel) {
    // Intimate lo-fi felt upright: dark mellow lowpass, soft felt hammer thump, micro tape wow
    const pan = Math.max(-0.45, Math.min(0.45, (midi - 60) / 38));
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(3400, freq * (2.4 + vel * 2.2)), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.35), now + 0.45);
    filter.Q.value = 0.6;

    const envGain = ctx.createGain();
    const decayTime = Math.max(1.2, 3.8 - (midi - 36) * 0.048);
    const peak = 0.38 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peak, now + 0.014); // Soft felt attack
    envGain.gain.exponentialRampToValueAtTime(peak * 0.46, now + 0.28);
    envGain.gain.exponentialRampToValueAtTime(0.0008, now + decayTime);

    // Subtle organic tape pitch wobble
    const tapeDrift = (Math.random() - 0.5) * 4.5;
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.detune.value = tapeDrift;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 1.0012, now);
    osc2.detune.value = -tapeDrift * 0.6;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;

    // Soft wool-felt hammer thump
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = Math.min(1100, freq * 2.1);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.11 * vel, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(filter);
    filter.connect(envGain);

    if (panner) {
      envGain.connect(panner);
      this._connectToBus(panner);
    } else {
      this._connectToBus(envGain);
    }

    osc1.start(now);
    osc2.start(now);
    noise.start(now);

    const autoStop = now + decayTime + 0.15;
    osc1.stop(autoStop);
    osc2.stop(autoStop);

    return {
      envGain,
      nodes: [osc1, osc2, noise],
      defaultRelease: 0.38,
      released: false,
    };
  }

  _buildGrandPianoVoice(ctx, now, freq, midi, vel) {
    const pan = Math.max(-0.55, Math.min(0.55, (midi - 60) / 36));
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const brightPeak = Math.min(9500, freq * (4.2 + vel * 4.8));
    const warmHold = Math.min(4200, freq * (1.7 + vel * 1.3));
    filter.frequency.setValueAtTime(brightPeak, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(220, warmHold), now + 0.55);
    filter.Q.value = 0.85;

    const envGain = ctx.createGain();
    const decayTime = Math.max(1.2, 4.5 - (midi - 36) * 0.055);
    const peakGain = 0.34 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peakGain, now + 0.008);
    envGain.gain.exponentialRampToValueAtTime(peakGain * 0.42, now + 0.24);
    envGain.gain.exponentialRampToValueAtTime(0.0008, now + decayTime);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.0006, now);
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.20;

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 2, now);
    const osc3Gain = ctx.createGain();
    osc3Gain.gain.setValueAtTime(0.26, now);
    osc3Gain.gain.exponentialRampToValueAtTime(0.04, now + 0.7);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = Math.min(3200, freq * 3.0);
    noiseFilter.Q.value = 1.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08 * vel, now);
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
      defaultRelease: 0.34,
      released: false,
    };
  }

  _buildVibraphoneVoice(ctx, now, freq, midi, vel) {
    // Jazz vibraphone: pure warm fundamental, brief metallic 4th overtone, motor tremolo
    const pan = Math.max(-0.5, Math.min(0.5, (midi - 60) / 34));
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    const envGain = ctx.createGain();
    const decayTime = Math.max(1.8, 4.2 - (midi - 48) * 0.035);
    const peak = 0.34 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peak, now + 0.006);
    envGain.gain.exponentialRampToValueAtTime(peak * 0.5, now + 0.45);
    envGain.gain.exponentialRampToValueAtTime(0.0007, now + decayTime);

    // Vibraphone motor fan amplitude modulation
    const tremGain = ctx.createGain();
    tremGain.gain.value = 0.84;
    const motorLfo = ctx.createOscillator();
    motorLfo.type = 'sine';
    motorLfo.frequency.value = 4.2;
    const motorDepth = ctx.createGain();
    motorDepth.gain.value = 0.16;
    motorLfo.connect(motorDepth);
    motorDepth.connect(tremGain.gain);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    const osc4 = ctx.createOscillator();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(freq * 4, now);
    const g4 = ctx.createGain();
    g4.gain.setValueAtTime(0.18 * vel, now);
    g4.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc1.connect(tremGain);
    osc4.connect(g4);
    g4.connect(tremGain);
    tremGain.connect(envGain);

    if (panner) {
      envGain.connect(panner);
      this._connectToBus(panner);
    } else {
      this._connectToBus(envGain);
    }

    osc1.start(now);
    osc4.start(now);
    motorLfo.start(now);

    const autoStop = now + decayTime + 0.15;
    osc1.stop(autoStop);
    osc4.stop(now + 0.3);
    motorLfo.stop(autoStop);

    return {
      envGain,
      nodes: [osc1, osc4, motorLfo],
      defaultRelease: 0.55,
      released: false,
    };
  }

  _buildTapePadVoice(ctx, now, freq, midi, vel) {
    const pan = Math.max(-0.45, Math.min(0.45, (midi - 60) / 36));
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.4, now);
    filter.frequency.exponentialRampToValueAtTime(Math.min(4600, freq * 3.4), now + 0.22);
    filter.frequency.exponentialRampToValueAtTime(Math.max(360, freq * 1.8), now + 1.3);
    filter.Q.value = 1.6;

    const envGain = ctx.createGain();
    const peak = 0.24 * vel;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peak, now + 0.055);
    envGain.gain.setTargetAtTime(peak * 0.72, now + 0.08, 0.25);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.detune.value = -7;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.value = 7;

    // Gentle cassette flutter vibrato
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 3.8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 6.5;
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
      defaultRelease: 0.52,
      released: false,
    };
  }

  // --------------------------------------------------------------------------
  // Subtle Musical Feedback
  // --------------------------------------------------------------------------
  playCadenceChime(notes = [60, 64, 67, 71, 74]) {
    // Lush rolled Cmaj9 cadence upon completing a study or etude
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    notes.forEach((midi, idx) => {
      const t = now + idx * 0.085;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(midiToFreq(midi), t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.95);

      osc.connect(g);
      this._connectToBus(g);
      osc.start(t);
      osc.stop(t + 1.0);
    });
  }

  // Backward-compatible alias
  playSparkleChime(notes) {
    this.playCadenceChime(notes);
  }

  playSoftNudge() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(196, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + 0.13);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.15);

    osc.connect(g);
    g.connect(this.dryGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  // --------------------------------------------------------------------------
  // Lookahead Precision Metronome (Warm Rim-Click / Cross-Stick)
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
      this._playRimClick(time, isAccent);

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

  _playRimClick(time, isAccent) {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isAccent ? 1020 : 720, time);
    osc.frequency.exponentialRampToValueAtTime(isAccent ? 510 : 390, time + 0.032);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(isAccent ? 0.21 : 0.12, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0005, time + 0.042);

    osc.connect(g);
    g.connect(this.dryGain);
    osc.start(time);
    osc.stop(time + 0.048);
  }
}
