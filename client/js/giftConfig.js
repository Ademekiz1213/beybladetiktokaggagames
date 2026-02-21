// Gift Configuration - Streamer configurable
class GiftConfig {
    constructor() {
        // Default likesPerSpawn
        this.likesPerSpawn = 50;
        this.likeHealAmount = 10;
        this.enableRandomLikeBonus = true;
        this.followSpawnEnabled = true;
        this.defaultHp = 200;
        this.defaultAttack = 10;
        this.defaultSize = 1;
        this.sizeLimitEnabled = false;
        this.maxSizeLevel = 10;
        this.profilePicScale = 0.6;
        this.showProfilePicture = true;
        this.showHpText = true;
        this.hpTextColor = '#ff4d6d';
        this.hpTextSizeScale = 1;
        this.profileBlurAmount = 0;
        this.giftDetectionDelaySeconds = 10;
        this.winnerCountdownSeconds = 10;
        this.defaultShieldDuration = 5;
        this.arenaNotificationsEnabled = true;
        this.notifyOnJoin = true;
        this.notifyOnElimination = true;
        this.arenaNotificationSeconds = 3;
        this.selectedSkin = 'classic';
        this.arenaTheme = 'cyber';
        this.arenaShape = 'circle';

        // Gift effect mappings
        // Each gift has: effects[] where each effect = { type, amount }
        // Types: spawn, size, hp, attack, shield
        this.gifts = {
            'Rose': {
                effects: [{ type: 'spawn', amount: 1 }]
            },
            'GG': {
                effects: [{ type: 'spawn', amount: 1 }]
            },
            'Heart Me': {
                effects: [{ type: 'size', amount: 1 }]
            },
            'Finger Heart': {
                effects: [{ type: 'size', amount: 1 }]
            },
            'Ice Cream Cone': {
                effects: [{ type: 'hp', amount: 20 }]
            },
            'Drama Queen': {
                effects: [{ type: 'hp', amount: 30 }]
            },
            'Perfume': {
                effects: [{ type: 'attack', amount: 5 }]
            },
            'Hand Heart': {
                effects: [{ type: 'shield', amount: 5 }]
            },
            'Hat': {
                effects: [
                    { type: 'size', amount: 3 },
                    { type: 'hp', amount: 50 }
                ]
            },
            'Galaxy': {
                effects: [
                    { type: 'size', amount: 5 },
                    { type: 'hp', amount: 100 },
                    { type: 'attack', amount: 10 },
                    { type: 'shield', amount: 10 }
                ]
            },
            'Universe': {
                effects: [
                    { type: 'size', amount: 10 },
                    { type: 'hp', amount: 200 },
                    { type: 'attack', amount: 20 },
                    { type: 'shield', amount: 20 }
                ]
            }
        };
    }

    getGiftEffects(giftName) {
        return this.gifts[giftName] || { effects: [{ type: 'spawn', amount: 1 }] };
    }

    updateGift(giftName, effects) {
        this.gifts[giftName] = { effects };
    }

    addGift(giftName, effects) {
        this.gifts[giftName] = { effects };
    }

    removeGift(giftName) {
        delete this.gifts[giftName];
    }

    getAllGifts() {
        return Object.keys(this.gifts).map(name => ({
            name,
            effects: this.gifts[name].effects
        }));
    }

    toJSON() {
        return {
            likesPerSpawn: this.likesPerSpawn,
            likeHealAmount: this.likeHealAmount,
            enableRandomLikeBonus: this.enableRandomLikeBonus,
            followSpawnEnabled: this.followSpawnEnabled,
            defaultHp: this.defaultHp,
            defaultAttack: this.defaultAttack,
            defaultSize: this.defaultSize,
            sizeLimitEnabled: this.sizeLimitEnabled,
            maxSizeLevel: this.maxSizeLevel,
            profilePicScale: this.profilePicScale,
            showProfilePicture: this.showProfilePicture,
            showHpText: this.showHpText,
            hpTextColor: this.hpTextColor,
            hpTextSizeScale: this.hpTextSizeScale,
            profileBlurAmount: this.profileBlurAmount,
            giftDetectionDelaySeconds: this.giftDetectionDelaySeconds,
            winnerCountdownSeconds: this.winnerCountdownSeconds,
            defaultShieldDuration: this.defaultShieldDuration,
            arenaNotificationsEnabled: this.arenaNotificationsEnabled,
            notifyOnJoin: this.notifyOnJoin,
            notifyOnElimination: this.notifyOnElimination,
            arenaNotificationSeconds: this.arenaNotificationSeconds,
            selectedSkin: this.selectedSkin,
            arenaTheme: this.arenaTheme,
            arenaShape: this.arenaShape,
            gifts: this.gifts
        };
    }

    fromJSON(data) {
        if (data.likesPerSpawn !== undefined) this.likesPerSpawn = data.likesPerSpawn;
        if (data.likeHealAmount !== undefined) this.likeHealAmount = data.likeHealAmount;
        if (data.enableRandomLikeBonus !== undefined) this.enableRandomLikeBonus = Boolean(data.enableRandomLikeBonus);
        if (data.followSpawnEnabled !== undefined) this.followSpawnEnabled = Boolean(data.followSpawnEnabled);
        if (data.defaultHp !== undefined) this.defaultHp = data.defaultHp;
        if (data.defaultAttack !== undefined) this.defaultAttack = data.defaultAttack;
        if (data.defaultSize !== undefined) this.defaultSize = data.defaultSize;
        if (data.sizeLimitEnabled !== undefined) this.sizeLimitEnabled = Boolean(data.sizeLimitEnabled);
        if (data.maxSizeLevel !== undefined) this.maxSizeLevel = Math.max(1, Math.min(200, Math.floor(Number(data.maxSizeLevel) || 10)));
        if (data.profilePicScale !== undefined) this.profilePicScale = data.profilePicScale;
        if (data.showProfilePicture !== undefined) this.showProfilePicture = Boolean(data.showProfilePicture);
        if (data.showHpText !== undefined) this.showHpText = Boolean(data.showHpText);
        if (data.hpTextColor !== undefined) {
            const normalized = String(data.hpTextColor || '').trim();
            this.hpTextColor = /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : '#ff4d6d';
        }
        if (data.hpTextSizeScale !== undefined) {
            const parsed = Number(data.hpTextSizeScale);
            if (Number.isFinite(parsed)) {
                this.hpTextSizeScale = Math.max(0.6, Math.min(2, parsed));
            }
        }
        if (data.profileBlurAmount !== undefined) this.profileBlurAmount = Math.max(0, Number(data.profileBlurAmount) || 0);
        if (data.giftDetectionDelaySeconds !== undefined) this.giftDetectionDelaySeconds = Math.max(1, Math.floor(Number(data.giftDetectionDelaySeconds) || 10));
        if (data.winnerCountdownSeconds !== undefined) {
            this.winnerCountdownSeconds = Math.max(1, Math.min(120, Math.floor(Number(data.winnerCountdownSeconds) || 10)));
        }
        if (data.defaultShieldDuration !== undefined) this.defaultShieldDuration = data.defaultShieldDuration;
        if (data.arenaNotificationsEnabled !== undefined) this.arenaNotificationsEnabled = Boolean(data.arenaNotificationsEnabled);
        if (data.notifyOnJoin !== undefined) this.notifyOnJoin = Boolean(data.notifyOnJoin);
        if (data.notifyOnElimination !== undefined) this.notifyOnElimination = Boolean(data.notifyOnElimination);
        if (data.arenaNotificationSeconds !== undefined) {
            this.arenaNotificationSeconds = Math.max(1, Math.min(15, Math.floor(Number(data.arenaNotificationSeconds) || 3)));
        }
        if (data.selectedSkin !== undefined) this.selectedSkin = data.selectedSkin;
        if (data.arenaTheme !== undefined) this.arenaTheme = data.arenaTheme;
        if (data.arenaShape !== undefined) this.arenaShape = data.arenaShape;
        if (data.gifts) this.gifts = data.gifts;
    }

    // Save to localStorage
    save() {
        localStorage.setItem('beyblade-gift-config', JSON.stringify(this.toJSON()));
    }

    // Load from localStorage
    load() {
        const saved = localStorage.getItem('beyblade-gift-config');
        if (saved) {
            try {
                this.fromJSON(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load gift config:', e);
            }
        }
    }
}

window.GiftConfig = GiftConfig;
