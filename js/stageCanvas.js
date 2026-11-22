// ============================================================================
// Starlight Keys — Enchanted Stage Canvas Engine
// Renders twilight starfield, aurora ribbons, pitch-aligned fireflies,
// Pip the Musical Owl mascot, real-time musical staff, and falling song notes.
// ============================================================================

import { midiToNoteInfo, PITCH_COLORS } from './musicTheory.js';

export class StageCanvas {
  constructor(canvasEl, keyboardUI) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.keyboard = keyboardUI;

    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Visual state
    this.showStaff = true;
    this.preferFlats = false;
    this.sustainActive = false;
    this.activeNotes = new Map(); // midi -> { startTime, color, info }
    this.promptNotes = [];        // Sight-reading target notes [{ midi, state: 'waiting'|'correct'|'wrong' }]
    this.fallingState = null;     // { song, currentBeat, waitIndex, lookaheadBeats, hitEvents: Set<number> }
    this.floatingTexts = [];      // Celebratory floating badges ("Sparkle!", "Perfect!", etc.)

    // Particle systems
    this.stars = [];
    this.particles = [];
    this.ripples = [];
    this.auroraEnergy = 0;

    // Pip the Musical Owl animation state
    this.owl = {
      hop: 0,
      hopVel: 0,
      wingFlap: 0,
      blinkTimer: 2.5,
      blinking: false,
      lookX: 0,
      mood: 'happy', // 'happy' | 'curious' | 'celebrate' | 'singing'
      moodTimer: 0,
      speech: '',
      speechTimer: 0,
    };

    this._lastTime = performance.now();
    this._rafId = null;

    this._initStars();
    this.resize();
    this._startLoop();
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < 64; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.85,
        r: 0.7 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.6,
        tint: i % 5 === 0 ? '#ffe699' : i % 7 === 0 ? '#c4b5fd' : '#ffffff',
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

  setSustain(active) {
    this.sustainActive = Boolean(active);
  }

  setPromptNotes(notes) {
    this.promptNotes = notes || [];
  }

  setFallingState(state) {
    this.fallingState = state || null;
  }

  owlSay(text, mood = 'happy', duration = 3.2) {
    this.owl.speech = text;
    this.owl.speechTimer = duration;
    this.owl.mood = mood;
    this.owl.moodTimer = duration;
    if (mood === 'celebrate') {
      this.owl.hopVel = -210;
      this.owl.wingFlap = 1.0;
    } else if (mood === 'singing') {
      this.owl.hopVel = -110;
      this.owl.wingFlap = 0.6;
    }
  }

  celebrateBurst(message = '✨ Bravo!') {
    this.owlSay(message, 'celebrate', 3.5);
    const cx = this.width * 0.5;
    const cy = this.height * 0.42;
    const glyphs = ['✦', '♪', '♫', '★', '✧'];

    for (let i = 0; i < 42; i++) {
      const angle = (Math.PI * 2 * i) / 42 + (Math.random() - 0.5) * 0.3;
      const speed = 90 + Math.random() * 210;
      const col = PITCH_COLORS[i % PITCH_COLORS.length].hex;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 140,
        y: cy + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 70,
        size: 5 + Math.random() * 9,
        alpha: 1,
        life: 1.1 + Math.random() * 0.9,
        maxLife: 2.0,
        color: col,
        glyph: i % 3 === 0 ? glyphs[i % glyphs.length] : null,
        gravity: 160,
      });
    }

    this.addFloatingText(message, cx, cy - 10, '#ffe66d');
  }

  addFloatingText(text, x, y, color = '#ffe66d') {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -36,
      alpha: 1,
      life: 1.25,
      maxLife: 1.25,
      color,
    });
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

    // Gentle aurora glow boost
    this.auroraEnergy = Math.min(1, this.auroraEnergy + 0.24);

    // Owl perks up & glances toward the note!
    this.owl.lookX = Math.max(-1, Math.min(1, (x / Math.max(1, this.width)) * 2 - 1));
    if (this.owl.hop >= 0) {
      this.owl.hopVel = -85;
    }
    this.owl.wingFlap = Math.max(this.owl.wingFlap, 0.45);

    // Expanding starlight ripple at key edge
    this.ripples.push({
      x,
      y: y - 4,
      r: 8,
      maxR: 62 + Math.random() * 28,
      alpha: 0.72,
      color: info.color.hex,
    });

    // Firefly & musical note burst
    const count = isDemo ? 7 : 12;
    const glyphs = ['♪', '♫', '✦', '✧'];
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 90;
      const speedY = -(75 + Math.random() * 145);
      this.particles.push({
        x: x + (Math.random() - 0.5) * (geom ? geom.width * 0.6 : 16),
        y: y - 6,
        vx: spread,
        vy: speedY,
        size: 3 + Math.random() * 5.5,
        alpha: 0.95,
        life: 0.85 + Math.random() * 0.75,
        maxLife: 1.6,
        color: info.color.hex,
        glyph: i === 0 || i === 3 ? glyphs[Math.floor(Math.random() * glyphs.length)] : null,
        gravity: -18, // Gently float upward like fireflies!
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
    // Decay aurora energy
    this.auroraEnergy = Math.max(0, this.auroraEnergy - dt * 0.55);

    // Continuous shimmer from held notes
    if (this.activeNotes.size > 0 && Math.random() < dt * 18) {
      const arr = [...this.activeNotes.values()];
      const pick = arr[Math.floor(Math.random() * arr.length)];
      const stageRect = this.canvas.getBoundingClientRect();
      const geom = this.keyboard.getKeyGeometry(pick.midi, stageRect);
      if (geom) {
        this.particles.push({
          x: geom.centerX + (Math.random() - 0.5) * geom.width * 0.5,
          y: this.height - 10,
          vx: (Math.random() - 0.5) * 35,
          vy: -(65 + Math.random() * 85),
          size: 2.2 + Math.random() * 3.5,
          alpha: 0.8,
          life: 0.75 + Math.random() * 0.45,
          maxLife: 1.2,
          color: pick.info.color.hex,
          glyph: null,
          gravity: -12,
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
      p.x += p.vx * dt + (p.wobblePhase != null ? Math.sin(t * 4.5 + p.wobblePhase) * 18 * dt : 0);
      p.y += p.vy * dt;
      p.alpha = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.65)));
    }

    // Update ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += 110 * dt;
      r.alpha -= 1.25 * dt;
      if (r.alpha <= 0 || r.r >= r.maxR) {
        this.ripples.splice(i, 1);
      }
    }

    // Update floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      ft.alpha = Math.max(0, Math.min(1, ft.life / 0.5));
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Update Pip the Owl physics
    this.owl.hop += this.owl.hopVel * dt;
    this.owl.hopVel += 640 * dt;
    if (this.owl.hop > 0) {
      this.owl.hop = 0;
      this.owl.hopVel = 0;
    }
    this.owl.wingFlap = Math.max(0, this.owl.wingFlap - dt * 2.4);

    this.owl.blinkTimer -= dt;
    if (this.owl.blinkTimer <= 0) {
      if (this.owl.blinking) {
        this.owl.blinking = false;
        this.owl.blinkTimer = 2.6 + Math.random() * 3.0;
      } else {
        this.owl.blinking = true;
        this.owl.blinkTimer = 0.14;
      }
    }

    if (this.owl.moodTimer > 0) {
      this.owl.moodTimer -= dt;
      if (this.owl.moodTimer <= 0) this.owl.mood = 'happy';
    }
    if (this.owl.speechTimer > 0) {
      this.owl.speechTimer -= dt;
      if (this.owl.speechTimer <= 0) this.owl.speech = '';
    }
  }

  _draw(t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const w = this.width;
    const h = this.height;

    // 1. Enchanted twilight sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#120f26');
    sky.addColorStop(0.55, '#1b173a');
    sky.addColorStop(1, '#261e4b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // 2. Soft drifting aurora ribbons
    this._drawAurora(ctx, w, h, t);

    // 3. Twinkling background stars
    for (const s of this.stars) {
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.globalAlpha = twinkle * 0.8;
      ctx.fillStyle = s.tint;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 4. Active key vertical starlight beams
    const stageRect = this.canvas.getBoundingClientRect();
    this._drawKeyBeams(ctx, h, stageRect);

    // 5. Falling Starlight Notes Highway (if in Song mode)
    if (this.fallingState && this.fallingState.song) {
      this._drawFallingHighway(ctx, w, h, stageRect, t);
    }

    // 6. Real-Time Musical Staff (tucked away during Falling Notes so left-hand note lanes stay 100% unobstructed)
    const canShowStaff = this.showStaff && (h >= 120) && !(this.fallingState && this.fallingState.song);
    if (canShowStaff) {
      this._drawMusicalStaff(ctx, w, h, t);
    }

    // 7. Pip the Musical Owl mascot
    if (h >= 110) {
      this._drawPipOwl(ctx, w, h, t);
    }

    // 8. Ripples & Fireflies
    for (const r of this.ripples) {
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      if (p.glyph) {
        ctx.font = `700 ${Math.round(p.size * 2.4)}px "Quicksand", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.glyph, p.x, p.y);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 9. Floating celebration text
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = '700 18px "Fredoka", "Quicksand", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 10. Subtle Sustain Stardust Glow Line along the bottom edge
    if (this.sustainActive) {
      const grad = ctx.createLinearGradient(0, h - 18, 0, h);
      grad.addColorStop(0, 'rgba(255, 224, 130, 0)');
      grad.addColorStop(1, 'rgba(255, 224, 130, 0.32)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - 18, w, 18);
    }

    ctx.restore();
  }

  _drawAurora(ctx, w, h, t) {
    ctx.save();
    const boost = 0.08 + this.auroraEnergy * 0.14;

    const drawRibbon = (yBase, amp, freq, speed, colorA, colorB) => {
      const grad = ctx.createLinearGradient(0, yBase - 60, w, yBase + 60);
      grad.addColorStop(0, colorA);
      grad.addColorStop(0.5, colorB);
      grad.addColorStop(1, colorA);

      ctx.fillStyle = grad;
      ctx.globalAlpha = boost;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 28) {
        const y =
          yBase +
          Math.sin(x * freq + t * speed) * amp +
          Math.cos(x * freq * 0.5 - t * speed * 0.7) * (amp * 0.6);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    };

    drawRibbon(h * 0.42, 22, 0.0045, 0.45, 'rgba(139, 92, 246, 0.45)', 'rgba(94, 234, 212, 0.45)');
    drawRibbon(h * 0.58, 16, 0.006, -0.35, 'rgba(244, 114, 182, 0.35)', 'rgba(96, 165, 250, 0.42)');
    ctx.restore();
  }

  _drawKeyBeams(ctx, h, stageRect) {
    for (const entry of this.activeNotes.values()) {
      const geom = this.keyboard.getKeyGeometry(entry.midi, stageRect);
      if (!geom) continue;
      const beamW = Math.max(12, geom.width * 0.85);
      const grad = ctx.createLinearGradient(0, h, 0, h * 0.12);
      grad.addColorStop(0, entry.info.color.glow);
      grad.addColorStop(0.45, entry.info.color.hex + '44');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(geom.centerX - beamW / 2, h * 0.12, beamW, h * 0.88);
    }
  }

  // --------------------------------------------------------------------------
  // Falling Starlight Notes Highway (Guided Song Mode)
  // --------------------------------------------------------------------------
  _drawFallingHighway(ctx, w, h, stageRect, t) {
    const { song, currentBeat, waitIndex, lookaheadBeats = 4.2, hitEvents } = this.fallingState;
    const hitLineY = h - 14;

    // Dynamically start right below the floating mode ribbon so notes never collide with controls
    const ribbonEl = document.getElementById('stageRibbon');
    let topY = 58;
    if (ribbonEl && stageRect) {
      const rRect = ribbonEl.getBoundingClientRect();
      topY = Math.max(52, Math.min(h * 0.42, rRect.bottom - stageRect.top + 8));
    }
    const travelH = Math.max(64, hitLineY - topY);
    const pxPerBeat = travelH / lookaheadBeats;

    // Glowing Starlight Hit-Line right above the piano keys
    ctx.save();
    const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, 'rgba(255, 230, 109, 0.1)');
    lineGrad.addColorStop(0.5, 'rgba(255, 230, 109, 0.72)');
    lineGrad.addColorStop(1, 'rgba(255, 230, 109, 0.1)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(w, hitLineY);
    ctx.stroke();

    // Clip falling note capsules strictly below the floating ribbon
    ctx.beginPath();
    ctx.rect(0, topY, w, hitLineY - topY + 6);
    ctx.clip();

    // Draw each visible upcoming / active note capsule
    song.events.forEach((ev, idx) => {
      if (hitEvents && hitEvents.has(idx)) return;

      const deltaBeats = ev.beat - currentBeat;
      // Skip notes far in past or far in future
      if (deltaBeats + ev.duration < -0.5 || deltaBeats > lookaheadBeats + 0.8) return;

      const isCurrentWait = waitIndex === idx;
      const clampedDelta = isCurrentWait ? Math.max(0, deltaBeats) : deltaBeats;
      const bottomY = hitLineY - clampedDelta * pxPerBeat;
      const noteH = Math.max(24, Math.min(ev.duration * pxPerBeat - 4, travelH * 0.65));
      const capsuleTop = bottomY - noteH;

      ev.notes.forEach((midi, nIdx) => {
        const geom = this.keyboard.getKeyGeometry(midi, stageRect);
        if (!geom) return;

        const info = midiToNoteInfo(midi, this.preferFlats);
        const finger = ev.fingers[nIdx];
        const barW = Math.max(18, geom.width * (geom.isBlack ? 0.92 : 0.78));
        const x = geom.centerX - barW / 2;

        ctx.save();
        // Pulse glow on the active target note!
        const pulse = isCurrentWait ? 0.5 + 0.5 * Math.sin(t * 7) : 0;
        ctx.shadowColor = info.color.hex;
        ctx.shadowBlur = isCurrentWait ? 18 + pulse * 10 : 8;

        // Capsule body
        const radius = Math.min(10, barW / 2, noteH / 2);
        const grad = ctx.createLinearGradient(x, capsuleTop, x, bottomY);
        grad.addColorStop(0, info.color.hex + 'cc');
        grad.addColorStop(1, info.color.hex);
        ctx.fillStyle = grad;

        this._roundRect(ctx, x, capsuleTop, barW, noteH, radius);
        ctx.fill();

        // Crisp white highlight border on active target
        ctx.lineWidth = isCurrentWait ? 2.4 : 1.2;
        ctx.strokeStyle = isCurrentWait ? '#ffffff' : 'rgba(255,255,255,0.45)';
        ctx.stroke();

        // Note name / finger number inside capsule
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#141129';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = finger ? `${info.name}·${finger}` : info.name;
        const fontSize = Math.min(12, Math.max(9, barW * 0.34));
        ctx.font = `700 ${fontSize}px "Quicksand", system-ui, sans-serif`;
        if (noteH >= 22) {
          ctx.fillText(label, geom.centerX, bottomY - Math.min(13, noteH / 2));
        }

        ctx.restore();
      });
    });

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Real-Time Musical Staff (Treble Clef + Automatic Bass Clef / Ledger Lines)
  // --------------------------------------------------------------------------
  _drawMusicalStaff(ctx, w, h, t) {
    const compact = w < 520 || h < 175;
    const isFalling = Boolean(this.fallingState && this.fallingState.song);

    const cardW = compact ? Math.min(210, w * 0.56) : isFalling ? 215 : Math.min(310, w * 0.42);
    const cardH = compact ? 92 : 114;
    const cardX = isFalling ? 14 : compact ? 12 : Math.max(16, w * 0.04);
    const cardY = Math.max(54, (h - cardH) * 0.54);

    ctx.save();

    // Translucent storybook parchment-glass card
    ctx.fillStyle = 'rgba(20, 16, 42, 0.62)';
    ctx.strokeStyle = 'rgba(255, 236, 179, 0.24)';
    ctx.lineWidth = 1.2;
    this._roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    // Determine if we're primarily in bass register (< C4)
    const activeMidis = [...this.activeNotes.keys()];
    const promptMidis = this.promptNotes.map((p) => p.midi);
    const allDisplayMidis = [...activeMidis, ...promptMidis];
    const lowestMidi = allDisplayMidis.length > 0 ? Math.min(...allDisplayMidis) : 60;
    const useBassClef = lowestMidi < 57 && !promptMidis.some((m) => m >= 60);

    // 5 Staff Lines
    // Treble clef bottom line = E4 (staffStep 2), top line = F5 (staffStep 10)
    // Bass clef bottom line = G2 (staffStep -10), top line = A3 (staffStep -2)
    const bottomLineStep = useBassClef ? -10 : 2;
    const lineGap = compact ? 9 : 11;
    const stepH = lineGap / 2;
    const staffTopY = cardY + (cardH - lineGap * 4) / 2 + 2;
    const bottomLineY = staffTopY + lineGap * 4;
    const lineLeft = cardX + 14;
    const lineRight = cardX + cardW - 14;

    ctx.strokeStyle = 'rgba(255, 248, 225, 0.36)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 5; i++) {
      const y = staffTopY + i * lineGap;
      ctx.beginPath();
      ctx.moveTo(lineLeft, y);
      ctx.lineTo(lineRight, y);
      ctx.stroke();
    }

    // Clef Glyph
    ctx.fillStyle = 'rgba(255, 232, 163, 0.85)';
    if (useBassClef) {
      ctx.font = `${compact ? 30 : 36}px serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText('𝄢', lineLeft + 2, staffTopY + lineGap * 1.55);
    } else {
      ctx.font = `${compact ? 42 : 52}px serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText('𝄞', lineLeft + 1, staffTopY + lineGap * 2.15);
    }

    // Small label in top-left corner of staff card
    ctx.font = '600 9.5px "Quicksand", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 236, 179, 0.55)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(useBassClef ? 'BASS STAFF' : 'TREBLE STAFF', cardX + 14, cardY + 7);

    // Helper to draw a note on the staff
    const drawStaffNote = (midi, xPos, opts = {}) => {
      const info = midiToNoteInfo(midi, this.preferFlats);
      const stepDiff = info.staffStep - bottomLineStep;
      const y = bottomLineY - stepDiff * stepH;

      // Clamp extreme notes subtly so they stay within card frame
      const clampedY = Math.max(cardY + 14, Math.min(cardY + cardH - 12, y));

      // Draw Ledger Lines if above top line (stepDiff > 8) or below bottom line (stepDiff < 0)
      ctx.strokeStyle = 'rgba(255, 248, 225, 0.65)';
      ctx.lineWidth = 1.2;
      if (stepDiff <= -2) {
        for (let s = -2; s >= stepDiff; s -= 2) {
          const ly = bottomLineY - s * stepH;
          if (ly <= cardY + cardH - 8) {
            ctx.beginPath();
            ctx.moveTo(xPos - 12, ly);
            ctx.lineTo(xPos + 12, ly);
            ctx.stroke();
          }
        }
      } else if (stepDiff >= 10) {
        for (let s = 10; s <= stepDiff; s += 2) {
          const ly = bottomLineY - s * stepH;
          if (ly >= cardY + 10) {
            ctx.beginPath();
            ctx.moveTo(xPos - 12, ly);
            ctx.lineTo(xPos + 12, ly);
            ctx.stroke();
          }
        }
      }

      const color = opts.color || info.color.hex;
      const rx = compact ? 6.2 : 7.2;
      const ry = compact ? 4.4 : 5.2;

      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = opts.isPrompt ? 14 + Math.sin(t * 6) * 5 : 10;

      // Tilted musical notehead
      ctx.translate(xPos, clampedY);
      ctx.rotate(-0.26);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      if (opts.isPrompt) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.restore();

      // Stem (up if below middle line stepDiff < 4, else down)
      const stemUp = stepDiff < 4;
      const stemLen = compact ? 22 : 27;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      if (stemUp) {
        ctx.moveTo(xPos + rx - 1, clampedY);
        ctx.lineTo(xPos + rx - 1, Math.max(cardY + 10, clampedY - stemLen));
      } else {
        ctx.moveTo(xPos - rx + 1, clampedY);
        ctx.lineTo(xPos - rx + 1, Math.min(cardY + cardH - 8, clampedY + stemLen));
      }
      ctx.stroke();

      // Accidental (♯ / ♭)
      if (info.accidental) {
        ctx.fillStyle = '#fff8e1';
        ctx.font = `700 ${compact ? 14 : 16}px serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.accidental, xPos - rx - 3, clampedY);
      }

      // Subtle note name badge on active user notes (never during sight-read prompt!)
      if (!opts.hideLabel) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = '700 9.5px "Quicksand", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(info.fullName, xPos, cardY + cardH - 14);
      }
    };

    const noteZoneStart = lineLeft + (compact ? 54 : 66);
    const noteZoneWidth = Math.max(60, lineRight - noteZoneStart - 16);

    // Draw Sight-Read Prompt Notes (if active)
    if (this.promptNotes.length > 0) {
      this.promptNotes.forEach((pn, idx) => {
        const x = noteZoneStart + ((idx + 1) / (this.promptNotes.length + 1)) * noteZoneWidth;
        const col =
          pn.state === 'correct' ? '#5eead4' : pn.state === 'wrong' ? '#ff6b7a' : '#ffe66d';
        drawStaffNote(pn.midi, x, {
          color: col,
          isPrompt: true,
          hideLabel: pn.state === 'waiting',
        });
      });
    } else if (activeMidis.length > 0) {
      // Draw live played notes cleanly (spread horizontally if multiple notes are held)
      const sorted = activeMidis.slice().sort((a, b) => a - b);
      const center = noteZoneStart + noteZoneWidth * 0.45;
      sorted.forEach((midi, idx) => {
        const spread = sorted.length === 1 ? 0 : (idx - (sorted.length - 1) / 2) * 26;
        drawStaffNote(midi, Math.max(noteZoneStart + 14, Math.min(lineRight - 16, center + spread)), {
          hideLabel: false,
        });
      });
    } else {
      // Gentle idle hint
      ctx.fillStyle = 'rgba(255, 248, 225, 0.34)';
      ctx.font = '600 11px "Quicksand", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Play a key to see it here ♪', noteZoneStart + noteZoneWidth * 0.48, staffTopY + lineGap * 2);
    }

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Pip the Musical Owl Mascot (Vector-drawn, lively & charming)
  // --------------------------------------------------------------------------
  _drawPipOwl(ctx, w, h, t) {
    const compact = w < 520 || h < 160;
    const scale = compact ? 0.72 : 0.96;
    const x = w - (compact ? 48 : 74);
    const baseY = h - (compact ? 42 : 56);
    const bob = Math.sin(t * 2.6) * 2.5;
    const y = baseY + this.owl.hop + bob;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Glowing Crescent Moon Perch
    ctx.save();
    ctx.translate(0, 26 - this.owl.hop * 0.5);
    ctx.fillStyle = '#ffe58f';
    ctx.shadowColor = 'rgba(255, 229, 143, 0.5)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0.18 * Math.PI, 0.85 * Math.PI, false);
    ctx.quadraticCurveTo(2, 16, -24, 12);
    ctx.fill();
    ctx.restore();

    // Little wings (flap softly when you play!)
    const flapAngle = this.owl.wingFlap * 0.55;
    ctx.fillStyle = '#5c4b99';
    // Left wing
    ctx.save();
    ctx.translate(-22, 2);
    ctx.rotate(0.2 + flapAngle);
    ctx.beginPath();
    ctx.ellipse(-4, 6, 8, 16, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Right wing
    ctx.save();
    ctx.translate(22, 2);
    ctx.rotate(-0.2 - flapAngle);
    ctx.beginPath();
    ctx.ellipse(4, 6, 8, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Plump starry owl body
    const bodyGrad = ctx.createRadialGradient(-6, -12, 4, 0, 0, 32);
    bodyGrad.addColorStop(0, '#8d7ae6');
    bodyGrad.addColorStop(1, '#58469e');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2, 24, 27, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute feathery ear tufts
    ctx.beginPath();
    ctx.moveTo(-18, -16);
    ctx.lineTo(-24, -30);
    ctx.lineTo(-8, -22);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(18, -16);
    ctx.lineTo(24, -30);
    ctx.lineTo(8, -22);
    ctx.closePath();
    ctx.fill();

    // Warm cream belly with subtle musical crescent feathers
    ctx.fillStyle = '#fdf3d7';
    ctx.beginPath();
    ctx.ellipse(0, 11, 15, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly feather scallops
    ctx.strokeStyle = 'rgba(139, 112, 199, 0.45)';
    ctx.lineWidth = 1.4;
    for (const [fx, fy] of [[-5, 8], [5, 8], [0, 14]]) {
      ctx.beginPath();
      ctx.arc(fx, fy, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    // Little golden feet on moon
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(-7, 26, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(7, 26, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Big expressive eyes
    const eyeY = -6;
    const pupilDx = this.owl.lookX * 2.2;
    for (const ex of [-9, 9]) {
      ctx.fillStyle = '#fffdf7';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 8.2, 0, Math.PI * 2);
      ctx.fill();

      if (this.owl.blinking) {
        ctx.strokeStyle = '#2e2459';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(ex, eyeY + 1, 5, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      } else if (this.owl.mood === 'celebrate') {
        // Happy arched smiling eyes ^ ^
        ctx.strokeStyle = '#2e2459';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(ex, eyeY + 2, 4.5, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#1b1438';
        ctx.beginPath();
        ctx.arc(ex + pupilDx, eyeY, 4.4, 0, Math.PI * 2);
        ctx.fill();
        // Starlight eye sparkle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + pupilDx + 1.6, eyeY - 1.6, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Tiny golden beak
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(-4, -1);
    ctx.lineTo(4, -1);
    ctx.lineTo(0, 5.5);
    ctx.closePath();
    ctx.fill();

    // Tiny glowing wizard/conductor star above Pip's head
    ctx.fillStyle = '#ffe66d';
    ctx.shadowColor = '#ffe66d';
    ctx.shadowBlur = 10;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦', 0, -34 + Math.sin(t * 4) * 2);

    ctx.restore();

    // Optional Speech Bubble to the left of Pip
    if (this.owl.speech && this.owl.speechTimer > 0 && w >= 360) {
      ctx.save();
      ctx.font = '600 12px "Quicksand", system-ui, sans-serif';
      const padX = 12;
      const textW = ctx.measureText(this.owl.speech).width;
      const boxW = Math.min(w * 0.55, textW + padX * 2);
      const boxH = 28;
      const boxX = Math.max(12, x - (compact ? 26 : 36) - boxW);
      const boxY = Math.max(54, y - 34);

      const alpha = Math.min(1, this.owl.speechTimer * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(255, 250, 235, 0.94)';
      ctx.shadowColor = 'rgba(12, 8, 30, 0.45)';
      ctx.shadowBlur = 12;
      this._roundRect(ctx, boxX, boxY, boxW, boxH, 12);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#241b4a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.owl.speech, boxX + boxW / 2, boxY + boxH / 2 + 0.5, boxW - 14);
      ctx.restore();
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
}
