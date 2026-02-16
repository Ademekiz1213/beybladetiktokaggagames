// Sound Manager — Web Audio API Synthesized Sounds (no files needed)
class SoundManager {
    constructor() {
        this.enabled = true;
        this.volume = 0.3;
        this.ctx = null;
        this._initialized = false;

        // Initialize on first user interaction (browser policy)
        const init = () => {
            if (this._initialized) return;
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this._initialized = true;
            } catch (e) { /* silent */ }
        };
        ['click', 'keydown', 'touchstart'].forEach(e =>
            document.addEventListener(e, init, { once: true })
        );
    }

    _getCtx() {
        if (!this.enabled || !this.ctx) return null;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }

    // ─── COLLISION HIT ─────────────────────────────────
    // Short metallic clang — intensity 0-1
    playCollision(intensity = 0.5) {
        const ctx = this._getCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const vol = this.volume * (0.15 + intensity * 0.35);

        // Noise burst for impact
        const bufferSize = ctx.sampleRate * 0.06;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass filter for metallic sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000 + intensity * 3000;
        filter.Q.value = 5;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.08);

        // Sine ping on top
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 + intensity * 1200, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(vol * 0.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(oscGain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
    }

    // ─── WALL HIT ──────────────────────────────────────
    playWallHit() {
        const ctx = this._getCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const vol = this.volume * 0.15;

        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    // ─── ELIMINATION ───────────────────────────────────
    // Low boom + crumble
    playElimination() {
        const ctx = this._getCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const vol = this.volume * 0.5;

        // Deep boom
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);

        // Crackle noise
        const bufferSize = ctx.sampleRate * 0.3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const t = i / bufferSize;
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2) * (Math.random() > 0.7 ? 1 : 0.2);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(vol * 0.3, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        noise.connect(nGain).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.3);
    }

    // ─── SPAWN ─────────────────────────────────────────
    // Rising shimmer
    playSpawn() {
        const ctx = this._getCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const vol = this.volume * 0.2;

        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const baseFreq = 600 + i * 200;
            const delay = i * 0.06;
            osc.frequency.setValueAtTime(baseFreq, now + delay);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + delay + 0.15);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(vol, now + delay + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.2);
        }
    }

    // ─── WINNER ────────────────────────────────────────
    // Triumphant fanfare — ascending tones
    playWin() {
        const ctx = this._getCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const vol = this.volume * 0.3;

        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            const start = now + i * 0.12;
            osc.frequency.setValueAtTime(freq, start);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(vol, start + 0.02);
            gain.gain.setValueAtTime(vol, start + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, start + (i === 3 ? 0.8 : 0.15));

            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + (i === 3 ? 0.8 : 0.15));
        });
    }

    // ─── COUNTDOWN TICK ────────────────────────────────
    playCountdownTick(urgent = false) {
        const ctx = this._getCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const vol = this.volume * 0.15;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = urgent ? 880 : 660;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
    }
}

window.SoundManager = SoundManager;
window.soundManager = new SoundManager();
