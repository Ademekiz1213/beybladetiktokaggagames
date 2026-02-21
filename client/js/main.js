// Main entry point
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Spin Arena] Initializing...');

    // Canvas setup
    const canvas = document.getElementById('gameCanvas');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (window.game) {
            window.game.resize();
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Initialize game engine (it handles its own render loop)
    window.game = new Game(canvas);
    resizeCanvas();

    // Initialize settings panel
    window.settingsPanel = new SettingsPanel(window.game.giftConfig);
    window.settingsPanel.show();

    // Initialize UI manager after settings panel so connection controls live inside settings.
    if (window.UIManager) {
        window.uiManager = new window.UIManager();
    }

    function buildAdminRuntimeState() {
        const game = window.game;
        const config = game?.giftConfig;
        if (!game || !config) return null;

        const alivePlayers = Array.isArray(game.beyblades)
            ? game.beyblades.filter((blade) => blade && blade.alive)
            : [];

        const players = alivePlayers
            .slice()
            .sort((a, b) => (Number(b?.hp || 0) - Number(a?.hp || 0)))
            .slice(0, 25)
            .map((blade) => ({
                nickname: String(blade.nickname || '').trim().slice(0, 40),
                uniqueId: String(blade.uniqueId || '').trim().slice(0, 80),
                hp: Math.max(0, Math.floor(Number(blade.hp) || 0)),
                maxHp: Math.max(1, Math.floor(Number(blade.maxHp) || 1)),
                attack: Math.max(0, Math.floor(Number(blade.attack) || 0)),
                sizeLevel: Math.max(1, Math.floor(Number(blade.sizeLevel) || 1))
            }))
            .filter((entry) => entry.nickname && entry.uniqueId);

        return {
            gameState: String(game.state || 'idle'),
            settings: {
                defaultHp: config.defaultHp,
                defaultAttack: config.defaultAttack,
                defaultSize: config.defaultSize,
                profilePicScale: config.profilePicScale,
                showProfilePicture: config.showProfilePicture,
                showHpText: config.showHpText,
                hpTextColor: config.hpTextColor,
                hpTextSizeScale: config.hpTextSizeScale,
                profileBlurAmount: config.profileBlurAmount,
                giftDetectionDelaySeconds: config.giftDetectionDelaySeconds,
                defaultShieldDuration: config.defaultShieldDuration,
                winnerCountdownSeconds: config.winnerCountdownSeconds,
                likesPerSpawn: config.likesPerSpawn,
                likeHealAmount: config.likeHealAmount,
                enableRandomLikeBonus: config.enableRandomLikeBonus,
                followSpawnEnabled: config.followSpawnEnabled,
                arenaNotificationsEnabled: config.arenaNotificationsEnabled,
                notifyOnJoin: config.notifyOnJoin,
                notifyOnElimination: config.notifyOnElimination,
                arenaNotificationSeconds: config.arenaNotificationSeconds,
                selectedSkin: config.selectedSkin,
                arenaTheme: config.arenaTheme,
                arenaShape: config.arenaShape
            },
            activePlayers: {
                aliveCount: alivePlayers.length,
                totalCount: Array.isArray(game.beyblades) ? game.beyblades.length : alivePlayers.length,
                players
            }
        };
    }

    function applyAdminSettingsPatch(rawSettings) {
        if (!rawSettings || typeof rawSettings !== 'object') return;
        if (!window.game || !window.game.giftConfig) return;

        const config = window.game.giftConfig;
        const mergedConfig = {
            ...config.toJSON(),
            ...rawSettings
        };
        config.fromJSON(mergedConfig);
        config.save();

        if (window.socketManager && typeof window.socketManager.setGiftDetectionDelay === 'function') {
            window.socketManager.setGiftDetectionDelay(config.giftDetectionDelaySeconds);
        }

        if (window.game?.arena) {
            window.game.arena.setTheme(config.arenaTheme || 'cyber');
            window.game.arena.setShape(config.arenaShape || 'circle');
        }

        if (Array.isArray(window.game?.beyblades)) {
            window.game.beyblades.forEach((blade) => {
                blade.skinId = config.selectedSkin || 'classic';
            });
        }

        if (window.settingsPanel && typeof window.settingsPanel.syncFormWithConfig === 'function') {
            window.settingsPanel.syncFormWithConfig();
        }
    }

    window.socketManager.setRuntimeStateProvider(buildAdminRuntimeState, 5000);
    window.socketManager.on('admin-apply-settings', (payload) => {
        applyAdminSettingsPatch(payload?.settings);
    });

    // Keep server-side gift delay in sync with local settings.
    window.socketManager.setGiftDetectionDelay(window.game.giftConfig.giftDetectionDelaySeconds);

    // Connect to Socket.IO server after game/ui listeners are ready.
    window.socketManager.connect();

    // Test mode - enhanced with game integration
    const testBtn = document.getElementById('testModeBtn');
    if (testBtn) {
        testBtn.addEventListener('click', () => {
            const testNames = ['Ahmet', 'Mehmet', 'Ayşe', 'Fatma', 'Ali', 'Zeynep', 'Burak', 'Elif'];
            const testGifts = ['Rose', 'GG', 'Heart Me', 'Drama Queen', 'Perfume', 'Hand Heart', 'Hat'];
            const randomName = testNames[Math.floor(Math.random() * testNames.length)];
            const randomGift = testGifts[Math.floor(Math.random() * testGifts.length)];

            // Always spawn via gift
            window.game.testGift(randomName, randomGift);

            // Also add to feed
            if (window.uiManager) {
                window.uiManager._addGiftFeed({
                    nickname: randomName,
                    profilePictureUrl: '',
                    giftName: randomGift,
                    repeatCount: 1
                });
            }
        });
    }

    console.log('[Spin Arena] Ready! 🌀');
});
