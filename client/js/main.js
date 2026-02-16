// Main entry point
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Beyblade Arena] Initializing...');

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

    // Connect to Socket.IO server
    window.socketManager.connect();

    // Initialize game engine (it handles its own render loop)
    window.game = new Game(canvas);
    resizeCanvas();

    // Initialize settings panel
    window.settingsPanel = new SettingsPanel(window.game.giftConfig);
    window.settingsPanel.show();

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

    console.log('[Beyblade Arena] Ready! 🌀');
});
