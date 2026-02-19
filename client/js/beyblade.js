// Beyblade class with premium skins
class Beyblade {
    constructor(options) {
        this.id = options.id || Math.random().toString(36).substr(2, 9);
        this.userId = options.userId;
        this.uniqueId = options.uniqueId;
        this.nickname = options.nickname;
        this.profilePictureUrl = options.profilePictureUrl || '';

        // Position & velocity
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.vx = options.vx || 0;
        this.vy = options.vy || 0;

        // Rotation
        this.rotation = 0;
        this.spinSpeed = 12 + Math.random() * 6;

        // Stats
        this.baseRadius = 28;
        this.sizeLevel = 1;
        this.radius = this.baseRadius;
        this.maxHp = 200;
        this.hp = 200;
        this.attack = 10;
        this.mass = 1;

        // Shield
        this.shieldActive = false;
        this.shieldTimer = 0;
        this.shieldDuration = 0;

        // Visual
        this.color = this._generateColor();
        this.profileImage = null;
        this.profileLoaded = false;
        this.alive = true;
        this.spawnTime = Date.now();
        this.spawnAnimProgress = 0;
        this.skinId = options.skinId || 'classic';

        // Damage flash
        this.damageFlash = 0;

        // Load profile image
        this._loadProfileImage();
    }

    _generateColor() {
        const hue = Math.random() * 360;
        return `hsl(${hue}, 70%, 55%)`;
    }

    _loadProfileImage() {
        if (!this.profilePictureUrl) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.profileImage = img;
            this.profileLoaded = true;
        };
        img.onerror = () => {
            // Retry without crossOrigin (CORS may block anonymous)
            const img2 = new Image();
            img2.onload = () => {
                this.profileImage = img2;
                this.profileLoaded = true;
            };
            img2.onerror = () => {
                this.profileLoaded = false;
            };
            img2.src = this.profilePictureUrl;
        };
        img.src = this.profilePictureUrl;
    }

    addSize(amount) {
        this.sizeLevel += amount;
        this.radius = this.baseRadius + (this.sizeLevel - 1) * 5;
        this.mass = 1 + (this.sizeLevel - 1) * 0.3;
        const hpRatio = this.hp / this.maxHp;
        this.maxHp = 100 + (this.sizeLevel - 1) * 20;
        this.hp = this.maxHp * hpRatio;
    }

    addHp(amount) {
        this.hp = Math.min(this.hp + amount, this.maxHp + amount);
        this.maxHp = Math.max(this.maxHp, this.hp);
    }

    fillHpToMax() {
        this.hp = this.maxHp;
    }

    increaseMaxHp(amount, keepFull = true) {
        const increaseAmount = Math.max(0, Number(amount) || 0);
        if (increaseAmount <= 0) return;

        this.maxHp += increaseAmount;
        if (keepFull) {
            this.hp = this.maxHp;
        } else {
            this.hp = Math.min(this.hp, this.maxHp);
        }
    }

    addAttack(amount) {
        this.attack += amount;
    }

    activateShield(duration) {
        this.shieldActive = true;
        this.shieldDuration = duration;
        this.shieldTimer = duration;
    }

    takeDamage(amount) {
        if (this.shieldActive) return 0;
        const actualDamage = Math.max(1, amount);
        this.hp -= actualDamage;
        this.damageFlash = 1;
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
        }
        return actualDamage;
    }

    update(dt) {
        if (!this.alive) return;

        if (this.spawnAnimProgress < 1) {
            this.spawnAnimProgress = Math.min(1, this.spawnAnimProgress + dt * 2.5);
        }

        this.rotation += this.spinSpeed * dt;

        if (this.shieldActive) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) {
                this.shieldActive = false;
                this.shieldTimer = 0;
            }
        }

        if (this.damageFlash > 0) {
            this.damageFlash = Math.max(0, this.damageFlash - dt * 5);
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        const friction = Math.pow(0.85, dt);
        this.vx *= friction;
        this.vy *= friction;

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed < 40 && speed > 0) {
            const boost = 40 / speed;
            this.vx *= boost;
            this.vy *= boost;
        }

        this.spinSpeed = Math.max(6, this.spinSpeed * Math.pow(0.995, dt));
    }

    draw(ctx) {
        if (!this.alive) return;

        const scale = this._easeOutBack(this.spawnAnimProgress);
        const r = this.radius * scale;
        if (r < 1) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Shield glow
        if (this.shieldActive) {
            const shieldPulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005);
            const shieldRadius = r + 12;

            ctx.save();
            ctx.rotate(Date.now() * 0.003);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 / 6) * i - Math.PI / 6;
                const sx = Math.cos(a) * shieldRadius;
                const sy = Math.sin(a) * shieldRadius;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.strokeStyle = `rgba(0, 220, 255, ${shieldPulse * 0.8})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = `rgba(0, 200, 255, ${shieldPulse * 0.08})`;
            ctx.fill();
            ctx.restore();

            ctx.beginPath();
            ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 230, 255, ${shieldPulse * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Damage flash
        if (this.damageFlash > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 80, 80, ${this.damageFlash * 0.3})`;
            ctx.fill();
        }

        // Draw skin body
        this._drawSkin(ctx, r);

        // Profile picture (doesn't rotate)
        const picScale = (window.game && window.game.giftConfig) ? window.game.giftConfig.profilePicScale : 0.6;
        const picRadius = r * Math.max(0.2, Math.min(0.9, picScale));
        ctx.beginPath();
        ctx.arc(0, 0, picRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.save();
        ctx.clip();

        if (this.profileLoaded && this.profileImage) {
            ctx.drawImage(this.profileImage, -picRadius, -picRadius, picRadius * 2, picRadius * 2);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(-picRadius, -picRadius, picRadius * 2, picRadius * 2);
            ctx.fillStyle = 'white';
            ctx.font = `bold ${picRadius * 0.9}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.nickname.charAt(0).toUpperCase(), 0, 0);
        }
        ctx.restore();

        // Profile picture border
        ctx.beginPath();
        ctx.arc(0, 0, picRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(200, 220, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Nickname
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `bold ${Math.max(10, r * 0.32)}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(this.nickname, 0, -r - 14);

        // HP bar
        this._drawHpBar(ctx, r);

        // Size badge
        if (this.sizeLevel > 1) {
            const badgeX = r * 0.7;
            const badgeY = -r * 0.7;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, 9, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 200, 255, 0.8)';
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 9px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`+${this.sizeLevel - 1}`, badgeX, badgeY);
        }

        ctx.restore();
    }

    // ========== SKIN RENDERERS ==========
    _drawSkin(ctx, r) {
        const skin = Beyblade.SKINS[this.skinId] || Beyblade.SKINS['classic'];
        skin.draw(ctx, r, this.rotation);
    }

    _drawHpBar(ctx, r) {
        const barWidth = r * 1.6;
        const barHeight = 5;
        const barX = -barWidth / 2;
        const barY = r + 8;
        const hpRatio = this.hp / this.maxHp;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2, 3);
        ctx.fill();

        let hpColor;
        if (hpRatio > 0.6) hpColor = '#22d67a';
        else if (hpRatio > 0.3) hpColor = '#facc15';
        else hpColor = '#ef4444';

        ctx.fillStyle = hpColor;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * hpRatio, barHeight, 2);
        ctx.fill();

        ctx.shadowColor = hpColor;
        ctx.shadowBlur = 4;
        ctx.fillStyle = hpColor;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * hpRatio, barHeight, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    _easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
}

// ========== SKIN DEFINITIONS ==========
Beyblade.SKINS = {
    // 1. CLASSIC — original design
    classic: {
        name: 'Klasik',
        icon: '⚙️',
        desc: 'Orijinal tasarım',
        draw(ctx, r, rotation) {
            ctx.save();
            ctx.rotate(rotation);

            // Body
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r);
            g.addColorStop(0, '#4a4a6a');
            g.addColorStop(0.7, '#2a2a4a');
            g.addColorStop(1, '#1a1a3a');
            ctx.fillStyle = g;
            ctx.fill();

            // Ring
            ctx.strokeStyle = 'rgba(150, 180, 220, 0.5)';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // 3 Blades
            for (let i = 0; i < 3; i++) {
                const a = (Math.PI * 2 / 3) * i;
                ctx.save();
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(r * 0.45, -r * 0.2);
                ctx.lineTo(r * 0.95, -r * 0.12);
                ctx.lineTo(r * 0.95, r * 0.12);
                ctx.lineTo(r * 0.45, r * 0.2);
                ctx.closePath();
                ctx.fillStyle = 'rgba(100, 140, 200, 0.3)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(120, 160, 220, 0.4)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }

            // Inner ring
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 180, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        }
    },

    // 2. INFERNO — fire theme
    inferno: {
        name: 'Cehennem Ateşi',
        icon: '🔥',
        desc: 'Alev efektli premium',
        draw(ctx, r, rotation) {
            ctx.save();
            ctx.rotate(rotation);

            // Outer flame glow
            const t = Date.now() * 0.003;
            ctx.beginPath();
            ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
            const flameGlow = 0.15 + 0.1 * Math.sin(t * 2);
            ctx.fillStyle = `rgba(255, 80, 0, ${flameGlow})`;
            ctx.fill();

            // Body — dark red/orange gradient
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r);
            g.addColorStop(0, '#6a2020');
            g.addColorStop(0.5, '#4a1515');
            g.addColorStop(1, '#2a0a0a');
            ctx.fillStyle = g;
            ctx.fill();

            // Fire ring
            ctx.strokeStyle = 'rgba(255, 120, 0, 0.7)';
            ctx.lineWidth = 3;
            ctx.stroke();

            // 5 flame blades
            for (let i = 0; i < 5; i++) {
                const a = (Math.PI * 2 / 5) * i;
                ctx.save();
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(r * 0.5, 0);
                ctx.quadraticCurveTo(r * 0.75, -r * 0.2, r * 0.98, 0);
                ctx.quadraticCurveTo(r * 0.75, r * 0.15, r * 0.5, 0);
                ctx.closePath();
                const flameAlpha = 0.3 + 0.15 * Math.sin(t + i * 1.2);
                ctx.fillStyle = `rgba(255, 100, 0, ${flameAlpha})`;
                ctx.fill();
                ctx.restore();
            }

            // Inner fire ring
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 60, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Center ember glow
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
            const embGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.35);
            embGrad.addColorStop(0, 'rgba(255, 180, 0, 0.15)');
            embGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
            ctx.fillStyle = embGrad;
            ctx.fill();

            ctx.restore();
        }
    },

    // 3. FROST — ice/crystal theme
    frost: {
        name: 'Buz Kristali',
        icon: '❄️',
        desc: 'Buzdan yapılmış',
        draw(ctx, r, rotation) {
            ctx.save();
            ctx.rotate(rotation);

            // Frost mist
            ctx.beginPath();
            ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(100, 200, 255, 0.08)';
            ctx.fill();

            // Crystal body
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0, -r * 0.4, 0, 0, 0, r);
            g.addColorStop(0, '#3a5a7a');
            g.addColorStop(0.5, '#1a3a5a');
            g.addColorStop(1, '#0a1a3a');
            ctx.fillStyle = g;
            ctx.fill();

            // Icy ring
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.7)';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // 6 ice crystal spikes
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 / 6) * i;
                ctx.save();
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(r * 0.5, 0);
                ctx.lineTo(r * 0.72, -r * 0.1);
                ctx.lineTo(r * 0.97, 0);
                ctx.lineTo(r * 0.72, r * 0.1);
                ctx.closePath();
                ctx.fillStyle = 'rgba(120, 200, 255, 0.25)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(150, 220, 255, 0.5)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.restore();
            }

            // Inner frost ring
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(150, 220, 255, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Sparkling dots
            const t = Date.now() * 0.002;
            for (let i = 0; i < 4; i++) {
                const sa = t + i * Math.PI / 2;
                const dist = r * 0.7;
                const sx = Math.cos(sa) * dist;
                const sy = Math.sin(sa) * dist;
                const alpha = 0.3 + 0.3 * Math.sin(t * 3 + i);
                ctx.beginPath();
                ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200, 240, 255, ${alpha})`;
                ctx.fill();
            }

            ctx.restore();
        }
    },

    // 4. SHADOW — dark/void theme
    shadow: {
        name: 'Gölge Lordu',
        icon: '🌑',
        desc: 'Karanlık güç',
        draw(ctx, r, rotation) {
            ctx.save();
            ctx.rotate(rotation);

            // Dark aura
            ctx.beginPath();
            ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
            const auraGrad = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r + 5);
            auraGrad.addColorStop(0, 'rgba(80, 0, 120, 0)');
            auraGrad.addColorStop(1, 'rgba(80, 0, 120, 0.15)');
            ctx.fillStyle = auraGrad;
            ctx.fill();

            // Body — deep purple/black
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            g.addColorStop(0, '#2a1040');
            g.addColorStop(0.6, '#150820');
            g.addColorStop(1, '#080010');
            ctx.fillStyle = g;
            ctx.fill();

            // Purple ring
            ctx.strokeStyle = 'rgba(160, 80, 255, 0.6)';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // 4 shadow blades — curved scythes
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI * 2 / 4) * i;
                ctx.save();
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(r * 0.4, 0);
                ctx.quadraticCurveTo(r * 0.7, -r * 0.25, r * 0.96, -r * 0.05);
                ctx.quadraticCurveTo(r * 0.8, r * 0.05, r * 0.4, 0);
                ctx.closePath();
                ctx.fillStyle = 'rgba(140, 60, 255, 0.2)';
                ctx.fill();
                ctx.restore();
            }

            // Inner void ring
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(180, 100, 255, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Rotating void particles
            const t = Date.now() * 0.002;
            for (let i = 0; i < 5; i++) {
                const pa = rotation * 0.5 + i * Math.PI * 2 / 5 + t;
                const dist = r * (0.55 + 0.1 * Math.sin(t * 2 + i));
                const px = Math.cos(pa) * dist;
                const py = Math.sin(pa) * dist;
                ctx.beginPath();
                ctx.arc(px, py, 1.2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(180, 100, 255, ${0.3 + 0.2 * Math.sin(t * 3 + i)})`;
                ctx.fill();
            }

            ctx.restore();
        }
    },

    // 5. GOLDEN — luxury gold theme
    golden: {
        name: 'Altın Şampiyonu',
        icon: '👑',
        desc: 'Lüks altın kaplama',
        draw(ctx, r, rotation) {
            ctx.save();
            ctx.rotate(rotation);

            // Gold glow
            ctx.beginPath();
            ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(250, 200, 50, 0.06)';
            ctx.fill();

            // Body — rich gold gradient
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r);
            g.addColorStop(0, '#6a5a20');
            g.addColorStop(0.4, '#4a3a10');
            g.addColorStop(1, '#2a2000');
            ctx.fillStyle = g;
            ctx.fill();

            // Gold outer ring
            ctx.strokeStyle = 'rgba(250, 204, 50, 0.7)';
            ctx.lineWidth = 3;
            ctx.stroke();

            // 6 ornamental blades
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 / 6) * i;
                ctx.save();
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(r * 0.5, -r * 0.08);
                ctx.lineTo(r * 0.82, -r * 0.15);
                ctx.lineTo(r * 0.96, 0);
                ctx.lineTo(r * 0.82, r * 0.15);
                ctx.lineTo(r * 0.5, r * 0.08);
                ctx.closePath();
                ctx.fillStyle = 'rgba(250, 200, 50, 0.2)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 215, 80, 0.35)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.restore();
            }

            // Inner gold rings
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(250, 200, 50, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(250, 200, 50, 0.15)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            ctx.restore();
        }
    },

    // 6. NEON — cyberpunk/neon theme
    neon: {
        name: 'Neon Fırtınası',
        icon: '💜',
        desc: 'Siber punk ışıkları',
        draw(ctx, r, rotation) {
            ctx.save();
            ctx.rotate(rotation);
            const t = Date.now() * 0.003;

            // Neon glow ring
            ctx.beginPath();
            ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
            const neonPulse = 0.08 + 0.05 * Math.sin(t * 2);
            ctx.fillStyle = `rgba(0, 255, 180, ${neonPulse})`;
            ctx.fill();

            // Dark body
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            g.addColorStop(0, '#1a2a2a');
            g.addColorStop(0.6, '#0a1515');
            g.addColorStop(1, '#050a0a');
            ctx.fillStyle = g;
            ctx.fill();

            // Neon outer ring — animated color shift
            const hue = (Date.now() * 0.05) % 360;
            ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.7)`;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // 3 neon laser blades
            for (let i = 0; i < 3; i++) {
                const a = (Math.PI * 2 / 3) * i;
                const bladeHue = (hue + i * 120) % 360;
                ctx.save();
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(r * 0.4, -r * 0.03);
                ctx.lineTo(r * 0.98, -r * 0.06);
                ctx.lineTo(r * 0.98, r * 0.06);
                ctx.lineTo(r * 0.4, r * 0.03);
                ctx.closePath();
                ctx.fillStyle = `hsla(${bladeHue}, 100%, 60%, 0.25)`;
                ctx.fill();
                ctx.strokeStyle = `hsla(${bladeHue}, 100%, 60%, 0.5)`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.restore();
            }

            // Inner neon ring
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${(hue + 60) % 360}, 100%, 60%, 0.3)`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Circuit lines (tiny details)
            for (let i = 0; i < 6; i++) {
                const ca = (Math.PI * 2 / 6) * i + Math.PI / 6;
                const x1 = Math.cos(ca) * r * 0.52;
                const y1 = Math.sin(ca) * r * 0.52;
                const x2 = Math.cos(ca) * r * 0.75;
                const y2 = Math.sin(ca) * r * 0.75;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `hsla(${(hue + i * 60) % 360}, 100%, 60%, 0.15)`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }

            ctx.restore();
        }
    },

    // 7. DRAGON — mythical dragon theme
    dragon: {
        name: 'Ejderha Ruhu',
        icon: '🐉',
        desc: 'Efsanevi ejderha gücü',
        draw(ctx, r, rotation) {
            ctx.save();
            ctx.rotate(rotation);

            // Dragon breath glow
            const t = Date.now() * 0.003;
            ctx.beginPath();
            ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
            const breathAlpha = 0.06 + 0.04 * Math.sin(t);
            ctx.fillStyle = `rgba(0, 200, 100, ${breathAlpha})`;
            ctx.fill();

            // Body — forest green/dark
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r);
            g.addColorStop(0, '#2a4a2a');
            g.addColorStop(0.6, '#1a3a1a');
            g.addColorStop(1, '#0a1a0a');
            ctx.fillStyle = g;
            ctx.fill();

            // Scales ring
            ctx.strokeStyle = 'rgba(50, 200, 100, 0.6)';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // 4 dragon wings/claws
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI * 2 / 4) * i;
                ctx.save();
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(r * 0.45, 0);
                ctx.quadraticCurveTo(r * 0.65, -r * 0.22, r * 0.95, -r * 0.08);
                ctx.lineTo(r * 0.95, r * 0.08);
                ctx.quadraticCurveTo(r * 0.65, r * 0.18, r * 0.45, 0);
                ctx.closePath();
                ctx.fillStyle = 'rgba(50, 200, 100, 0.2)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(80, 220, 120, 0.35)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.restore();
            }

            // Inner serpent ring
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(50, 200, 100, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Dragon eye particles
            for (let i = 0; i < 3; i++) {
                const ea = t * 1.5 + i * Math.PI * 2 / 3;
                const dist = r * 0.65;
                const ex = Math.cos(ea) * dist;
                const ey = Math.sin(ea) * dist;
                ctx.beginPath();
                ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(100, 255, 150, ${0.3 + 0.2 * Math.sin(t * 3 + i)})`;
                ctx.fill();
            }

            ctx.restore();
        }
    },

    // 8. GALAXY — cosmic/space theme
    galaxy: {
        name: 'Galaksi Yıkıcı',
        icon: '🌌',
        desc: 'Kozmik güç',
        draw(ctx, r, rotation) {
            ctx.save();
            ctx.rotate(rotation);
            const t = Date.now() * 0.002;

            // Cosmic haze
            ctx.beginPath();
            ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
            const hazeGrad = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r + 5);
            hazeGrad.addColorStop(0, 'rgba(80, 50, 150, 0)');
            hazeGrad.addColorStop(1, 'rgba(100, 50, 200, 0.08)');
            ctx.fillStyle = hazeGrad;
            ctx.fill();

            // Body — deep space
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            g.addColorStop(0, '#1a1040');
            g.addColorStop(0.5, '#100830');
            g.addColorStop(1, '#060418');
            ctx.fillStyle = g;
            ctx.fill();

            // Nebula ring
            const ringHue = (t * 20) % 360;
            ctx.strokeStyle = `hsla(${ringHue}, 60%, 50%, 0.5)`;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Spiral arms (2)
            for (let arm = 0; arm < 2; arm++) {
                ctx.beginPath();
                const armOffset = arm * Math.PI;
                for (let j = 0; j < 30; j++) {
                    const angle = armOffset + j * 0.2;
                    const dist = r * 0.3 + j * (r * 0.023);
                    const sx = Math.cos(angle) * dist;
                    const sy = Math.sin(angle) * dist;
                    if (j === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.strokeStyle = `hsla(${(ringHue + arm * 120) % 360}, 70%, 60%, 0.2)`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Stars
            for (let i = 0; i < 8; i++) {
                const sa = i * Math.PI * 2 / 8 + t * 0.5;
                const dist = r * (0.3 + (i % 3) * 0.2);
                const sx = Math.cos(sa) * dist;
                const sy = Math.sin(sa) * dist;
                const starAlpha = 0.3 + 0.3 * Math.sin(t * 4 + i * 2);
                ctx.beginPath();
                ctx.arc(sx, sy, 1, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`;
                ctx.fill();
            }

            ctx.restore();
        }
    }
};

window.Beyblade = Beyblade;
