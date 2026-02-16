// 2D Physics Engine - Aggressive, action-packed!
class Physics {
    constructor(arena) {
        this.arena = arena;
        this.restitution = 0.85; // Higher bounce factor for aggressive bounces
        this.centerGravity = 120; // Pull toward center (prevents edge camping)
    }

    update(beyblades, dt) {
        // Update each beyblade
        for (const b of beyblades) {
            if (!b.alive) continue;

            // Apply center gravity — pull toward arena center
            const dx = this.arena.centerX - b.x;
            const dy = this.arena.centerY - b.y;
            const distToCenter = Math.sqrt(dx * dx + dy * dy);
            if (distToCenter > 10) {
                // Gravity gets stronger the farther out you are
                const gravityStrength = this.centerGravity * (distToCenter / this.arena.radius);
                b.vx += (dx / distToCenter) * gravityStrength * dt;
                b.vy += (dy / distToCenter) * gravityStrength * dt;
            }

            b.update(dt);
        }

        // Arena wall collision (bounce, no fallout)
        for (const b of beyblades) {
            if (!b.alive) continue;
            this._constrainToArena(b);
        }

        // Beyblade vs Beyblade collisions
        const kills = [];
        for (let i = 0; i < beyblades.length; i++) {
            if (!beyblades[i].alive) continue;
            for (let j = i + 1; j < beyblades.length; j++) {
                if (!beyblades[j].alive) continue;
                const result = this._resolveCollision(beyblades[i], beyblades[j]);
                if (result && result.kills) {
                    kills.push(...result.kills);
                }
            }
        }
        return kills;
    }

    _constrainToArena(b) {
        const result = this.arena.constrainPoint(b.x, b.y, b.radius);
        if (result.bounced) {
            b.x = result.x;
            b.y = result.y;

            // Reflect velocity along normal
            const dot = b.vx * result.normalX + b.vy * result.normalY;
            b.vx = (b.vx - 2 * dot * result.normalX) * this.restitution;
            b.vy = (b.vy - 2 * dot * result.normalY) * this.restitution;

            // Add slight random deflection for natural feel
            b.vx += (Math.random() - 0.5) * 30;
            b.vy += (Math.random() - 0.5) * 30;

            // Wall collision spark + sound
            const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
            if (speed > 60) {
                if (window.effectsManager) {
                    window.effectsManager.spawnCollisionSparks(b.x, b.y, Math.min(1, speed / 400) * 0.4);
                }
                if (window.soundManager) {
                    window.soundManager.playWallHit();
                }
            }
        }
    }

    _resolveCollision(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;

        if (dist >= minDist || dist === 0) return null;

        // Collision detected!
        const nx = dx / dist;
        const ny = dy / dist;

        // Separate overlapping beyblades
        const overlap = minDist - dist;
        const totalMass = a.mass + b.mass;
        a.x -= nx * overlap * (b.mass / totalMass);
        a.y -= ny * overlap * (b.mass / totalMass);
        b.x += nx * overlap * (a.mass / totalMass);
        b.y += ny * overlap * (a.mass / totalMass);

        // Relative velocity
        const dvx = b.vx - a.vx;
        const dvy = b.vy - a.vy;
        const dvDotN = dvx * nx + dvy * ny;

        // Don't resolve if moving apart
        if (dvDotN > 0) return null;

        // Impulse (increased multiplier for harder hits)
        const impulse = -(1 + this.restitution) * dvDotN / totalMass;

        // Apply impulse with extra kick
        const kickMultiplier = 1.3;
        a.vx -= impulse * b.mass * nx * kickMultiplier;
        a.vy -= impulse * b.mass * ny * kickMultiplier;
        b.vx += impulse * a.mass * nx * kickMultiplier;
        b.vy += impulse * a.mass * ny * kickMultiplier;

        // Add spin-based force (faster spin = more chaotic impact)
        const spinForce = (a.spinSpeed + b.spinSpeed) * 3;
        const tangentX = -ny;
        const tangentY = nx;
        a.vx += tangentX * spinForce * 0.5 * (Math.random() - 0.5);
        a.vy += tangentY * spinForce * 0.5 * (Math.random() - 0.5);
        b.vx -= tangentX * spinForce * 0.5 * (Math.random() - 0.5);
        b.vy -= tangentY * spinForce * 0.5 * (Math.random() - 0.5);

        // Calculate and apply damage — each hit = attack stat as flat HP
        const impactSpeed = Math.abs(dvDotN);
        const damageToB = a.attack;
        const damageToA = b.attack;

        const aWasAlive = a.alive;
        const bWasAlive = b.alive;

        const actualDmgB = b.takeDamage(damageToB);
        const actualDmgA = a.takeDamage(damageToA);

        const intensity = Math.min(1, impactSpeed / 250);

        // Collision effects + sounds
        if (window.effectsManager) {
            const collisionX = (a.x + b.x) / 2;
            const collisionY = (a.y + b.y) / 2;
            window.effectsManager.spawnCollisionSparks(collisionX, collisionY, intensity);
        }

        // Sound
        if (window.soundManager) {
            window.soundManager.playCollision(intensity);
        }

        // Screen shake
        if (window.game) {
            window.game.triggerScreenShake(intensity * 6);
        }

        // Track kills
        const kills = [];

        if (!a.alive && aWasAlive) {
            if (window.effectsManager) {
                window.effectsManager.spawnElimination(a.x, a.y, a.radius);
            }
            if (window.soundManager) {
                window.soundManager.playElimination();
            }
            if (window.game) {
                window.game.triggerScreenShake(12);
            }
            kills.push({ killer: b, victim: a });
        }
        if (!b.alive && bWasAlive) {
            if (window.effectsManager) {
                window.effectsManager.spawnElimination(b.x, b.y, b.radius);
            }
            if (window.soundManager) {
                window.soundManager.playElimination();
            }
            if (window.game) {
                window.game.triggerScreenShake(12);
            }
            kills.push({ killer: a, victim: b });
        }

        return { impactSpeed, damageToA: actualDmgA, damageToB: actualDmgB, kills };
    }

    // Give random movement push (aggressive)
    addRandomForce(b, strength) {
        const angle = Math.random() * Math.PI * 2;
        b.vx += Math.cos(angle) * strength;
        b.vy += Math.sin(angle) * strength;
    }

    // Thrust toward nearest enemy
    thrustTowardNearest(b, beyblades, strength) {
        let nearestDist = Infinity;
        let nearestTarget = null;

        for (const other of beyblades) {
            if (other === b || !other.alive) continue;
            const dx = other.x - b.x;
            const dy = other.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestTarget = other;
            }
        }

        if (nearestTarget) {
            const dx = nearestTarget.x - b.x;
            const dy = nearestTarget.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                b.vx += (dx / dist) * strength;
                b.vy += (dy / dist) * strength;
            }
        }
    }
}

window.Physics = Physics;
