// Game Engine - Main game loop, state management, spawn logic
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Modules
        this.arena = new Arena(canvas);
        this.physics = new Physics(this.arena);
        this.effects = new EffectsManager(this.ctx);
        this.giftConfig = new GiftConfig();
        window.effectsManager = this.effects;

        // Load saved config
        this.giftConfig.load();

        // Apply saved arena theme
        if (this.giftConfig.arenaTheme) {
            this.arena.setTheme(this.giftConfig.arenaTheme);
        }
        // Apply saved arena shape
        if (this.giftConfig.arenaShape) {
            this.arena.setShape(this.giftConfig.arenaShape);
        }

        // Game state
        this.beyblades = [];
        this.state = 'idle'; // idle, battle, countdown, winner
        this.countdownTimer = this._getWinnerCountdownSeconds();
        this.winner = null;
        this.scores = {}; // uniqueId -> kill count
        this.cupScores = {}; // uniqueId -> cup count (round wins)
        this.nicknames = {}; // uniqueId -> nickname
        this.profilePics = {}; // uniqueId -> profilePictureUrl
        this._loadScores(); // Load from localStorage

        // Like accumulators
        this.likeAccumulators = {}; // uniqueId -> count
        this.followJoinHistory = {}; // uniqueId(lowercase) -> last follow reward timestamp
        this.followJoinCooldownMs = 6 * 60 * 60 * 1000; // 6h anti-spam window
        this._loadFollowJoinHistory();

        // Screen shake
        this.screenShake = { x: 0, y: 0, intensity: 0 };

        // Time scale (for slow-motion)
        this.timeScale = 1;
        this._slowMoTimer = 0;

        // Kill feed
        this.killFeed = [];

        // Countdown sound tracker
        this._lastCountdownSec = -1;

        // Winner growth animation
        this._winnerGrowProgress = 0;

        // Timing
        this.lastTime = performance.now();
        this.randomForceTimer = 0;
        this.pendingGiftQueue = [];

        // Bind events
        this._bindTikTokEvents();

        // Start loop
        this._gameLoop();
    }

    // ─── SCREEN SHAKE ──────────────────────────────────
    triggerScreenShake(intensity) {
        this.screenShake.intensity = Math.min(20, Math.max(this.screenShake.intensity, intensity));
    }

    _updateScreenShake(dt) {
        if (this.screenShake.intensity > 0.5) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * 2;
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 2;
            this.screenShake.intensity *= Math.pow(0.05, dt); // fast decay
        } else {
            this.screenShake.x = 0;
            this.screenShake.y = 0;
            this.screenShake.intensity = 0;
        }
    }

    // ─── KILL FEED ─────────────────────────────────────
    addKillFeedEntry(killer, victim) {
        if (killer && killer.uniqueId) {
            const killerId = killer.uniqueId;
            this.scores[killerId] = (this.scores[killerId] || 0) + 1;
            if (killer.nickname) this.nicknames[killerId] = killer.nickname;
            if (killer.profilePictureUrl) this.profilePics[killerId] = killer.profilePictureUrl;
            this._saveScores();
        }

        const entry = {
            killerName: killer.nickname || 'Unknown',
            victimName: victim.nickname || 'Unknown',
            time: Date.now()
        };
        this.killFeed.push(entry);
        // Keep only last 5
        if (this.killFeed.length > 5) this.killFeed.shift();
        // Remove after 4 seconds
        setTimeout(() => {
            const idx = this.killFeed.indexOf(entry);
            if (idx !== -1) this.killFeed.splice(idx, 1);
        }, 4000);
    }

    resize() {
        this.arena.resize();
    }

    _bindTikTokEvents() {
        // Gift event
        window.socketManager.on('tiktok-gift', (data) => {
            this._queueGift(data);
        });

        // Like event
        window.socketManager.on('tiktok-like', (data) => {
            this._handleLike(data);
        });

        // Follow event
        window.socketManager.on('tiktok-follow', (data) => {
            this._handleFollow(data);
        });
    }

    _getGiftDetectionDelayMs() {
        const rawSeconds = Number(this.giftConfig?.giftDetectionDelaySeconds);
        const safeSeconds = Math.max(1, Number.isFinite(rawSeconds) ? Math.floor(rawSeconds) : 10);
        return safeSeconds * 1000;
    }

    _getWinnerCountdownSeconds() {
        const rawSeconds = Number(this.giftConfig?.winnerCountdownSeconds);
        return Math.max(1, Math.min(120, Number.isFinite(rawSeconds) ? Math.floor(rawSeconds) : 10));
    }

    _queueGift(data) {
        if (!data) return;
        const delayedByServer = data.delayAppliedOnServer === true;
        const queueDelayMs = delayedByServer ? 0 : this._getGiftDetectionDelayMs();

        this.pendingGiftQueue.push({
            processAt: Date.now() + queueDelayMs,
            data
        });
    }

    _processQueuedGifts() {
        if (!Array.isArray(this.pendingGiftQueue) || this.pendingGiftQueue.length === 0) return;

        const now = Date.now();
        const remaining = [];
        for (const item of this.pendingGiftQueue) {
            if (!item || !item.data) continue;

            if (Number(item.processAt) <= now) {
                this._handleGift(item.data);
            } else {
                remaining.push(item);
            }
        }

        this.pendingGiftQueue = remaining;
    }

    _resolveGiftRepeatCount(data) {
        const rawRepeatCount = Number(data?.repeatCount);
        if (!Number.isFinite(rawRepeatCount)) return 1;
        return Math.max(1, Math.floor(rawRepeatCount));
    }

    _healBlade(blade, amount) {
        if (!blade || !blade.alive) return 0;

        const healAmount = Math.max(0, Number(amount) || 0);
        if (healAmount <= 0) return 0;

        const beforeHp = blade.hp;
        blade.hp = Math.min(blade.maxHp, blade.hp + healAmount);
        return Math.max(0, Math.round(blade.hp - beforeHp));
    }

    _getSizeLimitState() {
        const enabled = this.giftConfig?.sizeLimitEnabled === true;
        const maxLevel = Math.max(1, Math.min(200, Math.floor(Number(this.giftConfig?.maxSizeLevel) || 10)));
        return { enabled, maxLevel };
    }

    _addSizeWithLimit(blade, amount) {
        if (!blade || !blade.alive) return 0;

        const requested = Math.max(0, Math.floor(Number(amount) || 0));
        if (requested <= 0) return 0;

        const { enabled, maxLevel } = this._getSizeLimitState();
        if (!enabled) {
            blade.addSize(requested);
            return requested;
        }

        const currentLevel = Math.max(1, Math.floor(Number(blade.sizeLevel) || 1));
        const remaining = Math.max(0, maxLevel - currentLevel);
        if (remaining <= 0) return 0;

        const applied = Math.min(requested, remaining);
        blade.addSize(applied);
        return applied;
    }

    _applyRandomLikeBonus(blade, multiples) {
        if (!blade || !blade.alive) return;

        const rolls = Math.max(1, Math.min(20, Math.floor(Number(multiples) || 1)));
        const types = ['hp', 'size', 'attack', 'shield'];

        for (let i = 0; i < rolls; i++) {
            const type = types[Math.floor(Math.random() * types.length)];

            switch (type) {
                case 'hp': {
                    const healUnit = Math.max(1, Number(this.giftConfig.likeHealAmount) || 10);
                    const healed = this._healBlade(blade, healUnit);
                    const label = healed > 0 ? `LIKE HP +${healed}` : 'LIKE HP FULL';
                    this.effects.spawnUpgradeEffect(blade.x, blade.y, label, '#22d67a');
                    break;
                }
                case 'size':
                    if (this._addSizeWithLimit(blade, 1) > 0) {
                        this.effects.spawnUpgradeEffect(blade.x, blade.y, 'LIKE SIZE +1', '#00d4ff');
                    } else {
                        this.effects.spawnUpgradeEffect(blade.x, blade.y, 'SIZE LIMIT', '#94a3b8');
                    }
                    break;
                case 'attack':
                    blade.addAttack(1);
                    this.effects.spawnUpgradeEffect(blade.x, blade.y, 'LIKE ATK +1', '#f43f8e');
                    break;
                case 'shield': {
                    const shieldDur = Math.max(1, Number(this.giftConfig.defaultShieldDuration) || 5);
                    blade.activateShield(shieldDur);
                    this.effects.spawnUpgradeEffect(blade.x, blade.y, `LIKE SHIELD ${shieldDur}s`, '#a855f7');
                    break;
                }
            }
        }
    }

    _applyLikeHealBonus(blade, multiples) {
        if (!blade || !blade.alive) return;

        const healUnit = Math.max(1, Number(this.giftConfig.likeHealAmount) || 10);
        const totalHeal = healUnit * Math.max(1, Math.floor(Number(multiples) || 1));
        const healed = this._healBlade(blade, totalHeal);
        const label = healed > 0 ? `LIKE HP +${healed}` : 'LIKE HP FULL';
        this.effects.spawnUpgradeEffect(blade.x, blade.y, label, '#22d67a');
    }

    _handleGift(data) {
        const giftEffects = this.giftConfig.getGiftEffects(data.giftName);
        const repeatCount = this._resolveGiftRepeatCount(data);
        let activeBlade = this._findBeyblade(data.uniqueId);

        for (const effect of giftEffects.effects) {
            const baseAmount = Math.max(1, Number(effect?.amount) || 1);
            const totalAmount = baseAmount * repeatCount;

            switch (effect.type) {
                case 'spawn':
                    if (activeBlade && activeBlade.alive) {
                        // Already in arena -> spawn gifts heal HP instead of size.
                        const healPerGift = Math.max(1, Number(this.giftConfig.likeHealAmount) || 10);
                        const healed = this._healBlade(activeBlade, healPerGift * totalAmount);
                        const label = healed > 0 ? `HP +${healed}` : 'HP FULL';
                        this.effects.spawnUpgradeEffect(activeBlade.x, activeBlade.y, label, '#22d67a');
                    } else {
                        // Spawn once, then remaining combo spawn gifts heal HP.
                        activeBlade = this._spawnBeyblade(data);
                        if (activeBlade && totalAmount > 1) {
                            const healPerGift = Math.max(1, Number(this.giftConfig.likeHealAmount) || 10);
                            const healed = this._healBlade(activeBlade, healPerGift * (totalAmount - 1));
                            const label = healed > 0 ? `HP +${healed}` : 'HP FULL';
                            this.effects.spawnUpgradeEffect(activeBlade.x, activeBlade.y, label, '#22d67a');
                        }
                    }
                    break;

                case 'size':
                    if (!activeBlade || !activeBlade.alive) {
                        activeBlade = this._spawnBeyblade(data);
                    }
                    if (activeBlade && activeBlade.alive) {
                        const applied = this._addSizeWithLimit(activeBlade, totalAmount);
                        if (applied > 0) {
                            this.effects.spawnUpgradeEffect(activeBlade.x, activeBlade.y, `SIZE +${applied}`, '#00d4ff');
                        } else {
                            this.effects.spawnUpgradeEffect(activeBlade.x, activeBlade.y, 'SIZE LIMIT', '#94a3b8');
                        }
                    }
                    break;

                case 'hp':
                    if (!activeBlade || !activeBlade.alive) {
                        activeBlade = this._spawnBeyblade(data);
                    }
                    if (activeBlade && activeBlade.alive) {
                        const hpWasFull = activeBlade.hp >= (activeBlade.maxHp - 0.001);
                        if (hpWasFull) {
                            activeBlade.increaseMaxHp(totalAmount, true);
                            this.effects.spawnUpgradeEffect(activeBlade.x, activeBlade.y, `MAX HP +${totalAmount}`, '#22d67a');
                        } else {
                            activeBlade.fillHpToMax();
                            this.effects.spawnUpgradeEffect(activeBlade.x, activeBlade.y, 'HP FULL', '#22d67a');

                            // Combo gifts: first gift fills HP, remaining gifts increase max HP.
                            const bonusMaxHp = baseAmount * Math.max(0, repeatCount - 1);
                            if (bonusMaxHp > 0) {
                                activeBlade.increaseMaxHp(bonusMaxHp, true);
                                this.effects.spawnUpgradeEffect(activeBlade.x, activeBlade.y, `MAX HP +${bonusMaxHp}`, '#22d67a');
                            }
                        }
                    }
                    break;

                case 'attack':
                    if (!activeBlade || !activeBlade.alive) {
                        activeBlade = this._spawnBeyblade(data);
                    }
                    if (activeBlade && activeBlade.alive) {
                        activeBlade.addAttack(totalAmount);
                        this.effects.spawnUpgradeEffect(activeBlade.x, activeBlade.y, `ATK +${totalAmount}`, '#f43f8e');
                    }
                    break;

                case 'shield':
                    if (!activeBlade || !activeBlade.alive) {
                        activeBlade = this._spawnBeyblade(data);
                    }
                    if (activeBlade && activeBlade.alive) {
                        const shieldDurPerGift = this.giftConfig.defaultShieldDuration || baseAmount;
                        const totalShieldDur = shieldDurPerGift * repeatCount;
                        activeBlade.activateShield(totalShieldDur);
                        this.effects.spawnUpgradeEffect(activeBlade.x, activeBlade.y, `SHIELD ${totalShieldDur}s`, '#a855f7');
                    }
                    break;
            }
        }

        this._updateGameState();
    }

    _handleLike(data) {
        const key = data.uniqueId;
        if (!this.likeAccumulators[key]) {
            this.likeAccumulators[key] = 0;
        }
        this.likeAccumulators[key] += data.likeCount;

        const threshold = this.giftConfig.likesPerSpawn;
        const existingBlade = this._findBeyblade(key);

        if (this.likeAccumulators[key] >= threshold) {
            // Reset accumulator
            const multiples = Math.floor(this.likeAccumulators[key] / threshold);
            this.likeAccumulators[key] = this.likeAccumulators[key] % threshold;

            if (existingBlade && existingBlade.alive) {
                // Already in arena -> random bonus or only HP by setting.
                if (this.giftConfig.enableRandomLikeBonus === false) {
                    this._applyLikeHealBonus(existingBlade, multiples);
                } else {
                    this._applyRandomLikeBonus(existingBlade, multiples);
                }
            } else {
                // Spawn
                this._spawnBeyblade(data);
            }

            this._updateGameState();
        }
    }

    _handleFollow(data) {
        if (this.giftConfig.followSpawnEnabled === false) {
            return;
        }

        const followKey = this._normalizeFollowKey(data?.uniqueId);
        if (!followKey) return;
        if (!this._consumeFollowJoinReward(followKey)) {
            return;
        }

        // Follow = free spawn (if not already in arena)
        const existingBlade = this._findBeyblade(data.uniqueId);
        if (!existingBlade || !existingBlade.alive) {
            this._spawnBeyblade(data);
            this._updateGameState();
        } else {
            // Give a small HP bonus
            existingBlade.addHp(15);
            this.effects.spawnUpgradeEffect(existingBlade.x, existingBlade.y, 'FOLLOW +15 HP', '#22d67a');
        }
    }

    _normalizeFollowKey(uniqueId) {
        return String(uniqueId || '').trim().toLowerCase();
    }

    _consumeFollowJoinReward(followKey) {
        const now = Date.now();
        this._pruneFollowJoinHistory(now);

        const key = this._normalizeFollowKey(followKey);
        if (!key) return false;

        const previousTs = Number(this.followJoinHistory[key] || 0);
        if (Number.isFinite(previousTs) && previousTs > 0 && (now - previousTs) < this.followJoinCooldownMs) {
            return false;
        }

        this.followJoinHistory[key] = now;

        // Keep map bounded to avoid unlimited growth.
        const entries = Object.entries(this.followJoinHistory);
        if (entries.length > 5000) {
            entries.sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
            this.followJoinHistory = Object.fromEntries(entries.slice(0, 3000));
        }

        this._saveFollowJoinHistory();
        return true;
    }

    _pruneFollowJoinHistory(now = Date.now()) {
        const history = this.followJoinHistory || {};
        const cutoff = now - this.followJoinCooldownMs;
        let changed = false;
        const next = {};

        for (const [key, rawTs] of Object.entries(history)) {
            const normalizedKey = this._normalizeFollowKey(key);
            const ts = Number(rawTs);
            if (!normalizedKey || !Number.isFinite(ts) || ts <= 0) {
                changed = true;
                continue;
            }
            if (ts < cutoff) {
                changed = true;
                continue;
            }
            next[normalizedKey] = ts;
        }

        if (changed) {
            this.followJoinHistory = next;
            this._saveFollowJoinHistory();
        }
    }

    _findBeyblade(uniqueId) {
        return this.beyblades.find(b => b.uniqueId === uniqueId && b.alive);
    }

    _spawnBeyblade(data) {
        // Random position inside arena
        let x, y;
        if (this.arena.shape === 'rectangle') {
            // Random position within 70% of rectangle bounds
            const hw = this.arena.rectW * 0.35;
            const hh = this.arena.rectH * 0.35;
            x = this.arena.centerX + (Math.random() * 2 - 1) * hw;
            y = this.arena.centerY + (Math.random() * 2 - 1) * hh;
        } else {
            const angle = Math.random() * Math.PI * 2;
            const spawnDist = this.arena.radius * 0.7;
            x = this.arena.centerX + Math.cos(angle) * spawnDist;
            y = this.arena.centerY + Math.sin(angle) * spawnDist;
        }

        // Initial velocity toward center — FAST launch!
        const toCenterAngle = Math.atan2(this.arena.centerY - y, this.arena.centerX - x);
        const speed = 250 + Math.random() * 200;
        const vx = Math.cos(toCenterAngle + (Math.random() - 0.5) * 0.6) * speed;
        const vy = Math.sin(toCenterAngle + (Math.random() - 0.5) * 0.6) * speed;

        const blade = new Beyblade({
            userId: data.userId,
            uniqueId: data.uniqueId,
            nickname: data.nickname,
            profilePictureUrl: data.profilePictureUrl,
            x, y, vx, vy
        });

        // Apply default config
        blade.maxHp = this.giftConfig.defaultHp;
        blade.hp = this.giftConfig.defaultHp;
        blade.attack = this.giftConfig.defaultAttack;
        blade.skinId = this.giftConfig.selectedSkin || 'classic';
        if (this.giftConfig.defaultSize > 1) {
            this._addSizeWithLimit(blade, this.giftConfig.defaultSize - 1);
        }

        this.beyblades.push(blade);

        // Track nickname and profile picture for scoreboard
        this.nicknames[data.uniqueId] = data.nickname;
        if (data.profilePictureUrl) this.profilePics[data.uniqueId] = data.profilePictureUrl;
        this._saveScores(); // persist
        this.effects.spawnLight(x, y);

        // Spawn sound
        if (window.soundManager) {
            window.soundManager.playSpawn();
        }

        // Update game state
        if (this.state === 'idle') {
            this.state = 'battle';
        }

        // Reset countdown if in countdown
        if (this.state === 'countdown') {
            this.state = 'battle';
            this.countdownTimer = this._getWinnerCountdownSeconds();
        }

        return blade;
    }

    _updateGameState() {
        const aliveBeyblades = this.beyblades.filter(b => b.alive);
        const aliveCount = aliveBeyblades.length;

        // Update player count UI
        if (window.uiManager) {
            window.uiManager.updatePlayerCount(aliveCount);
        }

        if (this.state === 'battle') {
            if (aliveCount <= 1 && this.beyblades.length > 1) {
                // Son 1 kisi kalinca geri sayim baslasin.
                this.state = 'countdown';
                this.countdownTimer = this._getWinnerCountdownSeconds();
                if (aliveCount === 1) {
                    this.winner = aliveBeyblades[0];
                }
            } else if (aliveCount === 0 && this.beyblades.length > 0) {
                // Everyone died at once?
                this._resetRound();
            }
        }
    }

    _handleCountdown(dt) {
        const aliveBeyblades = this.beyblades.filter(b => b.alive);

        if (aliveBeyblades.length > 1) {
            // New player joined or someone revived → back to battle
            this.state = 'battle';
            this.countdownTimer = this._getWinnerCountdownSeconds();
            this._lastCountdownSec = -1;
            return;
        }

        this.countdownTimer -= dt;

        // Countdown tick sound
        const sec = Math.ceil(this.countdownTimer);
        if (sec !== this._lastCountdownSec && sec > 0 && sec <= 10) {
            this._lastCountdownSec = sec;
            if (window.soundManager) {
                window.soundManager.playCountdownTick(sec <= 3);
            }
        }

        if (this.countdownTimer <= 0) {
            // Winner!
            this.state = 'winner';
            this._winnerGrowProgress = 0;
            this._lastCountdownSec = -1;

            // Trigger slow-motion for the final moment
            this._slowMoTimer = 1.5;

            if (aliveBeyblades.length === 1) {
                this.winner = aliveBeyblades[0];
                // Record cup
                const key = this.winner.uniqueId;
                this.cupScores[key] = (this.cupScores[key] || 0) + 1;
                this._saveScores();
                // Celebration effect
                this.effects.spawnWinnerCelebration(this.winner.x, this.winner.y);
                // Big screen shake
                this.triggerScreenShake(15);
                // Win sound
                if (window.soundManager) {
                    window.soundManager.playWin();
                }
            }

            // Auto reset after 6 seconds (extra time for slow-mo)
            setTimeout(() => this._resetRound(), 6000);
        }
    }

    _resetRound() {
        this.beyblades = [];
        this.state = 'idle';
        this.countdownTimer = this._getWinnerCountdownSeconds();
        this.winner = null;
        this.likeAccumulators = {};
        this.pendingGiftQueue = [];
        this.killFeed = [];
        this.timeScale = 1;
        this._slowMoTimer = 0;
        this._winnerGrowProgress = 0;
        this._lastCountdownSec = -1;
        this.screenShake = { x: 0, y: 0, intensity: 0 };
        this.effects.clear();
        if (window.uiManager) {
            window.uiManager.updatePlayerCount(0);
        }
    }

    _gameLoop() {
        const now = performance.now();
        let dt = Math.min((now - this.lastTime) / 1000, 0.05); // Cap dt
        this.lastTime = now;

        // Apply time scale (slow-motion)
        if (this._slowMoTimer > 0) {
            this._slowMoTimer -= dt;
            this.timeScale = 0.25;
            if (this._slowMoTimer <= 0) {
                this.timeScale = 1;
            }
        }
        const scaledDt = dt * this.timeScale;

        // Apply delayed gift queue (ihlal korumasi)
        this._processQueuedGifts();

        // Update screen shake
        this._updateScreenShake(dt);

        // Clear
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply screen shake transform
        this.ctx.save();
        if (this.screenShake.intensity > 0.5) {
            this.ctx.translate(this.screenShake.x, this.screenShake.y);
        }

        // Draw background
        this._drawBackground();

        // Draw arena
        this.arena.draw();

        // Update physics
        if (this.state === 'battle' || this.state === 'countdown') {
            const aliveBeyblades = this.beyblades.filter(b => b.alive);
            const kills = this.physics.update(aliveBeyblades, scaledDt);

            // Process kills for kill feed
            if (kills && kills.length > 0) {
                for (const kill of kills) {
                    this.addKillFeedEntry(kill.killer, kill.victim);
                }
            }

            // Random chaotic force every 0.8 seconds to keep energy high
            this.randomForceTimer += scaledDt;
            if (this.randomForceTimer > 0.8) {
                this.randomForceTimer = 0;
                for (const b of aliveBeyblades) {
                    // 50% chance: thrust toward nearest enemy
                    // 50% chance: random wild push
                    if (Math.random() < 0.5 && aliveBeyblades.length > 1) {
                        this.physics.thrustTowardNearest(b, aliveBeyblades, 80 + Math.random() * 120);
                    } else {
                        this.physics.addRandomForce(b, 60 + Math.random() * 100);
                    }
                }
            }
        }

        // Handle countdown
        if (this.state === 'countdown') {
            this._handleCountdown(scaledDt);
        }

        // Remove dead beyblades after animation
        this.beyblades = this.beyblades.filter(b => {
            if (!b.alive && b.damageFlash <= 0) return false;
            return true;
        });

        // Update effects
        this.effects.update(scaledDt);

        // Draw beyblades
        for (const b of this.beyblades) {
            b.draw(this.ctx);
        }

        // Draw effects on top
        this.effects.draw();

        // Draw game UI overlays
        this._drawGameUI();

        // Draw kill feed
        this._drawKillFeed();

        // Restore from screen shake
        this.ctx.restore();

        // Update game state
        if (this.state === 'battle') {
            this._updateGameState();
        }

        // Update player panel UI
        if (window.uiManager) {
            window.uiManager.updatePlayerPanel(this.beyblades);
            window.uiManager.updateScoreboard(this.scores, this.cupScores, this.nicknames, this.profilePics);
        }

        requestAnimationFrame(() => this._gameLoop());
    }

    _drawBackground() {
        const theme = Arena.THEMES[this.arena.themeId] || Arena.THEMES.cyber;
        const bgColors = theme.bgColors || ['#0f0f1e', '#050510'];
        const gridColor = theme.bgGrid || 'rgba(0, 212, 255, 0.02)';

        const gradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, Math.max(this.canvas.width, this.canvas.height) / 2
        );
        gradient.addColorStop(0, bgColors[0]);
        gradient.addColorStop(1, bgColors[1]);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle grid
        this.ctx.strokeStyle = gridColor;
        this.ctx.lineWidth = 1;
        const gridSize = 60;
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    _drawGameUI() {
        const ctx = this.ctx;

        // Idle message
        if (this.state === 'idle') {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '16px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Hediye gondererek topunu oyuna cagir!', this.canvas.width / 2, this.canvas.height / 2);
            ctx.restore();
        }

        // Countdown
        if (this.state === 'countdown') {
            const seconds = Math.ceil(this.countdownTimer);
            ctx.save();

            // Countdown circle
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height * 0.12;

            // Background pill
            ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
            ctx.beginPath();
            ctx.roundRect(cx - 120, cy - 25, 240, 50, 25);
            ctx.fill();
            ctx.strokeStyle = seconds <= 3 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(0, 200, 255, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Text
            const textColor = seconds <= 3 ? '#ef4444' : '#00d4ff';
            ctx.fillStyle = textColor;
            ctx.font = 'bold 18px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`🏆 KAZANAN: ${seconds}s`, cx, cy);

            // Pulsing glow for last 3 seconds
            if (seconds <= 3) {
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 15 * pulse;
                ctx.fillText(`🏆 KAZANAN: ${seconds}s`, cx, cy);
                ctx.shadowBlur = 0;
            }

            ctx.restore();
        }

        // Winner - Grand Celebration
        if (this.state === 'winner' && this.winner) {
            ctx.save();
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height * 0.35;
            const t = Date.now() * 0.001;

            // Full-screen dim overlay
            ctx.fillStyle = 'rgba(0, 0, 10, 0.6)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // Spotlight rays
            const rayCount = 12;
            for (let i = 0; i < rayCount; i++) {
                const angle = (Math.PI * 2 / rayCount) * i + t * 0.3;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(-8, 0);
                ctx.lineTo(-2, -300);
                ctx.lineTo(2, -300);
                ctx.lineTo(8, 0);
                ctx.closePath();
                const rayAlpha = 0.03 + 0.02 * Math.sin(t * 2 + i);
                ctx.fillStyle = `rgba(250, 204, 21, ${rayAlpha})`;
                ctx.fill();
                ctx.restore();
            }

            // Glowing circle behind pic
            const glowPulse = 0.6 + 0.4 * Math.sin(t * 3);
            ctx.beginPath();
            ctx.arc(cx, cy, 80, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(250, 204, 21, ${glowPulse * 0.1})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(250, 204, 21, ${glowPulse * 0.6})`;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Golden ring
            ctx.beginPath();
            ctx.arc(cx, cy, 65, 0, Math.PI * 2);
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Winner profile picture
            if (this.winner.profileImage && this.winner.profileImage.complete) {
                const blurPx = Math.max(0, Number(this.giftConfig?.profileBlurAmount) || 0);
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, 58, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                if (blurPx > 0) {
                    ctx.filter = `blur(${blurPx}px)`;
                }
                ctx.drawImage(this.winner.profileImage, cx - 58, cy - 58, 116, 116);
                ctx.restore();
            } else {
                // Fallback circle with initial
                ctx.beginPath();
                ctx.arc(cx, cy, 58, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
                ctx.fill();
                ctx.fillStyle = '#facc15';
                ctx.font = 'bold 40px Orbitron';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.winner.nickname.charAt(0).toUpperCase(), cx, cy);
            }

            // Crown emoji on top
            ctx.font = '36px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('👑', cx, cy - 78);

            // Trophy
            ctx.font = '28px serif';
            ctx.fillText('🏆', cx, cy + 80);

            // Winner name with shadow
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 28px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.winner.nickname, cx, cy + 115);
            ctx.shadowBlur = 0;

            // "KAZANDI!" subtitle
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = 'bold 14px Inter';
            ctx.fillText('🎉 KAZANDI! 🎉', cx, cy + 142);

            // Win count
            const winCount = this.cupScores[this.winner.uniqueId] || 1;
            ctx.fillStyle = 'rgba(250, 204, 21, 0.5)';
            ctx.font = '12px Inter';
            ctx.fillText(`${winCount}. zafer`, cx, cy + 162);

            // Floating sparkle particles
            for (let i = 0; i < 8; i++) {
                const sx = cx + Math.sin(t * 1.5 + i * 0.8) * (100 + i * 15);
                const sy = cy - 60 + Math.cos(t * 2 + i * 1.1) * 40 + i * 10;
                const sparkAlpha = 0.3 + 0.4 * Math.sin(t * 3 + i * 2);
                ctx.fillStyle = `rgba(250, 204, 21, ${sparkAlpha})`;
                ctx.beginPath();
                ctx.arc(sx, sy, 2 + Math.sin(t * 4 + i) * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    // ─── KILL FEED (on-canvas) ─────────────────────
    _drawKillFeed() {
        if (this.killFeed.length === 0) return;
        const ctx = this.ctx;
        const now = Date.now();
        const startX = 15;
        let startY = 60;

        for (let i = 0; i < this.killFeed.length; i++) {
            const entry = this.killFeed[i];
            const age = (now - entry.time) / 1000;

            // Slide in (first 0.3s) and fade out (last 1s)
            let alpha = 1;
            let offsetX = 0;
            if (age < 0.3) {
                offsetX = -(1 - age / 0.3) * 150;
                alpha = age / 0.3;
            } else if (age > 3) {
                alpha = Math.max(0, 1 - (age - 3));
            }

            ctx.save();
            ctx.globalAlpha = alpha;

            const text = `⚔️ ${entry.killerName}`;
            const text2 = ` ▶ ${entry.victimName}`;
            ctx.font = 'bold 12px Inter';
            const w1 = ctx.measureText(text).width;
            const w2 = ctx.measureText(text2).width;
            const totalW = w1 + w2 + 20;

            // Background pill
            const px = startX + offsetX;
            const py = startY + i * 32;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.roundRect(px, py, totalW, 26, 13);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Killer name
            ctx.fillStyle = '#ff6666';
            ctx.font = 'bold 12px Inter';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, px + 10, py + 13);

            // Victim name
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillText(text2, px + 10 + w1, py + 13);

            ctx.restore();
        }
    }

    // Public API for test mode
    testSpawn(nickname) {
        const data = {
            userId: 'test_' + nickname,
            uniqueId: nickname.toLowerCase(),
            nickname: nickname,
            profilePictureUrl: ''
        };
        this._spawnBeyblade(data);
        this._updateGameState();
    }

    testGift(nickname, giftName) {
        const data = {
            userId: 'test_' + nickname,
            uniqueId: nickname.toLowerCase(),
            nickname: nickname,
            profilePictureUrl: '',
            giftName: giftName,
            repeatCount: 1
        };
        this._queueGift(data);
    }

    // ========== SCORE PERSISTENCE ==========
    _saveScores() {
        try {
            localStorage.setItem('beyblade_scores', JSON.stringify(this.scores));
            localStorage.setItem('beyblade_cups', JSON.stringify(this.cupScores));
            localStorage.setItem('beyblade_nicknames', JSON.stringify(this.nicknames));
            localStorage.setItem('beyblade_profilepics', JSON.stringify(this.profilePics));
        } catch (e) { /* ignore */ }
    }

    _loadScores() {
        try {
            const saved = localStorage.getItem('beyblade_scores');
            const cups = localStorage.getItem('beyblade_cups');
            const names = localStorage.getItem('beyblade_nicknames');
            const pics = localStorage.getItem('beyblade_profilepics');
            if (saved) this.scores = JSON.parse(saved);
            if (cups) this.cupScores = JSON.parse(cups);
            if (names) this.nicknames = JSON.parse(names);
            if (pics) this.profilePics = JSON.parse(pics);
        } catch (e) { /* ignore */ }
    }

    _saveFollowJoinHistory() {
        try {
            localStorage.setItem('beyblade_follow_join_history', JSON.stringify(this.followJoinHistory || {}));
        } catch (e) { /* ignore */ }
    }

    _loadFollowJoinHistory() {
        try {
            const saved = localStorage.getItem('beyblade_follow_join_history');
            if (!saved) {
                this.followJoinHistory = {};
                return;
            }

            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                this.followJoinHistory = parsed;
            } else {
                this.followJoinHistory = {};
            }
        } catch (e) {
            this.followJoinHistory = {};
        }

        this._pruneFollowJoinHistory(Date.now());
    }

    adjustScore(uniqueId, delta) {
        const current = this.scores[uniqueId] || 0;
        const newVal = Math.max(0, current + delta);
        if (newVal === 0) {
            delete this.scores[uniqueId];
            delete this.nicknames[uniqueId];
        } else {
            this.scores[uniqueId] = newVal;
        }
        this._saveScores();
    }

    removeActiveBeyblade(uniqueId) {
        const targetId = String(uniqueId || '').trim();
        if (!targetId) return false;

        let removed = false;
        this.beyblades = this.beyblades.filter((blade) => {
            const shouldRemove = blade && blade.alive && String(blade.uniqueId || '') === targetId;
            if (shouldRemove) {
                removed = true;
                return false;
            }
            return true;
        });

        if (!removed) return false;

        delete this.likeAccumulators[targetId];

        if (this.state === 'battle') {
            this._updateGameState();
        } else if (this.state === 'countdown') {
            const aliveBeyblades = this.beyblades.filter((b) => b.alive);
            if (aliveBeyblades.length > 1) {
                this.state = 'battle';
                this.countdownTimer = this._getWinnerCountdownSeconds();
            } else if (aliveBeyblades.length === 0) {
                this._resetRound();
            } else {
                this.winner = aliveBeyblades[0];
            }
        }

        return true;
    }

    resetScores() {
        this.scores = {};
        this.cupScores = {};
        this.nicknames = {};
        this.profilePics = {};
        this._saveScores();
    }
}

window.Game = Game;


