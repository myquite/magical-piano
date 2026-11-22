// ============================================================================
// Nocturne Keys — Midnight Atelier Stage Canvas Engine
// Renders warm lamplight twilight, drifting lo-fi dust motes & subtle rain,
// harmonic chord constellations, true Grand Staff (Treble + Bass), scrolling
// sheet music with key/time signatures & rhythms, and optional Waterfall view.
// ============================================================================

import {
  midiToNoteInfo,
  getDisplayAccidental,
  PITCH_COLORS,
  SHARP_TREBLE_STEPS,
  SHARP_BASS_STEPS,
  FLAT_TREBLE_STEPS,
  FLAT_BASS_STEPS,
} from './musicTheory.js';

export class StageCanvas {
  constructor(canvasEl, keyboardUI) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.keyboard = keyboardUI;

    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Visual & pedagogical state
    this.showStaff = true;
    this.preferFlats = false;
    this.keySigCount = 0;         // +sharps / -flats for Grand Staff
    this.sustainActive = false;
    this.vinylActive = false;
    this.harmonicTint = false;    // When false, uses warm amber/champagne tones; when true, muted pitch palette
    this.songView = 'sheet';      // 'sheet' | 'waterfall'
    this.songGuidance = 'guided'; // 'guided' | 'assist' | 'pure'

    this.activeNotes = new Map(); // midi -> { midi, startTime, info, isDemo }
    this.promptNotes = [];        // [{ midi, state: 'waiting'|'correct'|'wrong', clef?: 'treble'|'bass', label?: string }]
    this.transcribedNotes = [];   // Echo ear-training notes revealed on staff [{ midi }]
    this.fallingState = null;     // { song, currentBeat, waitIndex, lookaheadBeats, hitEvents }
    this.floatingTexts = [];      // Celebratory / milestone captions
    this.notePills = [];          // Subtle rising pitch tags above keys
    this.constellations = [];     // Fading golden chord-arc connections

    // Marginalia whisper (replaces cartoon mascot speech)
    this.marginalia = {
      text: '',
      tone: 'warm', // 'warm' | 'sage' | 'amber' | 'rose'
      timer: 0,
      maxDuration: 3.2,
    };

    // Atmospheric particles (warm dust motes, bokeh, delicate rain streaks)
    this.motes = [];
    this.raindrops = [];
    this.particles = [];
    this.ripples = [];
    this.lampEnergy = 0;

    this._lastTime = performance.now();
    this._rafId = null;

    this._initAtmosphere();
    this.resize();
    this._startLoop();
  }

  _initAtmosphere() {
    this.motes = [];
    for (let i = 0; i < 42; i++) {
      this.motes.push({
        x: Math.random(),
        y: Math.random() * 0.92,
        r: 0.9 + Math.random() * 2.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.9,
        driftX: (Math.random() - 0.5) * 0.008,
        driftY: -(0.004 + Math.random() * 0.009),
        tint: i % 3 === 0 ? '#f2c278' : i % 5 === 0 ? '#a994db' : '#f5ebd6',
      });
    }

    this.raindrops = [];
    for (let i = 0; i < 28; i++) {
      this.raindrops.push({
        x: Math.random(),
        y: Math.random(),
        len: 14 + Math.random() * 26,
        speed: 0.22 + Math.random() * 0.28,
        alpha: 0.04 + Math.random() * 0.07,
      });
    }
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  setShowStaff(show) {
    this.showStaff = Boolean(show);
  }

  setPreferFlats(preferFlats) {
    this.preferFlats = Boolean(preferFlats);
  }

  setKeySignature(count = 0) {
    this.keySigCount = count || 0;
  }

  setSustain(active) {
    this.sustainActive = Boolean(active);
  }

  setVinylActive(active) {
    this.vinylActive = Boolean(active);
  }

  setHarmonicTint(enabled) {
    this.harmonicTint = Boolean(enabled);
  }

  setSongView(view) {
    this.songView = view === 'waterfall' ? 'waterfall' : 'sheet';
  }

  setSongGuidance(level) {
    this.songGuidance = level || 'guided';
  }

  setPromptNotes(notes) {
    this.promptNotes = notes || [];
  }

  setTranscribedNotes(notes) {
    this.transcribedNotes = notes || [];
  }

  setFallingState(state) {
    this.fallingState = state || null;
  }

  showNote(text, tone = 'warm', duration = 3.2) {
    this.marginalia.text = text;
    this.marginalia.tone = tone;
    this.marginalia.timer = duration;
    this.marginalia.maxDuration = duration;
  }

  // Alias for smooth migration
  owlSay(text, mood = 'warm', duration = 3.2) {
    const toneMap = { celebrate: 'sage', curious: 'amber', singing: 'warm', happy: 'warm' };
    this.showNote(text, toneMap[mood] || 'warm', duration);
  }

  celebrateBurst(message = 'Etude Complete') {
    this.showNote(message, 'sage', 4.0);
    const cx = this.width * 0.5;
    const cy = this.height * 0.44;

    // Tasteful golden stardust shimmer (no cartoon confetti)
    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.25;
      const speed = 55 + Math.random() * 130;
      const col = i % 2 === 0 ? '#f2c278' : '#7cc4a9';
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 160,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: 2.5 + Math.random() * 4.5,
        alpha: 0.9,
        life: 1.2 + Math.random() * 0.9,
        maxLife: 2.1,
        color: col,
        gravity: 35,
      });
    }

    this.addFloatingText(message, cx, cy - 8, '#f5d494');
  }

  addFloatingText(text, x, y, color = '#f5d494') {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -24,
      alpha: 1,
      life: 1.7,
      maxLife: 1.7,
      color,
    });
  }

  _noteAccentColor(info) {
    return this.harmonicTint ? info.color.hex : '#e8b86d';
  }

  _noteGlowColor(info) {
    return this.harmonicTint ? info.color.glow : 'rgba(232, 184, 109, 0.55)';
  }

  triggerNoteVisual(midi, isDemo = false) {
    const info = midiToNoteInfo(midi, this.preferFlats);
    this.activeNotes.set(midi, {
      midi,
      startTime: performance.now(),
      info,
      isDemo,
    });

    const stageRect = this.canvas.getBoundingClientRect();
    const geom = this.keyboard.getKeyGeometry(midi, stageRect);
    const x = geom ? geom.centerX : this.width * 0.5;
    const y = this.height - 6;
    const col = this._noteAccentColor(info);

    this.lampEnergy = Math.min(1, this.lampEnergy + 0.22);

    // Subtle warm ink-and-gold ripple above the key
    this.ripples.push({
      x,
      y: y - 3,
      r: 6,
      maxR: 48 + Math.random() * 22,
      alpha: 0.55,
      color: col,
    });

    // If 2+ keys are simultaneously held, draw a delicate harmonic constellation arc!
    if (this.activeNotes.size >= 2) {
      const pts = [];
      for (const entry of this.activeNotes.values()) {
        const g = this.keyboard.getKeyGeometry(entry.midi, stageRect);
        if (g) {
          pts.push({
            x: g.centerX,
            y: this.height - 26 - ((entry.midi - 48) % 24) * 2.2,
            color: this._noteAccentColor(entry.info),
          });
        }
      }
      if (pts.length >= 2) {
        pts.sort((a, b) => a.x - b.x);
        this.constellations.push({
          points: pts,
          life: 1.35,
          maxLife: 1.35,
          color: col,
        });
        if (this.constellations.length > 6) this.constellations.shift();
      }
    }

    // Floating note pill above key (only outside sheet/waterfall song modes)
    if (!isDemo && !(this.fallingState && this.fallingState.song)) {
      this.notePills.push({
        label: info.fullName,
        x: Math.max(26, Math.min(this.width - 26, x)),
        y: y - 16,
        vy: -34,
        life: 0.85,
        maxLife: 0.85,
        color: col,
      });
      if (this.notePills.length > 14) this.notePills.shift();
    }

    // Gentle rising warm light motes
    const count = isDemo ? 4 : 7;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * (geom ? geom.width * 0.5 : 14),
        y: y - 5,
        vx: (Math.random() - 0.5) * 42,
        vy: -(48 + Math.random() * 92),
        size: 1.8 + Math.random() * 3.4,
        alpha: 0.85,
        life: 0.8 + Math.random() * 0.7,
        maxLife: 1.5,
        color: col,
        gravity: -10,
        wobblePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  releaseNoteVisual(midi) {
    this.activeNotes.delete(midi);
  }

  clearActiveVisuals() {
    this.activeNotes.clear();
  }

  _startLoop() {
    const tick = (now) => {
      const dt = Math.min(0.05, (now - this._lastTime) / 1000);
      this._lastTime = now;
      this._update(dt, now / 1000);
      this._draw(now / 1000);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _update(dt, t) {
    this.lampEnergy = Math.max(0, this.lampEnergy - dt * 0.45);

    // Drift background motes lazily
    for (const m of this.motes) {
      m.x += m.driftX * dt;
      m.y += m.driftY * dt;
      if (m.y < -0.04) {
        m.y = 1.02;
        m.x = Math.random();
      }
      if (m.x < -0.02) m.x = 1.02;
      if (m.x > 1.02) m.x = -0.02;
    }

    // Soft diagonal window rain streaks
    const rainSpeedMult = this.vinylActive ? 1.25 : 0.75;
    for (const r of this.raindrops) {
      r.y += r.speed * rainSpeedMult * dt;
      r.x -= r.speed * 0.14 * rainSpeedMult * dt;
      if (r.y > 1.08) {
        r.y = -0.08;
        r.x = Math.random() * 1.12;
      }
    }

    // Subtle shimmer while holding notes
    if (this.activeNotes.size > 0 && Math.random() < dt * 11) {
      const arr = [...this.activeNotes.values()];
      const pick = arr[Math.floor(Math.random() * arr.length)];
      const stageRect = this.canvas.getBoundingClientRect();
      const geom = this.keyboard.getKeyGeometry(pick.midi, stageRect);
      if (geom) {
        this.particles.push({
          x: geom.centerX + (Math.random() - 0.5) * geom.width * 0.4,
          y: this.height - 8,
          vx: (Math.random() - 0.5) * 22,
          vy: -(42 + Math.random() * 58),
          size: 1.6 + Math.random() * 2.4,
          alpha: 0.65,
          life: 0.7 + Math.random() * 0.45,
          maxLife: 1.15,
          color: this._noteAccentColor(pick.info),
          gravity: -8,
          wobblePhase: Math.random() * Math.PI * 2,
        });
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity ?? 0) * dt;
      p.x += p.vx * dt + (p.wobblePhase != null ? Math.sin(t * 3.2 + p.wobblePhase) * 12 * dt : 0);
      p.y += p.vy * dt;
      p.alpha = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.65)));
    }

    // Update ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += 85 * dt;
      r.alpha -= 1.05 * dt;
      if (r.alpha <= 0 || r.r >= r.maxR) this.ripples.splice(i, 1);
    }

    // Update constellations
    for (let i = this.constellations.length - 1; i >= 0; i--) {
      const c = this.constellations[i];
      c.life -= dt;
      for (const pt of c.points) pt.y -= 14 * dt;
      if (c.life <= 0) this.constellations.splice(i, 1);
    }

    // Update floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      ft.alpha = Math.max(0, Math.min(1, ft.life / 0.6));
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Update note pills
    for (let i = this.notePills.length - 1; i >= 0; i--) {
      const np = this.notePills[i];
      np.life -= dt;
      np.y += np.vy * dt;
      np.vy *= Math.pow(0.28, dt);
      if (np.life <= 0) this.notePills.splice(i, 1);
    }

    // Update marginalia timer
    if (this.marginalia.timer > 0) {
      this.marginalia.timer -= dt;
      if (this.marginalia.timer <= 0) this.marginalia.text = '';
    }
  }

  _draw(t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const w = this.width;
    const h = this.height;

    // 1. Nocturnal espresso-indigo gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0f111a');
    sky.addColorStop(0.55, '#171926');
    sky.addColorStop(1, '#211c26');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // 2. Warm tungsten café-lamp radial glow (breathes softly with playing)
    const lampR = Math.max(w, h) * 0.72;
    const lampGrad = ctx.createRadialGradient(
      w * 0.82,
      h * 0.14,
      10,
      w * 0.78,
      h * 0.24,
      lampR
    );
    const energy = 0.08 + this.lampEnergy * 0.08;
    lampGrad.addColorStop(0, `rgba(242, 184, 102, ${energy + 0.07})`);
    lampGrad.addColorStop(0.45, `rgba(218, 148, 86, ${energy * 0.45})`);
    lampGrad.addColorStop(1, 'rgba(15, 17, 26, 0)');
    ctx.fillStyle = lampGrad;
    ctx.fillRect(0, 0, w, h);

    // 3. Subtle cool dusk glow on the left (window moonlight contrast)
    const moonGrad = ctx.createRadialGradient(w * 0.16, h * 0.35, 8, w * 0.16, h * 0.35, lampR * 0.65);
    moonGrad.addColorStop(0, 'rgba(118, 165, 214, 0.09)');
    moonGrad.addColorStop(1, 'rgba(15, 17, 26, 0)');
    ctx.fillStyle = moonGrad;
    ctx.fillRect(0, 0, w, h);

    // 4. Subtle rainy-window streaks (slightly clearer when Vinyl ambience is on)
    const rainAlphaMult = this.vinylActive ? 1.85 : 0.65;
    ctx.save();
    ctx.strokeStyle = 'rgba(215, 224, 244, 0.5)';
    ctx.lineWidth = 0.85;
    for (const r of this.raindrops) {
      ctx.globalAlpha = r.alpha * rainAlphaMult;
      const rx = r.x * w;
      const ry = r.y * h;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - r.len * 0.15, ry + r.len);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Drifting warm dust motes / bokeh
    for (const m of this.motes) {
      const shimmer = 0.28 + 0.62 * (0.5 + 0.5 * Math.sin(t * m.speed + m.phase));
      ctx.globalAlpha = shimmer * 0.55;
      ctx.fillStyle = m.tint;
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 6. Active key vertical light columns (subtle warm glow)
    const stageRect = this.canvas.getBoundingClientRect();
    this._drawKeyBeams(ctx, h, stageRect);

    // 7. Harmonic Chord Constellation Arcs
    this._drawConstellations(ctx);

    // 8. Song Studio Visuals (Scrolling Sheet Music OR Waterfall)
    if (this.fallingState && this.fallingState.song) {
      if (this.songView === 'waterfall') {
        this._drawWaterfall(ctx, w, h, stageRect, t);
      } else {
        this._drawScrollingSheet(ctx, w, h, stageRect, t);
      }
    } else if (this.showStaff && h >= 105) {
      // 9. Real-Time Grand Staff (Free Play, Scales & Chords, Sight & Ear)
      this._drawLiveGrandStaff(ctx, w, h, stageRect, t);
    }

    // 10. Ripples, Motes & Touch Note Pills
    for (const r of this.ripples) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const np of this.notePills) {
      const alpha = Math.max(0, Math.min(1, np.life / (np.maxLife * 0.45)));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
      const tw = ctx.measureText(np.label).width;
      const pw = tw + 14;
      const ph = 20;
      ctx.fillStyle = 'rgba(18, 19, 30, 0.86)';
      ctx.strokeStyle = np.color;
      ctx.lineWidth = 1.2;
      this._roundRect(ctx, np.x - pw / 2, np.y - ph / 2, pw, ph, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f5ebd6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(np.label, np.x, np.y + 0.5);
      ctx.restore();
    }

    // 11. Floating milestone captions
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = '600 18px "Fraunces", Georgia, serif';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 10;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 12. Subtle Marginalia Whisper (editorial caption, bottom-right of stage)
    if (this.marginalia.text && h >= 90) {
      this._drawMarginalia(ctx, w, h);
    }

    ctx.restore();
  }

  _drawKeyBeams(ctx, h, stageRect) {
    for (const entry of this.activeNotes.values()) {
      const geom = this.keyboard.getKeyGeometry(entry.midi, stageRect);
      if (!geom) continue;
      const beamW = Math.max(10, geom.width * 0.78);
      const col = this._noteAccentColor(entry.info);
      const glow = this._noteGlowColor(entry.info);
      const grad = ctx.createLinearGradient(0, h, 0, h * 0.22);
      grad.addColorStop(0, glow);
      grad.addColorStop(0.45, col + '28');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(geom.centerX - beamW / 2, h * 0.22, beamW, h * 0.78);
    }
  }

  _drawConstellations(ctx) {
    for (const c of this.constellations) {
      const alpha = Math.max(0, (c.life / c.maxLife) * 0.42);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = 0; i < c.points.length; i++) {
        const pt = c.points[i];
        if (i === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          const prev = c.points[i - 1];
          const midX = (prev.x + pt.x) / 2;
          const midY = Math.min(prev.y, pt.y) - 16;
          ctx.quadraticCurveTo(midX, midY, pt.x, pt.y);
        }
      }
      ctx.stroke();

      for (const pt of c.points) {
        ctx.fillStyle = '#f5ebd6';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawMarginalia(ctx, w, h) {
    const fade = Math.min(1, this.marginalia.timer / 0.45);
    const text = this.marginalia.text;
    ctx.save();
    ctx.globalAlpha = fade * 0.94;

    const compact = w < 560;
    ctx.font = `${compact ? '500 11px' : '500 12px'} "Plus Jakarta Sans", system-ui, sans-serif`;
    const maxW = Math.min(w - 28, compact ? 280 : 420);
    let shown = text;
    if (ctx.measureText(shown).width > maxW - 30) {
      while (shown.length > 10 && ctx.measureText(shown + '…').width > maxW - 30) {
        shown = shown.slice(0, -1);
      }
      shown += '…';
    }

    const tw = ctx.measureText(shown).width;
    const pillW = tw + 30;
    const pillH = compact ? 24 : 26;
    const x = w - pillW - 14;
    const y = h - pillH - 10;

    const accentMap = {
      warm: '#e8b86d',
      sage: '#7cc4a9',
      amber: '#e5a864',
      rose: '#e07a7a',
    };
    const accent = accentMap[this.marginalia.tone] || '#e8b86d';

    ctx.fillStyle = 'rgba(18, 20, 31, 0.80)';
    ctx.strokeStyle = 'rgba(242, 194, 120, 0.24)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, pillW, pillH, 999);
    ctx.fill();
    ctx.stroke();

    // Small diamond accent
    ctx.fillStyle = accent;
    ctx.font = '600 10px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('◈', x + 10, y + pillH / 2 + 0.5);

    ctx.fillStyle = '#f5ebd6';
    ctx.font = `${compact ? '500 11px' : '500 12px'} "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillText(shown, x + 22, y + pillH / 2 + 0.5);
    ctx.restore();
  }

  _measureRibbonBottom(stageRect, fallback = 54) {
    const ribbonEl = document.getElementById('stageRibbon');
    if (ribbonEl && stageRect) {
      const rRect = ribbonEl.getBoundingClientRect();
      return Math.max(46, rRect.bottom - stageRect.top + 8);
    }
    return fallback;
  }

  // --------------------------------------------------------------------------
  // Shared Notation Drawing Primitives (Clefs, Key Sigs, Rhythmic Noteheads)
  // --------------------------------------------------------------------------
  _drawKeySignature(ctx, xStart, trebleBottomY, bassBottomY, lineGap, keySigCount, showBass = true) {
    if (!keySigCount) return 0;
    const isSharp = keySigCount > 0;
    const count = Math.min(7, Math.abs(keySigCount));
    const glyph = isSharp ? '♯' : '♭';
    const stepH = lineGap / 2;
    const spacing = Math.max(7, lineGap * 0.92);

    const tSteps = isSharp ? SHARP_TREBLE_STEPS : FLAT_TREBLE_STEPS;
    const bSteps = isSharp ? SHARP_BASS_STEPS : FLAT_BASS_STEPS;

    ctx.save();
    ctx.fillStyle = 'rgba(245, 235, 214, 0.78)';
    ctx.font = `600 ${Math.round(lineGap * 1.65)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < count; i++) {
      const x = xStart + i * spacing;
      const ty = trebleBottomY - (tSteps[i] - 2) * stepH;
      ctx.fillText(glyph, x, ty + 0.5);

      if (showBass && bassBottomY != null) {
        const by = bassBottomY - (bSteps[i] - (-10)) * stepH;
        ctx.fillText(glyph, x, by + 0.5);
      }
    }
    ctx.restore();
    return count * spacing + 6;
  }

  _drawNoteOnStaff(ctx, midi, xPos, staffGeom, opts = {}) {
    const {
      trebleBottomY,
      bassBottomY,
      lineGap,
      cardTop,
      cardBottom,
      hasBass,
      keySigCount = 0,
    } = staffGeom;

    const info = midiToNoteInfo(midi, this.preferFlats);
    const useBass = hasBass
      ? (opts.clef ? opts.clef === 'bass' : midi < 60)
      : Boolean(opts.forceSingleBass);

    const bottomLineStep = useBass ? -10 : 2;
    const bottomLineY = useBass ? bassBottomY : trebleBottomY;
    const stepH = lineGap / 2;
    const stepDiff = info.staffStep - bottomLineStep;
    const rawY = bottomLineY - stepDiff * stepH;
    const y = Math.max(cardTop + 10, Math.min(cardBottom - 10, rawY));

    // Ledger lines
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 235, 214, 0.62)';
    ctx.lineWidth = 1.15;
    const ledgerW = Math.max(9, lineGap * 1.15);
    if (stepDiff <= -2) {
      for (let s = -2; s >= stepDiff; s -= 2) {
        const ly = bottomLineY - s * stepH;
        if (ly <= cardBottom - 6 && ly >= cardTop + 6) {
          ctx.beginPath();
          ctx.moveTo(xPos - ledgerW, ly);
          ctx.lineTo(xPos + ledgerW, ly);
          ctx.stroke();
        }
      }
    } else if (stepDiff >= 10) {
      for (let s = 10; s <= stepDiff; s += 2) {
        const ly = bottomLineY - s * stepH;
        if (ly >= cardTop + 6 && ly <= cardBottom - 6) {
          ctx.beginPath();
          ctx.moveTo(xPos - ledgerW, ly);
          ctx.lineTo(xPos + ledgerW, ly);
          ctx.stroke();
        }
      }
    }

    const dur = opts.duration ?? 1;
    const isWhole = dur >= 3.5;
    const isHollow = dur >= 1.9;
    const isDotted = Math.abs(dur - 1.5) < 0.08 || Math.abs(dur - 3.0) < 0.08;
    const isEighth = dur <= 0.6;

    const color = opts.color || this._noteAccentColor(info);
    const rx = Math.max(4.4, lineGap * 0.62);
    const ry = Math.max(3.2, lineGap * 0.44);

    // Notehead
    ctx.save();
    ctx.translate(xPos, y);
    ctx.rotate(-0.26);
    if (opts.glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = opts.glow;
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    if (isHollow) {
      ctx.fillStyle = 'rgba(18, 20, 31, 0.9)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
      if (opts.outline) {
        ctx.strokeStyle = '#fff9ee';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
    ctx.restore();

    // Rhythm augmentation dot
    if (isDotted) {
      ctx.fillStyle = color;
      ctx.beginPath();
      const dotY = stepDiff % 2 === 0 ? y - stepH * 0.45 : y;
      ctx.arc(xPos + rx + 4.5, dotY, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stem & eighth flag (unless whole note or caller suppresses stem for chords)
    if (!isWhole && !opts.noStem) {
      const stemUp = opts.stemDir ? opts.stemDir === 'up' : stepDiff < 4;
      const stemLen = Math.max(18, lineGap * 2.9);
      const sx = stemUp ? xPos + rx - 0.8 : xPos - rx + 0.8;
      const syEnd = stemUp
        ? Math.max(cardTop + 6, y - stemLen)
        : Math.min(cardBottom - 6, y + stemLen);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, syEnd);
      ctx.stroke();

      if (isEighth) {
        ctx.beginPath();
        ctx.moveTo(sx, syEnd);
        if (stemUp) {
          ctx.quadraticCurveTo(sx + 7, syEnd + 5, sx + 5, syEnd + 13);
        } else {
          ctx.quadraticCurveTo(sx + 7, syEnd - 5, sx + 5, syEnd - 13);
        }
        ctx.stroke();
      }
    }

    // Accidental (respecting active key signature!)
    const acc = getDisplayAccidental(info, keySigCount);
    if (acc) {
      ctx.fillStyle = '#f5ebd6';
      ctx.font = `600 ${Math.round(lineGap * 1.6)}px Georgia, serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(acc, xPos - rx - 3, y + 0.5);
    }

    // Fingering number (engraved cleanly on the opposite side of the stem!)
    if (opts.finger) {
      const stemUp = opts.stemDir ? opts.stemDir === 'up' : stepDiff < 4;
      ctx.fillStyle = opts.isCurrent ? '#f5d494' : 'rgba(245, 235, 214, 0.72)';
      ctx.font = `600 ${Math.max(9, Math.round(lineGap * 1.02))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fy = stemUp
        ? Math.min(cardBottom - 7, y + ry + 9)
        : Math.max(cardTop + 9, y - ry - 10);
      ctx.fillText(String(opts.finger), xPos, fy);
    }

    // Optional pitch name caption
    if (opts.showLabel) {
      ctx.fillStyle = 'rgba(245, 235, 214, 0.84)';
      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(info.fullName, xPos, cardBottom - 14);
    }

    ctx.restore();
    return { y, useBass, stepDiff };
  }

  // --------------------------------------------------------------------------
  // 1. REAL-TIME GRAND STAFF (Free Play, Scales & Chords, Sight & Ear)
  // --------------------------------------------------------------------------
  _drawLiveGrandStaff(ctx, w, h, stageRect, t) {
    const ribbonBottom = this._measureRibbonBottom(stageRect, 52);
    const availH = h - ribbonBottom - 16;
    if (availH < 72) return;

    const useGrand = availH >= 148;
    const compact = w < 580 || availH < 185;
    const isPromptActive = this.promptNotes.length > 0 || this.transcribedNotes.length > 0;

    const cardW = Math.min(w - 28, isPromptActive ? 500 : compact ? 340 : 450);
    const lineGap = useGrand ? (availH >= 205 ? 9.5 : 7.5) : (compact ? 8.5 : 10.5);
    const staffGap = useGrand ? lineGap * 3.1 : 0;
    const totalStaffH = useGrand ? lineGap * 8 + staffGap : lineGap * 4;
    const cardH = Math.min(availH, Math.max(useGrand ? 142 : 84, totalStaffH + (useGrand ? 46 : 40)));

    const cardX = (w - cardW) / 2;
    const cardY = ribbonBottom + Math.max(4, (availH - cardH) * 0.42);

    ctx.save();
    // Smoked midnight-parchment card with brass hairline
    ctx.fillStyle = 'rgba(18, 19, 30, 0.72)';
    ctx.strokeStyle = 'rgba(232, 184, 109, 0.24)';
    ctx.lineWidth = 1.1;
    this._roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    const lineLeft = cardX + 20;
    const lineRight = cardX + cardW - 18;
    const trebleTopY = cardY + (cardH - totalStaffH) / 2 + 3;
    const trebleBottomY = trebleTopY + lineGap * 4;
    const bassTopY = useGrand ? trebleBottomY + staffGap : trebleTopY;
    const bassBottomY = useGrand ? bassTopY + lineGap * 4 : trebleBottomY;

    // Single-staff fallback clef decision if viewport is ultra-short
    const activeMidis = [...this.activeNotes.keys()];
    const promptMidis = this.promptNotes.map((p) => p.midi);
    const allMidis = [...activeMidis, ...promptMidis];
    const singleUseBass = !useGrand && (
      this.promptNotes.some((p) => p.clef === 'bass') ||
      (allMidis.length > 0 && Math.min(...allMidis) < 58 && !promptMidis.some((m) => m >= 60))
    );

    // Draw Staff Lines
    ctx.strokeStyle = 'rgba(245, 235, 214, 0.30)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ty = trebleTopY + i * lineGap;
      ctx.beginPath();
      ctx.moveTo(lineLeft, ty);
      ctx.lineTo(lineRight, ty);
      ctx.stroke();

      if (useGrand) {
        const by = bassTopY + i * lineGap;
        ctx.beginPath();
        ctx.moveTo(lineLeft, by);
        ctx.lineTo(lineRight, by);
        ctx.stroke();
      }
    }

    // Left Grand Staff connector barline + subtle brace
    ctx.strokeStyle = 'rgba(232, 184, 109, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(lineLeft, trebleTopY);
    ctx.lineTo(lineLeft, useGrand ? bassBottomY : trebleBottomY);
    ctx.stroke();

    // Right double barline accent
    ctx.strokeStyle = 'rgba(245, 235, 214, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lineRight, trebleTopY);
    ctx.lineTo(lineRight, useGrand ? bassBottomY : trebleBottomY);
    ctx.stroke();

    // Clef Glyphs
    ctx.fillStyle = 'rgba(232, 184, 109, 0.88)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (useGrand) {
      ctx.font = `${Math.round(lineGap * 4.5)}px Georgia, serif`;
      ctx.fillText('𝄞', lineLeft + 3, trebleTopY + lineGap * 2.15);
      ctx.font = `${Math.round(lineGap * 3.4)}px Georgia, serif`;
      ctx.fillText('𝄢', lineLeft + 4, bassTopY + lineGap * 1.65);
    } else if (singleUseBass) {
      ctx.font = `${Math.round(lineGap * 3.4)}px Georgia, serif`;
      ctx.fillText('𝄢', lineLeft + 4, trebleTopY + lineGap * 1.65);
    } else {
      ctx.font = `${Math.round(lineGap * 4.5)}px Georgia, serif`;
      ctx.fillText('𝄞', lineLeft + 3, trebleTopY + lineGap * 2.15);
    }

    // Key Signature
    const keySigStart = lineLeft + Math.round(lineGap * 3.9);
    const keySigW = this._drawKeySignature(
      ctx,
      keySigStart,
      trebleBottomY,
      useGrand ? bassBottomY : null,
      lineGap,
      this.keySigCount,
      useGrand
    );

    // Subtle corner title
    ctx.fillStyle = 'rgba(232, 184, 109, 0.56)';
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const staffTitle = useGrand ? 'GRAND STAFF' : singleUseBass ? 'BASS STAFF' : 'TREBLE STAFF';
    ctx.fillText(staffTitle, cardX + 16, cardY + 7);

    const staffGeom = {
      trebleBottomY,
      bassBottomY,
      lineGap,
      cardTop: cardY + 6,
      cardBottom: cardY + cardH - 6,
      hasBass: useGrand,
      keySigCount: this.keySigCount,
    };

    const noteZoneStart = keySigStart + keySigW + 14;
    const noteZoneWidth = Math.max(80, lineRight - noteZoneStart - 16);

    // Case A: Sight-Reading / Chord / Interval Prompts
    if (this.promptNotes.length > 0) {
      const isChordStack = this.promptNotes.every((p) => p.stacked);
      this.promptNotes.forEach((pn, idx) => {
        const x = isChordStack
          ? noteZoneStart + noteZoneWidth * 0.46
          : noteZoneStart + ((idx + 1) / (this.promptNotes.length + 1)) * noteZoneWidth;

        const col =
          pn.state === 'correct'
            ? '#7cc4a9'
            : pn.state === 'wrong'
            ? '#e07a7a'
            : pn.state === 'anchor'
            ? '#76a5d6'
            : '#f2c278';

        this._drawNoteOnStaff(ctx, pn.midi, x, staffGeom, {
          color: col,
          clef: pn.clef,
          forceSingleBass: singleUseBass,
          glow: pn.state === 'waiting' ? 12 + Math.sin(t * 5) * 4 : 8,
          outline: pn.state === 'waiting',
          showLabel: pn.state === 'correct' || pn.state === 'anchor',
          noStem: isChordStack && idx > 0,
        });
      });

      // Also faintly show live notes being pressed if user is building a chord
      if (isChordStack && activeMidis.length > 0) {
        for (const m of activeMidis) {
          if (!this.promptNotes.some((p) => p.midi === m)) {
            this._drawNoteOnStaff(ctx, m, noteZoneStart + noteZoneWidth * 0.72, staffGeom, {
              color: 'rgba(245, 235, 214, 0.45)',
              forceSingleBass: singleUseBass,
            });
          }
        }
      }
    } else if (this.transcribedNotes.length > 0) {
      // Case B: Ear Training Melodic Echo transcription on the Grand Staff
      this.transcribedNotes.forEach((tn, idx) => {
        const x = noteZoneStart + ((idx + 1) / (Math.max(4, this.transcribedNotes.length) + 1)) * noteZoneWidth;
        this._drawNoteOnStaff(ctx, tn.midi, x, staffGeom, {
          color: '#7cc4a9',
          forceSingleBass: singleUseBass,
          showLabel: true,
        });
      });
    } else if (activeMidis.length > 0) {
      // Case C: Live played notes & chords
      const sorted = activeMidis.slice().sort((a, b) => a - b);
      const center = noteZoneStart + noteZoneWidth * 0.46;

      // Stack chord notes cleanly vertically (nudge seconds slightly right like real engraving!)
      let prevStep = null;
      sorted.forEach((midi, idx) => {
        const info = midiToNoteInfo(midi, this.preferFlats);
        const isSecondCluster = prevStep !== null && Math.abs(info.staffStep - prevStep) <= 1;
        const xOffset = isSecondCluster ? lineGap * 1.15 : 0;
        prevStep = info.staffStep;

        this._drawNoteOnStaff(ctx, midi, center + xOffset, staffGeom, {
          forceSingleBass: singleUseBass,
          glow: 9,
          showLabel: sorted.length <= 2,
          noStem: sorted.length > 1 && idx > 0 && idx < sorted.length - 1,
        });
      });
    } else {
      // Quiet studio placeholder
      ctx.fillStyle = 'rgba(245, 235, 214, 0.30)';
      ctx.font = 'italic 500 12px "Fraunces", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const midY = useGrand ? trebleBottomY + staffGap / 2 : trebleTopY + lineGap * 2;
      ctx.fillText('Strike any note or chord to see it engraved here', noteZoneStart + noteZoneWidth * 0.48, midY);
    }

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 2. SCROLLING GRAND STAFF SHEET MUSIC (Notation-First Song Studio!)
  // --------------------------------------------------------------------------
  _drawScrollingSheet(ctx, w, h, stageRect, t) {
    const { song, currentBeat, waitIndex, hitEvents } = this.fallingState;
    const ribbonBottom = this._measureRibbonBottom(stageRect, 56);
    const availH = h - ribbonBottom - 16;
    if (availH < 82) {
      // Fallback to waterfall if stage is extremely short
      this._drawWaterfall(ctx, w, h, stageRect, t);
      return;
    }

    const songNeedsBass = song.minMidi < 59;
    const useGrand = availH >= 152 && (songNeedsBass || availH >= 185);
    const lineGap = useGrand ? (availH >= 200 ? 9.2 : 7.4) : Math.min(11, Math.max(8, availH * 0.085));
    const staffGap = useGrand ? lineGap * 3.1 : 0;
    const totalStaffH = useGrand ? lineGap * 8 + staffGap : lineGap * 4;

    const cardW = Math.min(w - 24, 920);
    const cardH = Math.min(availH, Math.max(useGrand ? 148 : 96, totalStaffH + (useGrand ? 58 : 48)));
    const cardX = (w - cardW) / 2;
    const cardY = ribbonBottom + Math.max(4, (availH - cardH) * 0.42);

    ctx.save();
    // Warm editorial sheet card
    ctx.fillStyle = 'rgba(18, 19, 30, 0.78)';
    ctx.strokeStyle = 'rgba(232, 184, 109, 0.28)';
    ctx.lineWidth = 1.15;
    this._roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    const lineLeft = cardX + 18;
    const lineRight = cardX + cardW - 18;
    const trebleTopY = cardY + (cardH - totalStaffH) / 2 + 8;
    const trebleBottomY = trebleTopY + lineGap * 4;
    const bassTopY = useGrand ? trebleBottomY + staffGap : trebleTopY;
    const bassBottomY = useGrand ? bassTopY + lineGap * 4 : trebleBottomY;

    // Header label: Piece Title & Key
    ctx.fillStyle = 'rgba(245, 235, 214, 0.62)';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${song.keyLabel.toUpperCase()}  •  ${song.timeSig}  •  ${song.bpm} BPM`, cardX + 18, cardY + 8);

    // Draw Staff Lines
    ctx.strokeStyle = 'rgba(245, 235, 214, 0.30)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ty = trebleTopY + i * lineGap;
      ctx.beginPath();
      ctx.moveTo(lineLeft, ty);
      ctx.lineTo(lineRight, ty);
      ctx.stroke();

      if (useGrand) {
        const by = bassTopY + i * lineGap;
        ctx.beginPath();
        ctx.moveTo(lineLeft, by);
        ctx.lineTo(lineRight, by);
        ctx.stroke();
      }
    }

    // Left connector barline
    ctx.strokeStyle = 'rgba(232, 184, 109, 0.6)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(lineLeft, trebleTopY);
    ctx.lineTo(lineLeft, useGrand ? bassBottomY : trebleBottomY);
    ctx.stroke();

    // Clefs
    ctx.fillStyle = 'rgba(232, 184, 109, 0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(lineGap * 4.5)}px Georgia, serif`;
    ctx.fillText('𝄞', lineLeft + 3, trebleTopY + lineGap * 2.15);
    if (useGrand) {
      ctx.font = `${Math.round(lineGap * 3.4)}px Georgia, serif`;
      ctx.fillText('𝄢', lineLeft + 4, bassTopY + lineGap * 1.65);
    }

    // Key Signature
    const keySigStart = lineLeft + Math.round(lineGap * 3.8);
    const keySigW = this._drawKeySignature(
      ctx,
      keySigStart,
      trebleBottomY,
      useGrand ? bassBottomY : null,
      lineGap,
      song.keySigCount || 0,
      useGrand
    );

    // Time Signature
    const timeX = keySigStart + keySigW + 6;
    const [beatsTop, beatsBot] = (song.timeSig || '4/4').split('/');
    ctx.fillStyle = 'rgba(245, 235, 214, 0.8)';
    ctx.font = `700 ${Math.round(lineGap * 2.1)}px "Fraunces", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(beatsTop || '4', timeX + 6, trebleTopY + lineGap * 1.05);
    ctx.fillText(beatsBot || '4', timeX + 6, trebleTopY + lineGap * 3.05);
    if (useGrand) {
      ctx.fillText(beatsTop || '4', timeX + 6, bassTopY + lineGap * 1.05);
      ctx.fillText(beatsBot || '4', timeX + 6, bassTopY + lineGap * 3.05);
    }

    // Scrolling playhead geometry
    const scrollLeft = timeX + 22;
    const scrollRight = lineRight - 6;
    const playheadX = scrollLeft + Math.min(82, (scrollRight - scrollLeft) * 0.16);
    const beatsPerBar = Number(beatsTop) || 4;
    const pxPerBeat = Math.max(46, Math.min(78, (scrollRight - playheadX) / 6.5));

    // Amber Playhead Beam
    const phGrad = ctx.createLinearGradient(0, cardY + 22, 0, cardY + cardH - 8);
    phGrad.addColorStop(0, 'rgba(232, 184, 109, 0.05)');
    phGrad.addColorStop(0.5, 'rgba(232, 184, 109, 0.65)');
    phGrad.addColorStop(1, 'rgba(232, 184, 109, 0.05)');
    ctx.strokeStyle = phGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, trebleTopY - 12);
    ctx.lineTo(playheadX, (useGrand ? bassBottomY : trebleBottomY) + 12);
    ctx.stroke();

    // Clip scrolling notes & barlines cleanly inside the music viewport
    ctx.save();
    ctx.beginPath();
    ctx.rect(scrollLeft, cardY + 18, scrollRight - scrollLeft, cardH - 22);
    ctx.clip();

    // Draw measure barlines
    const firstBar = Math.max(0, Math.floor((currentBeat - 3) / beatsPerBar));
    const lastBar = Math.ceil((song.totalBeats + beatsPerBar) / beatsPerBar);
    ctx.strokeStyle = 'rgba(245, 235, 214, 0.22)';
    ctx.lineWidth = 1;
    for (let bar = firstBar; bar <= lastBar; bar++) {
      const barBeat = bar * beatsPerBar;
      const bx = playheadX + (barBeat - currentBeat) * pxPerBeat;
      if (bx < scrollLeft - 4 || bx > scrollRight + 4) continue;
      ctx.beginPath();
      ctx.moveTo(bx, trebleTopY);
      ctx.lineTo(bx, useGrand ? bassBottomY : trebleBottomY);
      ctx.stroke();
    }

    const staffGeom = {
      trebleBottomY,
      bassBottomY,
      lineGap,
      cardTop: cardY + 20,
      cardBottom: cardY + cardH - 8,
      hasBass: useGrand,
      keySigCount: song.keySigCount || 0,
    };

    const showFingers = this.songGuidance !== 'pure';

    // Draw events
    song.events.forEach((ev, idx) => {
      const deltaBeats = ev.beat - currentBeat;
      const isCurrent = idx === waitIndex;
      const clampedDelta = isCurrent ? Math.max(0, deltaBeats) : deltaBeats;
      const x = playheadX + clampedDelta * pxPerBeat;

      if (x < scrollLeft - 36 || x > scrollRight + 36) return;

      const isHit = hitEvents && hitEvents.has(idx);
      const isPast = !isHit && deltaBeats < -0.5;
      const noteColor = isHit
        ? '#7cc4a9'
        : isCurrent
        ? '#f2c278'
        : isPast
        ? 'rgba(224, 122, 122, 0.55)'
        : '#f5ebd6';

      // Jazz Chord Symbol above the treble staff
      if (ev.chord) {
        ctx.save();
        ctx.fillStyle = isCurrent ? '#f2c278' : isHit ? 'rgba(124, 196, 169, 0.72)' : 'rgba(232, 184, 109, 0.78)';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(ev.chord, x, Math.max(cardY + 31, trebleTopY - 7));
        ctx.restore();
      }

      // Draw each note in the event (single melody note or stacked jazz voicing)
      const sortedPairs = ev.notes
        .map((m, i) => ({ midi: m, finger: ev.fingers[i] }))
        .sort((a, b) => a.midi - b.midi);

      let prevStep = null;
      const chordResults = [];
      sortedPairs.forEach((pair) => {
        const info = midiToNoteInfo(pair.midi, this.preferFlats);
        const isSecond = prevStep !== null && Math.abs(info.staffStep - prevStep) <= 1;
        prevStep = info.staffStep;
        const nx = isSecond ? x + lineGap * 1.15 : x;

        const res = this._drawNoteOnStaff(ctx, pair.midi, nx, staffGeom, {
          color: noteColor,
          duration: ev.duration,
          glow: isCurrent ? 12 + Math.sin(t * 6) * 4 : 0,
          outline: isCurrent,
          isCurrent,
          finger: showFingers && sortedPairs.length === 1 ? pair.finger : null,
          noStem: sortedPairs.length > 1,
        });
        chordResults.push(res);
      });

      // Draw a single clean unified stem for stacked chords (if not whole notes)
      if (sortedPairs.length > 1 && ev.duration < 3.5 && chordResults.length > 1) {
        const ys = chordResults.map((r) => r.y);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const avgStep = chordResults.reduce((s, r) => s + r.stepDiff, 0) / chordResults.length;
        const stemUp = avgStep < 4;
        const rx = Math.max(4.4, lineGap * 0.62);
        const sx = stemUp ? x + rx - 0.8 : x - rx + 0.8;
        const stemLen = Math.max(18, lineGap * 2.6);

        ctx.save();
        ctx.strokeStyle = noteColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (stemUp) {
          ctx.moveTo(sx, maxY);
          ctx.lineTo(sx, Math.max(cardY + 22, minY - stemLen));
        } else {
          ctx.moveTo(sx, minY);
          ctx.lineTo(sx, Math.min(cardY + cardH - 10, maxY + stemLen));
        }
        ctx.stroke();
        ctx.restore();
      }

      // For chords in Guided/Assist mode, show compact fingering stack cleanly below/above
      if (showFingers && sortedPairs.length > 1 && ev.fingers.length > 0) {
        ctx.save();
        ctx.fillStyle = isCurrent ? '#f5d494' : 'rgba(245, 235, 214, 0.62)';
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(ev.fingers.join('·'), x, (useGrand ? bassBottomY : trebleBottomY) + 6);
        ctx.restore();
      }
    });

    ctx.restore(); // end clip
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 3. OPTIONAL WATERFALL VIEW (Refined Nocturne Spatial Highway)
  // --------------------------------------------------------------------------
  _drawWaterfall(ctx, w, h, stageRect, t) {
    const { song, currentBeat, waitIndex, lookaheadBeats = 4.2, hitEvents } = this.fallingState;
    const hitLineY = h - 14;
    const topY = Math.min(h * 0.42, this._measureRibbonBottom(stageRect, 58));
    const travelH = Math.max(64, hitLineY - topY);
    const pxPerBeat = travelH / lookaheadBeats;

    ctx.save();
    // Soft amber hit-line
    const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, 'rgba(232, 184, 109, 0.08)');
    lineGrad.addColorStop(0.5, 'rgba(232, 184, 109, 0.65)');
    lineGrad.addColorStop(1, 'rgba(232, 184, 109, 0.08)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(w, hitLineY);
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(0, topY, w, hitLineY - topY + 6);
    ctx.clip();

    const showLabels = this.songGuidance !== 'pure';

    song.events.forEach((ev, idx) => {
      if (hitEvents && hitEvents.has(idx)) return;
      const deltaBeats = ev.beat - currentBeat;
      if (deltaBeats + ev.duration < -0.5 || deltaBeats > lookaheadBeats + 0.8) return;

      const isCurrentWait = waitIndex === idx;
      const clampedDelta = isCurrentWait ? Math.max(0, deltaBeats) : deltaBeats;
      const bottomY = hitLineY - clampedDelta * pxPerBeat;
      const noteH = Math.max(22, Math.min(ev.duration * pxPerBeat - 4, travelH * 0.65));
      const capsuleTop = bottomY - noteH;

      ev.notes.forEach((midi, nIdx) => {
        const geom = this.keyboard.getKeyGeometry(midi, stageRect);
        if (!geom) return;

        const info = midiToNoteInfo(midi, this.preferFlats);
        const finger = ev.fingers[nIdx];
        const barW = Math.max(16, geom.width * (geom.isBlack ? 0.9 : 0.76));
        const x = geom.centerX - barW / 2;
        const col = isCurrentWait ? '#f2c278' : this._noteAccentColor(info);

        ctx.save();
        const pulse = isCurrentWait ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
        ctx.shadowColor = col;
        ctx.shadowBlur = isCurrentWait ? 14 + pulse * 8 : 5;

        const radius = Math.min(8, barW / 2, noteH / 2);
        const grad = ctx.createLinearGradient(x, capsuleTop, x, bottomY);
        grad.addColorStop(0, col + 'bb');
        grad.addColorStop(1, col);
        ctx.fillStyle = grad;

        this._roundRect(ctx, x, capsuleTop, barW, noteH, radius);
        ctx.fill();

        ctx.lineWidth = isCurrentWait ? 2 : 1;
        ctx.strokeStyle = isCurrentWait ? '#fff9ee' : 'rgba(255,248,235,0.35)';
        ctx.stroke();

        if (showLabels && noteH >= 20) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#14151f';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const label = finger ? `${info.name}·${finger}` : info.name;
          const fontSize = Math.min(11, Math.max(8.5, barW * 0.33));
          ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
          ctx.fillText(label, geom.centerX, bottomY - Math.min(12, noteH / 2));
        }
        ctx.restore();
      });
    });

    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
