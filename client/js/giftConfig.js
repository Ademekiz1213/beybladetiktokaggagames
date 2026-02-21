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
        this.profilePicScale = 0.6;
        this.showProfilePicture = true;
        this.profileBlurAmount = 0;
        this.giftDetectionDelaySeconds = 10;
        this.winnerCountdownSeconds = 10;
        this.defaultShieldDuration = 5;
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
            profilePicScale: this.profilePicScale,
            showProfilePicture: this.showProfilePicture,
            profileBlurAmount: this.profileBlurAmount,
            giftDetectionDelaySeconds: this.giftDetectionDelaySeconds,
            winnerCountdownSeconds: this.winnerCountdownSeconds,
            defaultShieldDuration: this.defaultShieldDuration,
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
        if (data.profilePicScale !== undefined) this.profilePicScale = data.profilePicScale;
        if (data.showProfilePicture !== undefined) this.showProfilePicture = Boolean(data.showProfilePicture);
        if (data.profileBlurAmount !== undefined) this.profileBlurAmount = Math.max(0, Number(data.profileBlurAmount) || 0);
        if (data.giftDetectionDelaySeconds !== undefined) this.giftDetectionDelaySeconds = Math.max(1, Math.floor(Number(data.giftDetectionDelaySeconds) || 10));
        if (data.winnerCountdownSeconds !== undefined) {
            this.winnerCountdownSeconds = Math.max(1, Math.min(120, Math.floor(Number(data.winnerCountdownSeconds) || 10)));
        }
        if (data.defaultShieldDuration !== undefined) this.defaultShieldDuration = data.defaultShieldDuration;
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
