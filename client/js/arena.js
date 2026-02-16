// Arena - Beyblade Stadium with Premium Themes & Shape Modes
class Arena {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.centerX = 0;
        this.centerY = 0;
        this.radius = 0;
        this.themeId = 'cyber'; // default
        this.shape = 'circle'; // 'circle' or 'rectangle'

        // Rectangle bounds (computed on resize)
        this.rectW = 0;
        this.rectH = 0;
        this.rectCornerRadius = 20;
        this.resize();
    }

    resize() {
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        // Arena radius = 40% of the smaller dimension
        this.radius = Math.min(this.canvas.width, this.canvas.height) * 0.40;
        // Rectangle = 60% of canvas width, 70% height
        this.rectW = this.canvas.width * 0.60;
        this.rectH = this.canvas.height * 0.70;
        this.rectCornerRadius = Math.min(this.rectW, this.rectH) * 0.06;
    }

    setTheme(themeId) {
        if (Arena.THEMES[themeId]) {
            this.themeId = themeId;
        }
    }

    setShape(shapeId) {
        if (shapeId === 'circle' || shapeId === 'rectangle') {
            this.shape = shapeId;
        }
    }

    draw() {
        const theme = Arena.THEMES[this.themeId] || Arena.THEMES.cyber;
        theme.draw(this.ctx, this.centerX, this.centerY, this.radius, this.canvas, this);
    }

    // Helper: draw the arena shape path (circle or rounded rect)
    drawShapePath(ctx, padding) {
        padding = padding || 0;
        if (this.shape === 'rectangle') {
            const w = this.rectW + padding * 2;
            const h = this.rectH + padding * 2;
            const x = this.centerX - w / 2;
            const y = this.centerY - h / 2;
            const cr = this.rectCornerRadius + padding * 0.3;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, cr);
        } else {
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, this.radius + padding, 0, Math.PI * 2);
        }
    }

    // Check if point is inside arena
    isInside(x, y) {
        if (this.shape === 'rectangle') {
            const hw = this.rectW / 2;
            const hh = this.rectH / 2;
            return Math.abs(x - this.centerX) <= hw && Math.abs(y - this.centerY) <= hh;
        }
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    // Get distance from center (0 = center, 1 = edge)
    getDistanceRatio(x, y) {
        if (this.shape === 'rectangle') {
            const hw = this.rectW / 2;
            const hh = this.rectH / 2;
            const rx = Math.abs(x - this.centerX) / hw;
            const ry = Math.abs(y - this.centerY) / hh;
            return Math.max(rx, ry);
        }
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        return Math.sqrt(dx * dx + dy * dy) / this.radius;
    }

    // Constrain point inside arena with bounce
    constrainPoint(x, y, objectRadius) {
        if (this.shape === 'rectangle') {
            return this._constrainRect(x, y, objectRadius);
        }
        return this._constrainCircle(x, y, objectRadius);
    }

    _constrainCircle(x, y, objectRadius) {
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = this.radius - objectRadius;

        if (dist > maxDist && maxDist > 0) {
            const angle = Math.atan2(dy, dx);
            return {
                x: this.centerX + Math.cos(angle) * maxDist,
                y: this.centerY + Math.sin(angle) * maxDist,
                bounced: true,
                normalX: -Math.cos(angle),
                normalY: -Math.sin(angle)
            };
        }
        return { x, y, bounced: false, normalX: 0, normalY: 0 };
    }

    _constrainRect(x, y, objectRadius) {
        const left = this.centerX - this.rectW / 2 + objectRadius;
        const right = this.centerX + this.rectW / 2 - objectRadius;
        const top = this.centerY - this.rectH / 2 + objectRadius;
        const bottom = this.centerY + this.rectH / 2 - objectRadius;

        let bounced = false;
        let normalX = 0, normalY = 0;
        let nx = x, ny = y;

        if (x < left) {
            nx = left; bounced = true; normalX = 1;
        } else if (x > right) {
            nx = right; bounced = true; normalX = -1;
        }

        if (y < top) {
            ny = top; bounced = true; normalY = 1;
        } else if (y > bottom) {
            ny = bottom; bounced = true; normalY = -1;
        }

        // Normalize if both axes bounced (corner hit)
        if (normalX !== 0 && normalY !== 0) {
            const len = Math.sqrt(normalX * normalX + normalY * normalY);
            normalX /= len;
            normalY /= len;
        }

        return { x: nx, y: ny, bounced, normalX, normalY };
    }
}

// ========== ARENA THEME DEFINITIONS ==========
Arena.THEMES = {

    // ─── 1. CYBER (Default) ─────────────────────────────
    cyber: {
        name: 'Siber Arena',
        icon: '💎',
        desc: 'Neon mavi teknoloji',
        bgColors: ['#0f0f1e', '#050510'],
        bgGrid: 'rgba(0, 212, 255, 0.02)',
        draw(ctx, cx, cy, r, canvas, arena) {
            // Outer glow
            const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
            glowGrad.addColorStop(0, 'rgba(0, 200, 255, 0)');
            glowGrad.addColorStop(0.5, 'rgba(0, 200, 255, 0.06)');
            glowGrad.addColorStop(1, 'rgba(0, 200, 255, 0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Shadow
            ctx.save();
            ctx.translate(0, 8);
            arena.drawShapePath(ctx, 6);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fill();
            ctx.restore();

            // Outer ring
            ctx.save();
            arena.drawShapePath(ctx, 5);
            const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            ringGrad.addColorStop(0, '#1a2a3a');
            ringGrad.addColorStop(0.3, '#3a5a7a');
            ringGrad.addColorStop(0.5, '#5a8aaa');
            ringGrad.addColorStop(0.7, '#3a5a7a');
            ringGrad.addColorStop(1, '#1a2a3a');
            ctx.fillStyle = ringGrad;
            ctx.fill();
            ctx.restore();

            // Inner ring border
            ctx.save();
            arena.drawShapePath(ctx, 2);
            ctx.strokeStyle = 'rgba(0, 220, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Floor
            ctx.save();
            arena.drawShapePath(ctx, 0);
            const floorGrad = ctx.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r);
            floorGrad.addColorStop(0, '#1a1a2e');
            floorGrad.addColorStop(0.6, '#12122a');
            floorGrad.addColorStop(1, '#0a0a1e');
            ctx.fillStyle = floorGrad;
            ctx.fill();
            ctx.clip();

            // Concentric circles
            for (let i = 1; i <= 5; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, (r / 5) * i, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 180, 255, ${0.06 - i * 0.008})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Cross lines
            ctx.strokeStyle = 'rgba(0, 180, 255, 0.04)';
            ctx.lineWidth = 1;
            for (let angle = 0; angle < Math.PI; angle += Math.PI / 6) {
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                ctx.lineTo(cx - Math.cos(angle) * r, cy - Math.sin(angle) * r);
                ctx.stroke();
            }

            // Center
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 200, 255, 0.1)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();

            // Edge highlight
            ctx.save();
            arena.drawShapePath(ctx, 0);
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    },

    // ─── 2. INFERNO ─────────────────────────────────────
    inferno: {
        name: 'Cehennem Arenası',
        icon: '🔥',
        desc: 'Alev ve lav teması',
        bgColors: ['#1a0a0a', '#0d0502'],
        bgGrid: 'rgba(255, 80, 20, 0.02)',
        draw(ctx, cx, cy, r, canvas, arena) {
            const t = Date.now() * 0.001;
            // Outer glow
            const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
            glowGrad.addColorStop(0, 'rgba(255, 80, 0, 0)');
            glowGrad.addColorStop(0.5, 'rgba(255, 60, 0, 0.08)');
            glowGrad.addColorStop(1, 'rgba(255, 80, 0, 0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Shadow
            ctx.save();
            ctx.translate(0, 8);
            arena.drawShapePath(ctx, 6);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();
            ctx.restore();

            // Outer ring - molten metal
            ctx.save();
            arena.drawShapePath(ctx, 5);
            const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            ringGrad.addColorStop(0, '#3a1500');
            ringGrad.addColorStop(0.3, '#8a3000');
            ringGrad.addColorStop(0.5, '#cc5500');
            ringGrad.addColorStop(0.7, '#8a3000');
            ringGrad.addColorStop(1, '#3a1500');
            ctx.fillStyle = ringGrad;
            ctx.fill();
            ctx.restore();

            // Inner ring - ember glow
            ctx.save();
            arena.drawShapePath(ctx, 2);
            ctx.strokeStyle = `rgba(255, 100, 0, ${0.4 + 0.15 * Math.sin(t * 3)})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();

            // Floor - dark volcanic
            ctx.save();
            arena.drawShapePath(ctx, 0);
            const floorGrad = ctx.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r);
            floorGrad.addColorStop(0, '#2a1008');
            floorGrad.addColorStop(0.5, '#1a0a04');
            floorGrad.addColorStop(1, '#100502');
            ctx.fillStyle = floorGrad;
            ctx.fill();
            ctx.clip();

            // Lava cracks
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 / 8) * i + t * 0.1;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                const endX = cx + Math.cos(a) * r * 0.9;
                const endY = cy + Math.sin(a) * r * 0.9;
                const cpX = cx + Math.cos(a + 0.3) * r * 0.5;
                const cpY = cy + Math.sin(a + 0.3) * r * 0.5;
                ctx.quadraticCurveTo(cpX, cpY, endX, endY);
                ctx.strokeStyle = `rgba(255, 60, 0, ${0.04 + 0.02 * Math.sin(t * 2 + i)})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Concentric rings
            for (let i = 1; i <= 4; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, (r / 4) * i, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 80, 0, ${0.04 - i * 0.005})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Center - ember
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
            const centerPulse = 0.15 + 0.1 * Math.sin(t * 4);
            ctx.fillStyle = `rgba(255, 80, 0, ${centerPulse})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 100, 0, ${centerPulse + 0.1})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Edge
            ctx.save();
            arena.drawShapePath(ctx, 0);
            ctx.strokeStyle = `rgba(255, 80, 0, ${0.15 + 0.05 * Math.sin(t * 2)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    },

    // ─── 3. FROST ────────────────────────────────────────
    frost: {
        name: 'Buz Arenası',
        icon: '❄️',
        desc: 'Buzul ve kristal',
        bgColors: ['#0a1520', '#030a12'],
        bgGrid: 'rgba(100, 200, 255, 0.015)',
        draw(ctx, cx, cy, r, canvas, arena) {
            const t = Date.now() * 0.001;
            // Outer glow
            const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
            glowGrad.addColorStop(0, 'rgba(100, 200, 255, 0)');
            glowGrad.addColorStop(0.5, 'rgba(100, 200, 255, 0.05)');
            glowGrad.addColorStop(1, 'rgba(100, 200, 255, 0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Shadow
            ctx.save();
            ctx.translate(0, 8);
            arena.drawShapePath(ctx, 6);
            ctx.fillStyle = 'rgba(0, 10, 30, 0.4)';
            ctx.fill();
            ctx.restore();

            // Outer ring - frozen metal
            ctx.save();
            arena.drawShapePath(ctx, 5);
            const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            ringGrad.addColorStop(0, '#1a3050');
            ringGrad.addColorStop(0.3, '#3a6090');
            ringGrad.addColorStop(0.5, '#7ab0d0');
            ringGrad.addColorStop(0.7, '#3a6090');
            ringGrad.addColorStop(1, '#1a3050');
            ctx.fillStyle = ringGrad;
            ctx.fill();
            ctx.restore();

            // Inner ring
            ctx.save();
            arena.drawShapePath(ctx, 2);
            ctx.strokeStyle = `rgba(150, 220, 255, ${0.4 + 0.1 * Math.sin(t * 2)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Floor - icy
            ctx.save();
            arena.drawShapePath(ctx, 0);
            const floorGrad = ctx.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r);
            floorGrad.addColorStop(0, '#1a2a3a');
            floorGrad.addColorStop(0.5, '#0f1a28');
            floorGrad.addColorStop(1, '#081018');
            ctx.fillStyle = floorGrad;
            ctx.fill();
            ctx.clip();

            // Ice crystal lines
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
                ctx.strokeStyle = 'rgba(150, 220, 255, 0.06)';
                ctx.lineWidth = 1;
                ctx.stroke();
                // Branches
                const branchDist = r * 0.5;
                const bx = cx + Math.cos(a) * branchDist;
                const by = cy + Math.sin(a) * branchDist;
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx + Math.cos(a + 0.5) * r * 0.25, by + Math.sin(a + 0.5) * r * 0.25);
                ctx.strokeStyle = 'rgba(150, 220, 255, 0.04)';
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx + Math.cos(a - 0.5) * r * 0.25, by + Math.sin(a - 0.5) * r * 0.25);
                ctx.stroke();
            }

            // Concentric
            for (let i = 1; i <= 5; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, (r / 5) * i, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(150, 220, 255, ${0.04 - i * 0.005})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Center - ice crystal
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(150, 220, 255, 0.12)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(200, 240, 255, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();

            // Edge shimmer
            ctx.save();
            arena.drawShapePath(ctx, 0);
            ctx.strokeStyle = `rgba(150, 220, 255, ${0.12 + 0.05 * Math.sin(t * 1.5)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    },

    // ─── 4. VOID ─────────────────────────────────────────
    void: {
        name: 'Karanlık Boşluk',
        icon: '🌑',
        desc: 'Derin uzay teması',
        bgColors: ['#08050f', '#020108'],
        bgGrid: 'rgba(130, 50, 200, 0.015)',
        draw(ctx, cx, cy, r, canvas, arena) {
            const t = Date.now() * 0.001;
            // Outer glow - purple
            const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
            glowGrad.addColorStop(0, 'rgba(100, 0, 200, 0)');
            glowGrad.addColorStop(0.5, 'rgba(100, 0, 200, 0.06)');
            glowGrad.addColorStop(1, 'rgba(100, 0, 200, 0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Shadow
            ctx.save();
            ctx.translate(0, 8);
            arena.drawShapePath(ctx, 6);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();
            ctx.restore();

            // Outer ring - dark purple metal
            ctx.save();
            arena.drawShapePath(ctx, 5);
            const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            ringGrad.addColorStop(0, '#1a0a2e');
            ringGrad.addColorStop(0.3, '#3a1a5e');
            ringGrad.addColorStop(0.5, '#5a2a8e');
            ringGrad.addColorStop(0.7, '#3a1a5e');
            ringGrad.addColorStop(1, '#1a0a2e');
            ctx.fillStyle = ringGrad;
            ctx.fill();
            ctx.restore();

            // Inner ring
            ctx.save();
            arena.drawShapePath(ctx, 2);
            ctx.strokeStyle = `rgba(180, 80, 255, ${0.35 + 0.15 * Math.sin(t * 2)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Floor
            ctx.save();
            arena.drawShapePath(ctx, 0);
            const floorGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            floorGrad.addColorStop(0, '#1a0a2a');
            floorGrad.addColorStop(0.5, '#0f0518');
            floorGrad.addColorStop(1, '#08020e');
            ctx.fillStyle = floorGrad;
            ctx.fill();
            ctx.clip();

            // Void spirals
            ctx.strokeStyle = 'rgba(130, 50, 200, 0.04)';
            ctx.lineWidth = 1;
            for (let s = 0; s < 2; s++) {
                ctx.beginPath();
                for (let a = 0; a < Math.PI * 6; a += 0.1) {
                    const sr = (a / (Math.PI * 6)) * r * 0.9;
                    const sa = a + s * Math.PI + t * 0.3;
                    const sx = cx + Math.cos(sa) * sr;
                    const sy = cy + Math.sin(sa) * sr;
                    if (a === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.stroke();
            }

            // Center - void eye
            const ce = r * 0.1;
            ctx.beginPath();
            ctx.arc(cx, cy, ce, 0, Math.PI * 2);
            const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ce);
            centerGrad.addColorStop(0, 'rgba(180, 80, 255, 0.2)');
            centerGrad.addColorStop(1, 'rgba(100, 0, 200, 0.05)');
            ctx.fillStyle = centerGrad;
            ctx.fill();
            ctx.strokeStyle = 'rgba(180, 80, 255, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();

            // Edge
            ctx.save();
            arena.drawShapePath(ctx, 0);
            ctx.strokeStyle = `rgba(130, 50, 200, ${0.15 + 0.05 * Math.sin(t * 2)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    },

    // ─── 5. GOLDEN ───────────────────────────────────────
    golden: {
        name: 'Altın Arena',
        icon: '👑',
        desc: 'Lüks altın kaplama',
        bgColors: ['#1a1408', '#0d0a03'],
        bgGrid: 'rgba(200, 170, 50, 0.015)',
        draw(ctx, cx, cy, r, canvas, arena) {
            const t = Date.now() * 0.001;
            // Outer glow
            const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
            glowGrad.addColorStop(0, 'rgba(250, 200, 50, 0)');
            glowGrad.addColorStop(0.5, 'rgba(250, 200, 50, 0.05)');
            glowGrad.addColorStop(1, 'rgba(250, 200, 50, 0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Shadow
            ctx.save();
            ctx.translate(0, 8);
            arena.drawShapePath(ctx, 6);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fill();
            ctx.restore();

            // Outer ring - gold metal
            ctx.save();
            arena.drawShapePath(ctx, 5);
            const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            ringGrad.addColorStop(0, '#4a3a10');
            ringGrad.addColorStop(0.25, '#b89030');
            ringGrad.addColorStop(0.5, '#ffd050');
            ringGrad.addColorStop(0.75, '#b89030');
            ringGrad.addColorStop(1, '#4a3a10');
            ctx.fillStyle = ringGrad;
            ctx.fill();
            ctx.restore();

            // Inner ring
            ctx.save();
            arena.drawShapePath(ctx, 2);
            ctx.strokeStyle = `rgba(255, 210, 80, ${0.5 + 0.15 * Math.sin(t * 2)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Floor
            ctx.save();
            arena.drawShapePath(ctx, 0);
            const floorGrad = ctx.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r);
            floorGrad.addColorStop(0, '#2a2010');
            floorGrad.addColorStop(0.6, '#1a1508');
            floorGrad.addColorStop(1, '#100d05');
            ctx.fillStyle = floorGrad;
            ctx.fill();
            ctx.clip();

            // Ornate pattern - concentric + diagonals
            for (let i = 1; i <= 5; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, (r / 5) * i, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(200, 170, 50, ${0.06 - i * 0.008})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            for (let angle = 0; angle < Math.PI; angle += Math.PI / 8) {
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                ctx.lineTo(cx - Math.cos(angle) * r, cy - Math.sin(angle) * r);
                ctx.strokeStyle = 'rgba(200, 170, 50, 0.03)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Center emblem
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 210, 80, 0.1)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 210, 80, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner star
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
                const a2 = a + Math.PI / 5;
                const x1 = cx + Math.cos(a) * r * 0.07;
                const y1 = cy + Math.sin(a) * r * 0.07;
                const x2 = cx + Math.cos(a2) * r * 0.035;
                const y2 = cy + Math.sin(a2) * r * 0.035;
                if (i === 0) ctx.moveTo(x1, y1);
                else ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 210, 80, 0.15)';
            ctx.fill();
            ctx.restore();

            // Edge
            ctx.save();
            arena.drawShapePath(ctx, 0);
            ctx.strokeStyle = `rgba(200, 170, 50, ${0.2 + 0.05 * Math.sin(t * 1.5)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    },

    // ─── 6. EMERALD ──────────────────────────────────────
    emerald: {
        name: 'Zümrüt Arena',
        icon: '💚',
        desc: 'Doğa ve zümrüt',
        bgColors: ['#0a1a0f', '#030d06'],
        bgGrid: 'rgba(50, 200, 100, 0.015)',
        draw(ctx, cx, cy, r, canvas, arena) {
            const t = Date.now() * 0.001;
            // Outer glow
            const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
            glowGrad.addColorStop(0, 'rgba(50, 200, 100, 0)');
            glowGrad.addColorStop(0.5, 'rgba(50, 200, 100, 0.05)');
            glowGrad.addColorStop(1, 'rgba(50, 200, 100, 0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Shadow
            ctx.save();
            ctx.translate(0, 8);
            arena.drawShapePath(ctx, 6);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fill();
            ctx.restore();

            // Outer ring
            ctx.save();
            arena.drawShapePath(ctx, 5);
            const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            ringGrad.addColorStop(0, '#0a2a15');
            ringGrad.addColorStop(0.3, '#1a5a30');
            ringGrad.addColorStop(0.5, '#2a8a50');
            ringGrad.addColorStop(0.7, '#1a5a30');
            ringGrad.addColorStop(1, '#0a2a15');
            ctx.fillStyle = ringGrad;
            ctx.fill();
            ctx.restore();

            // Inner ring
            ctx.save();
            arena.drawShapePath(ctx, 2);
            ctx.strokeStyle = `rgba(80, 255, 130, ${0.35 + 0.1 * Math.sin(t * 2)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Floor
            ctx.save();
            arena.drawShapePath(ctx, 0);
            const floorGrad = ctx.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r);
            floorGrad.addColorStop(0, '#152a1a');
            floorGrad.addColorStop(0.6, '#0d1a10');
            floorGrad.addColorStop(1, '#081008');
            ctx.fillStyle = floorGrad;
            ctx.fill();
            ctx.clip();

            // Hexagonal pattern
            const hexR = r * 0.2;
            for (let row = -3; row <= 3; row++) {
                for (let col = -3; col <= 3; col++) {
                    const hx = cx + col * hexR * 1.73 + (row % 2) * hexR * 0.87;
                    const hy = cy + row * hexR * 1.5;
                    const dist = Math.sqrt((hx - cx) ** 2 + (hy - cy) ** 2);
                    if (dist > r * 0.9) continue;
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const a = (Math.PI / 3) * i;
                        const px = hx + Math.cos(a) * hexR * 0.45;
                        const py = hy + Math.sin(a) * hexR * 0.45;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.strokeStyle = 'rgba(50, 200, 100, 0.04)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            // Center gem
            ctx.beginPath();
            const gemSize = r * 0.08;
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i - Math.PI / 6;
                const gx = cx + Math.cos(a) * gemSize;
                const gy = cy + Math.sin(a) * gemSize;
                if (i === 0) ctx.moveTo(gx, gy);
                else ctx.lineTo(gx, gy);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(50, 200, 100, 0.12)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(80, 255, 130, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();

            // Edge
            ctx.save();
            arena.drawShapePath(ctx, 0);
            ctx.strokeStyle = `rgba(50, 200, 100, ${0.15 + 0.05 * Math.sin(t * 2)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    },

    // ─── 7. BLOOD ────────────────────────────────────────
    blood: {
        name: 'Kan Arenası',
        icon: '🩸',
        desc: 'Karanlık ve kırmızı',
        bgColors: ['#1a0808', '#0d0303'],
        bgGrid: 'rgba(200, 30, 30, 0.015)',
        draw(ctx, cx, cy, r, canvas, arena) {
            const t = Date.now() * 0.001;
            // Outer glow
            const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15);
            glowGrad.addColorStop(0, 'rgba(200, 0, 0, 0)');
            glowGrad.addColorStop(0.5, 'rgba(200, 0, 0, 0.06)');
            glowGrad.addColorStop(1, 'rgba(200, 0, 0, 0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Shadow
            ctx.save();
            ctx.translate(0, 8);
            arena.drawShapePath(ctx, 6);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();
            ctx.restore();

            // Outer ring
            ctx.save();
            arena.drawShapePath(ctx, 5);
            const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            ringGrad.addColorStop(0, '#2a0808');
            ringGrad.addColorStop(0.3, '#5a1515');
            ringGrad.addColorStop(0.5, '#8a2020');
            ringGrad.addColorStop(0.7, '#5a1515');
            ringGrad.addColorStop(1, '#2a0808');
            ctx.fillStyle = ringGrad;
            ctx.fill();
            ctx.restore();

            // Inner ring
            ctx.save();
            arena.drawShapePath(ctx, 2);
            ctx.strokeStyle = `rgba(255, 40, 40, ${0.4 + 0.15 * Math.sin(t * 3)})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();

            // Floor
            ctx.save();
            arena.drawShapePath(ctx, 0);
            const floorGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            floorGrad.addColorStop(0, '#200808');
            floorGrad.addColorStop(0.6, '#140505');
            floorGrad.addColorStop(1, '#0a0202');
            ctx.fillStyle = floorGrad;
            ctx.fill();
            ctx.clip();

            // Slash marks
            for (let i = 0; i < 12; i++) {
                const a = (Math.PI * 2 / 12) * i;
                const startR = r * (0.2 + Math.random() * 0.3);
                const endR = startR + r * 0.3;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * startR, cy + Math.sin(a) * startR);
                ctx.lineTo(cx + Math.cos(a + 0.1) * endR, cy + Math.sin(a + 0.1) * endR);
                ctx.strokeStyle = 'rgba(200, 30, 30, 0.05)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Center
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 0, 0, ${0.15 + 0.08 * Math.sin(t * 4)})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 40, 40, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Edge
            ctx.save();
            arena.drawShapePath(ctx, 0);
            ctx.strokeStyle = `rgba(200, 30, 30, ${0.18 + 0.06 * Math.sin(t * 2.5)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    },

    // ─── 8. GALAXY ───────────────────────────────────────
    galaxy: {
        name: 'Galaksi Arena',
        icon: '🌌',
        desc: 'Kozmik uzay teması',
        bgColors: ['#080510', '#020108'],
        bgGrid: 'rgba(100, 80, 200, 0.012)',
        draw(ctx, cx, cy, r, canvas, arena) {
            const t = Date.now() * 0.001;
            // Outer glow - multi-color
            const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.2);
            glowGrad.addColorStop(0, 'rgba(100, 50, 200, 0)');
            glowGrad.addColorStop(0.4, 'rgba(100, 50, 200, 0.04)');
            glowGrad.addColorStop(0.7, 'rgba(0, 100, 200, 0.03)');
            glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Shadow
            ctx.save();
            ctx.translate(0, 8);
            arena.drawShapePath(ctx, 6);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();
            ctx.restore();

            // Outer ring - nebula
            ctx.save();
            arena.drawShapePath(ctx, 5);
            const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            ringGrad.addColorStop(0, '#1a0a30');
            ringGrad.addColorStop(0.3, '#3a1a60');
            ringGrad.addColorStop(0.5, '#2050a0');
            ringGrad.addColorStop(0.7, '#3a1a60');
            ringGrad.addColorStop(1, '#1a0a30');
            ctx.fillStyle = ringGrad;
            ctx.fill();
            ctx.restore();

            // Inner ring
            ctx.save();
            arena.drawShapePath(ctx, 2);
            const pulse = 0.3 + 0.1 * Math.sin(t * 1.5);
            ctx.strokeStyle = `rgba(150, 100, 255, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Floor
            ctx.save();
            arena.drawShapePath(ctx, 0);
            const floorGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            floorGrad.addColorStop(0, '#150a25');
            floorGrad.addColorStop(0.4, '#0a0518');
            floorGrad.addColorStop(0.8, '#050210');
            floorGrad.addColorStop(1, '#030108');
            ctx.fillStyle = floorGrad;
            ctx.fill();
            ctx.clip();

            // Galaxy spiral
            ctx.lineWidth = 1.5;
            for (let arm = 0; arm < 3; arm++) {
                ctx.beginPath();
                const armOffset = (Math.PI * 2 / 3) * arm;
                for (let a = 0; a < Math.PI * 4; a += 0.08) {
                    const sr = (a / (Math.PI * 4)) * r * 0.85;
                    const sa = a + armOffset + t * 0.2;
                    const sx = cx + Math.cos(sa) * sr;
                    const sy = cy + Math.sin(sa) * sr;
                    if (a === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.strokeStyle = `rgba(150, 100, 255, 0.035)`;
                ctx.stroke();
            }

            // Stars (fixed positions based on seed)
            for (let i = 0; i < 30; i++) {
                const seed = i * 137.508;
                const sa = seed % (Math.PI * 2);
                const sr = (seed * 0.618) % 1 * r * 0.9;
                const sx = cx + Math.cos(sa) * sr;
                const sy = cy + Math.sin(sa) * sr;
                const brightness = 0.15 + 0.1 * Math.sin(t * 2 + i);
                ctx.beginPath();
                ctx.arc(sx, sy, 1, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200, 180, 255, ${brightness})`;
                ctx.fill();
            }

            // Center - black hole
            const bhR = r * 0.1;
            const bhGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bhR);
            bhGrad.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
            bhGrad.addColorStop(0.5, 'rgba(100, 50, 200, 0.1)');
            bhGrad.addColorStop(1, 'rgba(100, 50, 200, 0.02)');
            ctx.beginPath();
            ctx.arc(cx, cy, bhR, 0, Math.PI * 2);
            ctx.fillStyle = bhGrad;
            ctx.fill();

            // Accretion ring
            ctx.beginPath();
            ctx.arc(cx, cy, bhR * 0.7, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(180, 120, 255, ${0.2 + 0.1 * Math.sin(t * 3)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();

            // Edge
            ctx.save();
            arena.drawShapePath(ctx, 0);
            ctx.strokeStyle = `rgba(100, 50, 200, ${0.12 + 0.05 * Math.sin(t * 2)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    }
};

window.Arena = Arena;
