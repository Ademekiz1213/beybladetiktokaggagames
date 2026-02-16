// UI Manager
class UIManager {
    constructor() {
        // Elements
        this.usernameInput = document.getElementById('settingsUsernameInput');
        this.connectBtn = document.getElementById('settingsConnectBtn');
        this.connectError = document.getElementById('settingsConnectError');
        this.connectionStateText = document.getElementById('settingsConnectionStateText');
        this.disconnectBtn = document.getElementById('settingsDisconnectBtn');

        this.eventFeed = document.getElementById('eventFeed');
        this.feedList = document.getElementById('feedList');

        this.playerCount = document.getElementById('playerCount');
        this.activeCount = document.getElementById('activeCount');

        this.testModeBtn = document.getElementById('testModeBtn');

        this.maxFeedItems = 30;
        this.eventFeedVisible = true;
        this.connectedStreamers = new Set();
        this.pendingConnections = new Set();

        this._createPlayerPanel();
        this._createScoreboard();
        this._createFeedToggle();
        this._bindEvents();
        this._setDisconnectedState();
    }

    _createPlayerPanel() {
        this.playerPanel = document.createElement('div');
        this.playerPanel.id = 'playerPanel';
        this.playerPanel.className = 'player-panel';
        this.playerPanel.style.display = 'none';
        this.playerPanel.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">⚔️ Aktif Oyuncular</span>
            </div>
            <div id="playerList" class="player-list"></div>
        `;
        document.body.appendChild(this.playerPanel);
        this.playerList = this.playerPanel.querySelector('#playerList');
    }

    _createScoreboard() {
        this.scoreboardPanel = document.createElement('div');
        this.scoreboardPanel.id = 'scoreboardPanel';
        this.scoreboardPanel.className = 'scoreboard-panel';
        this.scoreboardPanel.style.display = 'none';
        this.scoreboardPanel.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">🏆 Arena Fatihleri</span>
            </div>
            <div id="scoreboardList" class="scoreboard-list"></div>
        `;
        document.body.appendChild(this.scoreboardPanel);
        this.scoreboardList = this.scoreboardPanel.querySelector('#scoreboardList');
        this._lastScoreHash = '';

        // Event delegation — one listener handles all +/- clicks permanently
        this.scoreboardList.addEventListener('click', (e) => {
            const btn = e.target.closest('.score-btn');
            if (!btn) return;
            e.stopPropagation();
            const uid = btn.dataset.uid;
            const delta = btn.classList.contains('score-plus') ? 1 : -1;
            if (window.game) {
                window.game.adjustScore(uid, delta);
            }
        });
    }

    _createFeedToggle() {
        this.feedToggleBtn = document.createElement('button');
        this.feedToggleBtn.className = 'btn-feed-toggle';
        this.feedToggleBtn.innerHTML = '📡';
        this.feedToggleBtn.title = 'Canlı Etkinlikleri Aç/Kapat';
        this.feedToggleBtn.style.display = 'none';
        document.body.appendChild(this.feedToggleBtn);

        this.feedToggleBtn.addEventListener('click', () => {
            this.eventFeedVisible = !this.eventFeedVisible;
            this.eventFeed.style.display = this.eventFeedVisible ? 'block' : 'none';
            this.feedToggleBtn.classList.toggle('feed-hidden', !this.eventFeedVisible);
        });
    }

    _bindEvents() {
        // Connect button
        this.connectBtn?.addEventListener('click', () => this._onConnect());

        // Enter key
        this.usernameInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._onConnect();
        });

        // Disconnect button
        this.disconnectBtn?.addEventListener('click', () => {
            window.socketManager.disconnectTikTok();
        });

        // Test mode
        this.testModeBtn?.addEventListener('click', () => this._sendTestEvent());

        // Socket events
        window.socketManager.on('tiktok-status', (data) => this._handleStatus(data));
        window.socketManager.on('tiktok-gift', (data) => this._addGiftFeed(data));
        window.socketManager.on('tiktok-like', (data) => this._addLikeFeed(data));
        window.socketManager.on('tiktok-follow', (data) => this._addFollowFeed(data));
    }

    _onConnect() {
        const usernames = this._parseUsernames(this.usernameInput.value);
        if (usernames.length === 0) {
            this._showError('En az bir yayinci kullanici adi girin');
            return;
        }

        this.pendingConnections = new Set(usernames.map((name) => this._normalizeUsername(name)));
        this._setConnectLoading(true);
        this._hideError();

        window.socketManager.connectTikTokMany(usernames);
    }

    _handleStatus(data) {
        const streamers = Array.isArray(data.connectedUsernames) ? data.connectedUsernames : [];
        this.connectedStreamers = new Set(streamers.map((name) => this._normalizeUsername(name)));

        if (data.username && !data.connecting) {
            this.pendingConnections.delete(this._normalizeUsername(data.username));
        }

        if (data.error) {
            const prefix = data.username ? `@${data.username}: ` : '';
            this._showError(`${prefix}${data.error}`);
        }

        if (this.connectedStreamers.size > 0) {
            this._setConnectedState();
        } else {
            this._setDisconnectedState();
        }

        if (data.connecting) {
            this._updateConnectionStateText('Baglaniyor...');
        }

        if (!data.connecting && this.pendingConnections.size === 0) {
            this._resetConnectBtn();
        }
    }

    _setConnectedState() {
        this.eventFeed.style.display = this.eventFeedVisible ? 'block' : 'none';
        this.playerCount.style.display = 'flex';
        this.testModeBtn.style.display = 'block';
        this.playerPanel.style.display = 'block';
        this.scoreboardPanel.style.display = 'block';
        this.feedToggleBtn.style.display = 'flex';
        if (this.disconnectBtn) {
            this.disconnectBtn.disabled = false;
        }
        this._updateConnectionStateText();
    }

    _setDisconnectedState() {
        this.eventFeed.style.display = 'none';
        this.playerCount.style.display = 'none';
        this.testModeBtn.style.display = 'none';
        this.playerPanel.style.display = 'none';
        this.scoreboardPanel.style.display = 'none';
        this.feedToggleBtn.style.display = 'none';
        if (this.disconnectBtn) {
            this.disconnectBtn.disabled = true;
        }
        this._updateConnectionStateText();
    }

    _updateConnectionStateText(overrideText) {
        if (!this.connectionStateText) return;

        if (overrideText) {
            this.connectionStateText.textContent = overrideText;
            this.connectionStateText.classList.remove('is-connected');
            this.connectionStateText.classList.add('is-pending');
            return;
        }

        if (this.connectedStreamers.size > 0) {
            this.connectionStateText.textContent = `${this.connectedStreamers.size} yayinci bagli`;
            this.connectionStateText.classList.add('is-connected');
            this.connectionStateText.classList.remove('is-pending');
            return;
        }

        this.connectionStateText.textContent = 'Bagli degil';
        this.connectionStateText.classList.remove('is-connected', 'is-pending');
    }

    _setConnectLoading(isLoading) {
        if (!this.connectBtn) return;
        this.connectBtn.disabled = isLoading;
        const textEl = this.connectBtn.querySelector('.btn-text');
        const loaderEl = this.connectBtn.querySelector('.btn-loader');
        if (textEl) {
            textEl.style.display = isLoading ? 'none' : 'inline';
        }
        if (loaderEl) {
            loaderEl.style.display = isLoading ? 'inline' : 'none';
        }
    }

    _resetConnectBtn() {
        this._setConnectLoading(false);
    }

    _showError(message) {
        this.connectError.textContent = message;
        this.connectError.style.display = 'block';
    }

    _hideError() {
        this.connectError.style.display = 'none';
    }

    _normalizeUsername(username) {
        return String(username || '').trim().replace(/^@+/, '').toLowerCase();
    }

    _parseUsernames(rawValue) {
        if (!rawValue) return [];

        const seen = new Set();
        const usernames = [];

        for (const token of rawValue.split(/[,\s]+/)) {
            const normalized = this._normalizeUsername(token);
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            usernames.push(normalized);
        }

        return usernames;
    }

    // Feed methods
    _addFeedItem(avatarUrl, name, actionHtml) {
        if (!this.eventFeedVisible) return; // Skip if feed hidden
        const item = document.createElement('div');
        item.className = 'feed-item';
        item.innerHTML = `
            <img class="feed-item-avatar" src="${avatarUrl || ''}" alt=""
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23333%22 width=%2240%22 height=%2240%22/><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2218%22>?</text></svg>'">
            <div class="feed-item-content">
                <div class="feed-item-name">${this._escapeHtml(name)}</div>
                <div class="feed-item-action">${actionHtml}</div>
            </div>
        `;

        // Insert at top
        this.feedList.insertBefore(item, this.feedList.firstChild);

        // Limit items
        while (this.feedList.children.length > this.maxFeedItems) {
            this.feedList.removeChild(this.feedList.lastChild);
        }
    }

    _addGiftFeed(data) {
        const count = data.repeatCount > 1 ? ` x${data.repeatCount}` : '';
        this._addFeedItem(
            data.profilePictureUrl,
            data.nickname,
            `${this._streamerBadge(data)} ğŸ <span class="gift-name">${this._escapeHtml(data.giftName)}${count}</span>`
        );
    }

    _addLikeFeed(data) {
        this._addFeedItem(
            data.profilePictureUrl,
            data.nickname,
            `${this._streamerBadge(data)} <span class="like-action">â¤ï¸ ${data.likeCount} begeni</span> (toplam: ${data.accumulatedLikes})`
        );
    }

    _addFollowFeed(data) {
        this._addFeedItem(
            data.profilePictureUrl,
            data.nickname,
            `${this._streamerBadge(data)} <span class="follow-action">âœ… Takip etti!</span>`
        );
    }

    updatePlayerCount(count) {
        if (this.activeCount) {
            this.activeCount.textContent = count;
        }
    }

    // Update player stats panel — called from game loop
    updatePlayerPanel(beyblades) {
        if (!this.playerList) return;

        const alive = beyblades.filter(b => b.alive);

        // Sort by HP descending
        alive.sort((a, b) => b.hp - a.hp);

        // Build HTML
        let html = '';
        for (const b of alive) {
            const hpPercent = Math.max(0, Math.min(100, (b.hp / b.maxHp) * 100));
            let hpColor;
            if (hpPercent > 60) hpColor = '#22d67a';
            else if (hpPercent > 30) hpColor = '#facc15';
            else hpColor = '#ef4444';

            const shieldHtml = b.shieldActive
                ? `<div class="player-shield-bar">
                       <span class="shield-label">🛡️ ${Math.ceil(b.shieldTimer)}s</span>
                       <div class="shield-timer-bg">
                           <div class="shield-timer-fill" style="width:${(b.shieldTimer / b.shieldDuration) * 100}%"></div>
                       </div>
                   </div>`
                : '';

            const rowClass = b.shieldActive ? 'player-row shielded' : 'player-row';

            html += `
                <div class="${rowClass}">
                    <div class="player-info">
                        <img class="player-avatar" src="${b.profilePictureUrl || ''}" alt=""
                             onerror="this.style.display='none'">
                        <span class="player-name">${this._escapeHtml(b.nickname)}</span>
                    </div>
                    <div class="player-stats">
                        <span class="stat-attack">⚔️${b.attack}</span>
                        <span class="stat-hp" style="color:${hpColor}">${Math.ceil(b.hp)}/${b.maxHp}</span>
                    </div>
                    <div class="player-hp-bar">
                        <div class="player-hp-fill" style="width:${hpPercent}%;background:${hpColor}"></div>
                    </div>
                    ${shieldHtml}
                </div>
            `;
        }

        if (alive.length === 0) {
            html = '<div class="player-empty">Aktif oyuncu yok</div>';
        }

        this.playerList.innerHTML = html;
    }

    // Update scoreboard — called from game loop
    updateScoreboard(scores, nicknames, profilePics) {
        if (!this.scoreboardList) return;
        profilePics = profilePics || {};

        // Dirty check — only update DOM when data actually changes
        const hash = JSON.stringify(scores);
        if (hash === this._lastScoreHash) {
            return;
        }
        this._lastScoreHash = hash;

        // Convert to sorted array
        const entries = Object.entries(scores)
            .map(([id, wins]) => ({ id, wins, name: nicknames[id] || id, pic: profilePics[id] || '' }))
            .sort((a, b) => b.wins - a.wins);

        if (entries.length === 0) {
            this.scoreboardList.innerHTML = '<div class="player-empty">Henüz kazanan yok</div>';
            return;
        }

        let html = '';
        entries.forEach((entry, idx) => {
            let rankIcon;
            if (idx === 0) rankIcon = '👑';
            else if (idx === 1) rankIcon = '🥈';
            else if (idx === 2) rankIcon = '🥉';
            else rankIcon = `${idx + 1}.`;

            const avatarHtml = entry.pic
                ? `<img class="score-avatar" src="${entry.pic}" alt="" onerror="this.style.display='none'">`
                : `<span class="score-avatar score-avatar-placeholder">👤</span>`;

            html += `
                <div class="score-row ${idx === 0 ? 'score-champion' : ''}">
                    <span class="score-rank">${rankIcon}</span>
                    ${avatarHtml}
                    <span class="score-name">${this._escapeHtml(entry.name)}</span>
                    <span class="score-controls">
                        <button class="score-btn score-minus" data-uid="${entry.id}" title="Azalt">−</button>
                        <span class="score-wins">${entry.wins}🏆</span>
                        <button class="score-btn score-plus" data-uid="${entry.id}" title="Arttır">+</button>
                    </span>
                </div>
            `;
        });

        this.scoreboardList.innerHTML = html;

        // Event listeners handled by delegation in _createScoreboard
    }

    // Open Arena Fatihleri in separate browser window
    openScoreboardPopup() {
        if (this._popupWindow && !this._popupWindow.closed) {
            this._popupWindow.focus();
            return;
        }

        this._popupWindow = window.open('', 'ArenaFatihleri', 'width=420,height=600,resizable=yes,scrollbars=yes');
        if (!this._popupWindow) return;

        const doc = this._popupWindow.document;
        doc.write(`<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>🏆 Arena Fatihleri</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0a1a, #1a1040, #0a1a2a);
            color: #e0e0ff;
            min-height: 100vh;
            padding: 24px;
        }
        h1 {
            text-align: center;
            font-size: 22px;
            margin-bottom: 24px;
            color: #00d4ff;
            text-shadow: 0 0 20px rgba(0,212,255,0.3);
        }
        .score-row {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            margin-bottom: 6px;
            background: rgba(255,255,255,0.04);
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.06);
            transition: background 0.2s;
        }
        .score-row:hover { background: rgba(255,255,255,0.08); }
        .score-champion {
            background: rgba(250,200,50,0.08) !important;
            border-color: rgba(250,200,50,0.2) !important;
        }
        .score-rank { font-size: 18px; width: 36px; text-align: center; flex-shrink: 0; }
        .score-avatar {
            width: 28px; height: 28px; border-radius: 50%; object-fit: cover;
            flex-shrink: 0; margin-right: 8px;
            border: 2px solid rgba(255,255,255,0.1);
        }
        .score-avatar-placeholder {
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; background: rgba(255,255,255,0.06);
        }
        .score-name { flex: 1; font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .score-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .score-wins { font-size: 14px; font-weight: 700; min-width: 40px; text-align: center; }
        .score-btn {
            width: 30px; height: 30px; border: none; border-radius: 50%;
            background: rgba(255,255,255,0.08); color: #ccc; font-size: 18px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: all 0.15s;
            opacity: 0; pointer-events: none;
        }
        .score-row:hover .score-btn { opacity: 1; pointer-events: auto; }
        .score-btn:hover { background: rgba(0,212,255,0.2); color: #00d4ff; transform: scale(1.15); }
        .score-minus:hover { background: rgba(255,80,80,0.2); color: #ff5555; }
        .empty { text-align: center; color: rgba(255,255,255,0.3); padding: 40px 0; font-size: 14px; }
        .auto-update { text-align: center; font-size: 10px; color: rgba(255,255,255,0.15); margin-top: 24px; }
    </style>
</head>
<body>
    <h1>🏆 Arena Fatihleri</h1>
    <div id="popupList"><div class="empty">Henüz kazanan yok</div></div>
    <div class="auto-update">Otomatik güncellenir</div>
    <script>
        var lastHash = '';

        function adjustScore(uid, delta) {
            try {
                if (window.opener && window.opener.game) {
                    window.opener.game.adjustScore(uid, delta);
                    refresh();
                }
            } catch(e) {}
        }

        function refresh() {
            try {
                if (!window.opener || !window.opener.game) return;
                var game = window.opener.game;
                var scores = game.scores;
                var nicknames = game.nicknames;
                var pics = game.profilePics || {};
                var hash = JSON.stringify(scores);
                if (hash === lastHash) return;
                lastHash = hash;

                var container = document.getElementById('popupList');
                var keys = Object.keys(scores);
                var entries = [];
                for (var i = 0; i < keys.length; i++) {
                    entries.push({ id: keys[i], wins: scores[keys[i]], name: nicknames[keys[i]] || keys[i], pic: pics[keys[i]] || '' });
                }
                entries.sort(function(a, b) { return b.wins - a.wins; });

                if (entries.length === 0) {
                    container.innerHTML = '<div class="empty">Hen\\u00fcz kazanan yok</div>';
                    return;
                }

                var icons = ['\\ud83d\\udc51', '\\ud83e\\udd48', '\\ud83e\\udd49'];
                var html = '';
                for (var j = 0; j < entries.length; j++) {
                    var entry = entries[j];
                    var rankIcon = j < 3 ? icons[j] : (j + 1) + '.';
                    var champClass = j === 0 ? ' score-champion' : '';
                    var avatarHtml = entry.pic
                        ? '<img class="score-avatar" src="' + entry.pic + '" alt="" onerror="this.style.display=\\'none\\'">'
                        : '<span class="score-avatar score-avatar-placeholder">\\ud83d\\udc64</span>';
                    html += '<div class="score-row' + champClass + '">';
                    html += '<span class="score-rank">' + rankIcon + '</span>';
                    html += avatarHtml;
                    html += '<span class="score-name">' + entry.name + '</span>';
                    html += '<span class="score-controls">';
                    html += '<button class="score-btn score-minus" data-uid="' + entry.id + '">\\u2212</button>';
                    html += '<span class="score-wins">' + entry.wins + '\\ud83c\\udfc6</span>';
                    html += '<button class="score-btn score-plus" data-uid="' + entry.id + '">+</button>';
                    html += '</span></div>';
                }
                container.innerHTML = html;
            } catch(e) {}
        }

        // Event delegation for +/- buttons
        document.getElementById('popupList').addEventListener('click', function(e) {
            var btn = e.target;
            if (!btn.classList.contains('score-btn')) return;
            var uid = btn.getAttribute('data-uid');
            var delta = btn.classList.contains('score-plus') ? 1 : -1;
            adjustScore(uid, delta);
        });

        setInterval(refresh, 500);
        refresh();
    </script>
</body>
</html>`);
        doc.close();
    }

    // Test mode - fake events
    _sendTestEvent() {
        const testNames = ['TestUser1', 'TestUser2', 'TestUser3', 'BeybladeKing', 'SpinMaster'];
        const testGifts = ['Rose', 'Heart Me', 'Drama Queen', 'Perfume', 'Hand Heart', 'Hat'];
        const randomName = testNames[Math.floor(Math.random() * testNames.length)];

        const rand = Math.random();
        if (rand < 0.5) {
            // Test gift
            const giftName = testGifts[Math.floor(Math.random() * testGifts.length)];
            const fakeGift = {
                userId: 'test_' + randomName,
                uniqueId: randomName.toLowerCase(),
                nickname: randomName,
                profilePictureUrl: '',
                giftName: giftName,
                diamondCount: Math.floor(Math.random() * 100),
                repeatCount: 1,
                giftType: 0
            };
            window.socketManager._trigger('tiktok-gift', fakeGift);
        } else {
            // Test like
            const likeCount = Math.floor(Math.random() * 15) + 1;
            const fakeLike = {
                userId: 'test_' + randomName,
                uniqueId: randomName.toLowerCase(),
                nickname: randomName,
                profilePictureUrl: '',
                likeCount: likeCount,
                totalLikes: likeCount * 10,
                accumulatedLikes: likeCount * 5
            };
            window.socketManager._trigger('tiktok-like', fakeLike);
        }
    }

    _streamerBadge(data) {
        if (!data || !data.streamerUsername) return '';
        return `<span class="streamer-tag">@${this._escapeHtml(data.streamerUsername)}</span>`;
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.UIManager = UIManager;

