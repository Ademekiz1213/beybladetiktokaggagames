// Visual Effects Manager — Enhanced with confetti, shockwave, and theme support
class EffectsManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.particles = [];
        this.textPopups = [];
        this.confetti = [];
        this.shockwaves = [];
    }

    update(dt) {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += (p.gravity || 0) * dt;
            p.life -= dt;
            p.alpha = Math.max(0, p.life / p.maxLife);

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update text popups
        for (let i = this.textPopups.length - 1; i >= 0; i--) {
            const t = this.textPopups[i];
            t.y -= 40 * dt;
            t.life -= dt;
            t.alpha = Math.max(0, t.life / t.maxLife);
            t.scale = 1 + (1 - t.alpha) * 0.3;

            if (t.life <= 0) {
                this.textPopups.splice(i, 1);
            }
        }

        // Update confetti
        for (let i = this.confetti.length - 1; i >= 0; i--) {
            const c = this.confetti[i];
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            c.vy += 300 * dt; // gravity
            c.vx *= 0.99; // air resistance
            c.rotation += c.rotSpeed * dt;
            c.life -= dt;
            c.alpha = Math.max(0, c.life / c.maxLife);
            if (c.life <= 0) {
                this.confetti.splice(i, 1);
            }
        }

        // Update shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const s = this.shockwaves[i];
            s.radius += s.speed * dt;
            s.life -= dt;
            s.alpha = Math.max(0, s.life / s.maxLife);
            if (s.life <= 0) {
                this.shockwaves.splice(i, 1);
            }
        }
    }

    draw() {
        const ctx = this.ctx;

        // Draw shockwaves (behind everything)
        for (const s of this.shockwaves) {
            ctx.save();
            ctx.globalAlpha = s.alpha * 0.6;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.strokeStyle = s.color;
            ctx.lineWidth = s.thickness * s.alpha;
            ctx.stroke();
            ctx.restore();
        }

        // Draw particles
        for (const p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;

            if (p.type === 'circle') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'spark') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.size;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
                ctx.stroke();
            } else if (p.type === 'ring') {
                const ringSize = p.size * (1 - p.alpha) * 3;
                ctx.beginPath();
                ctx.arc(p.x, p.y, ringSize, 0, Math.PI * 2);
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2 * p.alpha;
                ctx.stroke();
            }

            ctx.restore();
        }

        // Draw confetti
        for (const c of this.confetti) {
            ctx.save();
            ctx.globalAlpha = c.alpha;
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rotation);
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
            ctx.restore();
        }

        // Draw text popups
        for (const t of this.textPopups) {
            ctx.save();
            ctx.globalAlpha = t.alpha;
            ctx.font = `bold ${(t.fontSize || 14) * t.scale}px Orbitron`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText(t.text, t.x + 1, t.y + 1);

            // Text
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }
    }

    // ─── COLLISION SPARKS ──────────────────────────────
    spawnCollisionSparks(x, y, intensity) {
        const count = Math.floor(10 + intensity * 20);
        // Theme-aware colors
        const colors = this._getThemeSparkColors();

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 250 * intensity;
            this.particles.push({
                type: 'spark',
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 200,
                size: 1.5 + Math.random() * 2.5,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 0.3 + Math.random() * 0.4,
                maxLife: 0.7,
                alpha: 1
            });
        }

        // Impact flash ring
        this.particles.push({
            type: 'ring', x, y,
            vx: 0, vy: 0, gravity: 0,
            size: 25 + intensity * 35,
            color: colors[0],
            life: 0.3, maxLife: 0.3, alpha: 1
        });

        // Add shockwave for intense hits
        if (intensity > 0.5) {
            this.spawnShockwave(x, y, 30 + intensity * 50, colors[0]);
        }
    }

    // ─── SHOCKWAVE ─────────────────────────────────────
    spawnShockwave(x, y, maxRadius, color) {
        this.shockwaves.push({
            x, y,
            radius: 5,
            speed: maxRadius * 4, // expand fast
            thickness: 3,
            color: color || 'rgba(255, 200, 100, 0.8)',
            life: 0.35,
            maxLife: 0.35,
            alpha: 1
        });
    }

    // ─── ELIMINATION EXPLOSION ─────────────────────────
    spawnElimination(x, y, radius) {
        const count = 40;
        const colors = ['#ff4444', '#ff8844', '#ffcc44', '#ff6644', '#ffffff'];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 300;
            this.particles.push({
                type: Math.random() > 0.3 ? 'circle' : 'spark',
                x: x + (Math.random() - 0.5) * radius,
                y: y + (Math.random() - 0.5) * radius,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 150,
                size: 2 + Math.random() * 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 0.6 + Math.random() * 1,
                maxLife: 1.6,
                alpha: 1
            });
        }

        // Double shockwave
        this.spawnShockwave(x, y, radius * 3, '#ff4444');
        setTimeout(() => this.spawnShockwave(x, y, radius * 2, '#ff8844'), 80);

        // Big flash ring
        this.particles.push({
            type: 'ring', x, y,
            vx: 0, vy: 0, gravity: 0,
            size: radius * 2.5,
            color: '#ff4444',
            life: 0.6, maxLife: 0.6, alpha: 1
        });
    }

    // ─── SPAWN LIGHT ───────────────────────────────────
    spawnLight(x, y) {
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 70;
            this.particles.push({
                type: 'circle',
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: -20,
                size: 3 + Math.random() * 4,
                color: '#00d4ff',
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1,
                alpha: 1
            });
        }

        this.particles.push({
            type: 'ring', x, y,
            vx: 0, vy: 0, gravity: 0,
            size: 40, color: '#00d4ff',
            life: 0.5, maxLife: 0.5, alpha: 1
        });

        this.spawnShockwave(x, y, 50, 'rgba(0, 212, 255, 0.5)');
    }

    // ─── UPGRADE EFFECT ────────────────────────────────
    spawnUpgradeEffect(x, y, text, color) {
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 40;
            this.particles.push({
                type: 'circle',
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: -30,
                size: 2 + Math.random() * 2,
                color: color || '#22d67a',
                life: 0.5 + Math.random() * 0.3,
                maxLife: 0.8,
                alpha: 1
            });
        }

        this.textPopups.push({
            text, x, y: y - 30,
            color: color || '#22d67a',
            life: 1.2, maxLife: 1.2,
            alpha: 1, scale: 1
        });
    }

    // ─── CONFETTI ──────────────────────────────────────
    spawnConfetti(x, y, count = 60) {
        const colors = ['#ff4444', '#facc15', '#00d4ff', '#a855f7', '#22d67a', '#f43f8e', '#ff8844', '#ffffff'];
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
            const speed = 200 + Math.random() * 400;
            this.confetti.push({
                x: x + (Math.random() - 0.5) * 60,
                y: y + (Math.random() - 0.5) * 30,
                vx: Math.cos(angle) * speed * (0.5 + Math.random()),
                vy: Math.sin(angle) * speed,
                w: 4 + Math.random() * 6,
                h: 2 + Math.random() * 3,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 15,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 2 + Math.random() * 2,
                maxLife: 4,
                alpha: 1
            });
        }
    }

    // ─── WINNER CELEBRATION ────────────────────────────
    spawnWinnerCelebration(x, y) {
        const colors = ['#facc15', '#00d4ff', '#a855f7', '#22d67a', '#f43f8e'];

        // Big burst
        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 250;
            this.particles.push({
                type: Math.random() > 0.4 ? 'circle' : 'spark',
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 40,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 100,
                size: 2 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1 + Math.random() * 1.5,
                maxLife: 2.5,
                alpha: 1
            });
        }

        // Triple shockwave
        this.spawnShockwave(x, y, 120, '#facc15');
        setTimeout(() => this.spawnShockwave(x, y, 90, '#00d4ff'), 100);
        setTimeout(() => this.spawnShockwave(x, y, 60, '#a855f7'), 200);

        // Confetti burst (3 waves)
        this.spawnConfetti(x, y, 80);
        setTimeout(() => this.spawnConfetti(x, y - 50, 50), 300);
        setTimeout(() => this.spawnConfetti(x, y - 100, 40), 600);

        this.textPopups.push({
            text: '🏆 KAZANDI!',
            x, y: y - 50,
            color: '#facc15',
            fontSize: 22,
            life: 3, maxLife: 3,
            alpha: 1, scale: 1
        });
    }

    // ─── THEME SPARK COLORS ────────────────────────────
    _getThemeSparkColors() {
        if (window.game && window.game.arena) {
            const themeId = window.game.arena.themeId;
            switch (themeId) {
                case 'inferno': return ['#ff6600', '#ff3300', '#ffaa00', '#ff0000'];
                case 'frost': return ['#88ddff', '#aaeeff', '#ffffff', '#55bbff'];
                case 'void': return ['#aa44ff', '#8800cc', '#cc88ff', '#6600aa'];
                case 'golden': return ['#ffd700', '#ffaa00', '#ffcc44', '#fff8dc'];
                case 'emerald': return ['#44ff88', '#22dd66', '#88ffaa', '#00cc44'];
                case 'blood': return ['#ff2222', '#cc0000', '#ff4444', '#ff6666'];
                case 'galaxy': return ['#aa66ff', '#6644cc', '#88aaff', '#ff66aa'];
                default: return ['#ffcc44', '#ff8844', '#00d4ff', '#ffffff'];
            }
        }
        return ['#ffcc44', '#ff8844', '#00d4ff', '#ffffff'];
    }

    clear() {
        this.particles = [];
        this.textPopups = [];
        this.confetti = [];
        this.shockwaves = [];
    }
}

window.EffectsManager = EffectsManager;
