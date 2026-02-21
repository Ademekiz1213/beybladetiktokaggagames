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
        this.joinToggleBtn = document.getElementById('joinToggleBtn');

        this.maxFeedItems = 30;
        this.eventFeedVisible = true;
        this.connectedStreamers = new Set();
        this.pendingConnections = new Set();

        this._createPlayerPanel();
        this._createScoreboard();
        this._createFeedToggle();
        this._createArenaNoticeLayer();
        this._createAnnouncementBanner();
        this._createStartupAnnouncementModal();
        this._bindEvents();
        this._setDisconnectedState();

        window.addEventListener('auth-ready', () => this._checkStartupAnnouncement());
        this._checkStartupAnnouncement();
    }

    _createPlayerPanel() {
        this.playerPanel = document.createElement('div');
        this.playerPanel.id = 'playerPanel';
        this.playerPanel.className = 'player-panel';
        this.playerPanel.style.display = 'none';
        this.playerPanel.innerHTML = `
            <div class="panel-header player-panel-header">
                <span class="panel-title">⚔️ Aktif Oyuncular</span>
                <button id="openPlayersPanelBtn" class="panel-open-btn" type="button" title="Ayrı pencerede aç">↗</button>
            </div>
            <div id="playerList" class="player-list"></div>
        `;
        document.body.appendChild(this.playerPanel);
        this.playerPanelOpenBtn = this.playerPanel.querySelector('#openPlayersPanelBtn');
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

    _createArenaNoticeLayer() {
        this.arenaNoticeLayer = document.createElement('div');
        this.arenaNoticeLayer.className = 'arena-notice-layer';
        document.body.appendChild(this.arenaNoticeLayer);
    }

    _createAnnouncementBanner() {
        this.announcementBanner = document.createElement('div');
        this.announcementBanner.className = 'admin-announcement-banner';
        this.announcementBanner.innerHTML = `
            <div class="announcement-title">DUYURU</div>
            <div class="announcement-text"></div>
        `;
        document.body.appendChild(this.announcementBanner);
        this.announcementHideTimer = null;
    }

    _createStartupAnnouncementModal() {
        this.startupAnnouncementOverlay = document.createElement('div');
        this.startupAnnouncementOverlay.className = 'startup-announcement-overlay';
        this.startupAnnouncementOverlay.style.display = 'none';
        this.startupAnnouncementOverlay.innerHTML = `
            <div class="startup-announcement-panel">
                <div class="startup-announcement-header">
                    <h3 id="startupAnnouncementTitleText">📢 Duyuru</h3>
                    <button id="startupAnnouncementCloseBtn" type="button" class="startup-announcement-close">✕</button>
                </div>
                <div id="startupAnnouncementMessageText" class="startup-announcement-message"></div>
                <div id="startupAnnouncementMetaText" class="startup-announcement-meta"></div>
            </div>
        `;
        document.body.appendChild(this.startupAnnouncementOverlay);
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
        this.joinToggleBtn?.addEventListener('click', () => this._toggleNewEntrants());
        this.playerPanelOpenBtn?.addEventListener('click', () => this.openActivePlayersPopup());
        this.startupAnnouncementOverlay?.querySelector('#startupAnnouncementCloseBtn')?.addEventListener('click', () => {
            this._dismissStartupAnnouncement();
        });
        this.playerList?.addEventListener('click', (event) => {
            const button = event.target.closest('.player-delete-btn');
            if (!button) return;

            event.preventDefault();
            event.stopPropagation();

            const uniqueId = String(button.dataset.playerId || '').trim();
            const nickname = String(button.dataset.playerName || '').trim();
            if (!uniqueId || !window.game || typeof window.game.removeActiveBeyblade !== 'function') {
                return;
            }

            const removed = window.game.removeActiveBeyblade(uniqueId);
            if (!removed) return;

            this._addFeedItem('', 'Moderatör', `<span class="follow-action">🗑️ ${this._escapeHtml(nickname || uniqueId)} arenadan silindi</span>`);
        });

        // Socket events
        window.socketManager.on('tiktok-status', (data) => this._handleStatus(data));
        window.socketManager.on('tiktok-gift', (data) => this._addGiftFeed(data));
        window.socketManager.on('tiktok-like', (data) => this._addLikeFeed(data));
        window.socketManager.on('tiktok-follow', (data) => this._addFollowFeed(data));
        window.socketManager.on('admin-announcement', (data) => this._handleAdminAnnouncement(data));
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
        if (this.joinToggleBtn) {
            this.joinToggleBtn.style.display = 'block';
        }
        this.playerPanel.style.display = 'block';
        this.scoreboardPanel.style.display = 'block';
        this.feedToggleBtn.style.display = 'flex';
        if (this.disconnectBtn) {
            this.disconnectBtn.disabled = false;
        }
        this._syncJoinToggleBtn();
        this._updateConnectionStateText();
    }

    _setDisconnectedState() {
        this.eventFeed.style.display = 'none';
        this.playerCount.style.display = 'none';
        this.testModeBtn.style.display = 'none';
        if (this.joinToggleBtn) {
            this.joinToggleBtn.style.display = 'none';
        }
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

    _toggleNewEntrants() {
        if (!window.game || typeof window.game.setNewEntrantsEnabled !== 'function') return;

        const current = typeof window.game.isNewEntrantsEnabled === 'function'
            ? window.game.isNewEntrantsEnabled()
            : true;
        const next = !current;
        window.game.setNewEntrantsEnabled(next);
        this._syncJoinToggleBtn();

        const message = next
            ? '🟢 Arenaya yeni beyblade girisi acildi'
            : '⛔ Arenaya yeni beyblade girisi kapatildi';
        this._addFeedItem('', 'Sistem', `<span class="follow-action">${message}</span>`);
    }

    _syncJoinToggleBtn() {
        if (!this.joinToggleBtn) return;

        const enabled = !window.game || typeof window.game.isNewEntrantsEnabled !== 'function'
            ? true
            : window.game.isNewEntrantsEnabled();

        this.joinToggleBtn.textContent = enabled ? '🟢 Giris Acik' : '⛔ Giris Kapali';
        this.joinToggleBtn.title = enabled
            ? 'Yeni beyblade girisini kapat'
            : 'Yeni beyblade girisini ac';
        this.joinToggleBtn.classList.toggle('is-closed', !enabled);
    }

    _getArenaNoticeConfig() {
        const config = window.game?.giftConfig;
        const enabled = !config || config.arenaNotificationsEnabled !== false;
        const notifyJoin = !config || config.notifyOnJoin !== false;
        const notifyElimination = !config || config.notifyOnElimination !== false;
        const seconds = Math.max(1, Math.min(15, Math.floor(Number(config?.arenaNotificationSeconds) || 3)));
        return { enabled, notifyJoin, notifyElimination, seconds };
    }

    _showArenaNotice(message, tone = 'neutral') {
        const text = String(message || '').trim();
        if (!text || !this.arenaNoticeLayer) return;

        const item = document.createElement('div');
        item.className = `arena-notice ${tone === 'join' ? 'is-join' : tone === 'elimination' ? 'is-elimination' : ''}`;
        item.textContent = text;
        this.arenaNoticeLayer.appendChild(item);

        while (this.arenaNoticeLayer.children.length > 4) {
            this.arenaNoticeLayer.removeChild(this.arenaNoticeLayer.firstChild);
        }

        requestAnimationFrame(() => {
            item.classList.add('is-visible');
        });

        const { seconds } = this._getArenaNoticeConfig();
        window.setTimeout(() => {
            item.classList.remove('is-visible');
            item.classList.add('is-hiding');
            window.setTimeout(() => {
                item.remove();
            }, 260);
        }, seconds * 1000);
    }

    showJoinNotification(nickname) {
        const { enabled, notifyJoin } = this._getArenaNoticeConfig();
        if (!enabled || !notifyJoin) return;

        const name = String(nickname || '').trim() || 'Bir oyuncu';
        this._showArenaNotice(`🟢 ${name} arenaya katildi`, 'join');
    }

    showEliminationNotification(killerName, victimName) {
        const { enabled, notifyElimination } = this._getArenaNoticeConfig();
        if (!enabled || !notifyElimination) return;

        const killer = String(killerName || '').trim() || 'Bir oyuncu';
        const victim = String(victimName || '').trim() || 'rakibini';
        this._showArenaNotice(`⚔️ ${killer}, ${victim} eledi`, 'elimination');
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
        const giftImageHtml = this._giftFeedImageHtml(data);
        this._addFeedItem(
            data.profilePictureUrl,
            data.nickname,
            `${this._streamerBadge(data)} ${giftImageHtml}<span class="gift-name">${this._escapeHtml(data.giftName)}${count}</span>`
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

    _handleAdminAnnouncement(data) {
        const message = String(data?.message || '').trim();
        if (!message) return;

        const sentBy = String(data?.sentByName || data?.sentBy || 'admin').trim();
        const createdAt = data?.createdAt ? new Date(data.createdAt) : null;
        const timeLabel = createdAt && Number.isFinite(createdAt.getTime())
            ? createdAt.toLocaleTimeString()
            : '';

        this._showAnnouncementBanner(message, sentBy, timeLabel);
        this._addFeedItem(
            '',
            'Yonetici Duyurusu',
            `<span class="follow-action">📢 ${this._escapeHtml(message)}</span>`
        );
    }

    _showAnnouncementBanner(message, sentBy, timeLabel) {
        if (!this.announcementBanner) return;

        const titleEl = this.announcementBanner.querySelector('.announcement-title');
        const textEl = this.announcementBanner.querySelector('.announcement-text');
        if (!titleEl || !textEl) return;

        const metaParts = ['DUYURU'];
        if (sentBy) metaParts.push(sentBy);
        if (timeLabel) metaParts.push(timeLabel);

        titleEl.textContent = metaParts.join(' • ');
        textEl.textContent = message;
        this.announcementBanner.classList.add('show');

        if (this.announcementHideTimer) {
            window.clearTimeout(this.announcementHideTimer);
        }

        this.announcementHideTimer = window.setTimeout(() => {
            this.announcementBanner.classList.remove('show');
        }, 9000);
    }

    async _buildAuthHeaders(user) {
        const headers = {};

        if (user?.email) {
            headers['x-user-email'] = user.email;
        }
        if (user?.uid) {
            headers['x-user-uid'] = user.uid;
        }

        try {
            const token = await user.getIdToken(false);
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.warn('[UI] Could not load Firebase token for startup announcement:', error);
        }

        return headers;
    }

    _resolveSessionUserKey(user) {
        const email = String(user?.email || '').trim().toLowerCase();
        if (email) return `email:${email}`;

        const uid = String(user?.uid || '').trim();
        if (uid) return `uid:${uid}`;

        return '';
    }

    _getStartupAnnouncementSeenStorageKey(userKey) {
        return `beyblade_startup_announcement_seen_${userKey}`;
    }

    async _checkStartupAnnouncement() {
        const user = window.authSession?.user;
        if (!user || this._startupAnnouncementLoading) return;

        const userKey = this._resolveSessionUserKey(user);
        if (!userKey) return;

        this._startupAnnouncementLoading = true;
        try {
            const response = await fetch('/api/startup-announcement', {
                method: 'GET',
                headers: await this._buildAuthHeaders(user)
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.ok === false) {
                return;
            }

            const announcement = payload?.announcement;
            if (!announcement || !announcement.id || !announcement.message) {
                this.startupAnnouncementOverlay.style.display = 'none';
                return;
            }

            const seenKey = this._getStartupAnnouncementSeenStorageKey(userKey);
            let seenAnnouncementId = '';
            try {
                seenAnnouncementId = String(localStorage.getItem(seenKey) || '');
            } catch {
                seenAnnouncementId = '';
            }
            if (seenAnnouncementId === String(announcement.id)) {
                this.startupAnnouncementOverlay.style.display = 'none';
                return;
            }

            const titleEl = this.startupAnnouncementOverlay.querySelector('#startupAnnouncementTitleText');
            const messageEl = this.startupAnnouncementOverlay.querySelector('#startupAnnouncementMessageText');
            const metaEl = this.startupAnnouncementOverlay.querySelector('#startupAnnouncementMetaText');

            if (titleEl) {
                titleEl.textContent = String(announcement.title || 'Duyuru').trim() || 'Duyuru';
            }
            if (messageEl) {
                messageEl.textContent = String(announcement.message || '').trim();
            }
            if (metaEl) {
                const updatedLabel = announcement.updatedAt
                    ? new Date(announcement.updatedAt).toLocaleString()
                    : '';
                const byName = String(announcement.updatedByName || '').trim();
                const metaParts = [];
                if (byName) metaParts.push(byName);
                if (updatedLabel && updatedLabel !== 'Invalid Date') metaParts.push(updatedLabel);
                metaEl.textContent = metaParts.join(' • ');
            }

            this.startupAnnouncementOverlay.dataset.seenStorageKey = seenKey;
            this.startupAnnouncementOverlay.dataset.announcementId = String(announcement.id);
            this.startupAnnouncementOverlay.style.display = 'flex';
        } catch (error) {
            console.warn('[UI] Startup announcement fetch failed:', error);
        } finally {
            this._startupAnnouncementLoading = false;
        }
    }

    _dismissStartupAnnouncement() {
        if (!this.startupAnnouncementOverlay) return;

        const seenStorageKey = String(this.startupAnnouncementOverlay.dataset.seenStorageKey || '').trim();
        const announcementId = String(this.startupAnnouncementOverlay.dataset.announcementId || '').trim();
        if (seenStorageKey && announcementId) {
            try {
                localStorage.setItem(seenStorageKey, announcementId);
            } catch {
                // ignore storage quota/security errors
            }
        }

        this.startupAnnouncementOverlay.style.display = 'none';
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

            const safeUniqueId = this._escapeHtml(b.uniqueId || '');
            const safeNickname = this._escapeHtml(b.nickname || '');

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
                        <span class="player-name">${safeNickname}</span>
                        <button class="player-delete-btn" type="button" data-player-id="${safeUniqueId}" data-player-name="${safeNickname}" title="Oyuncuyu arenadan sil">🗑️</button>
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
    updateScoreboard(scores, cupScores, nicknames, profilePics) {
        if (!this.scoreboardList) return;
        cupScores = cupScores || {};
        profilePics = profilePics || {};

        // Dirty check — only update DOM when data actually changes
        const hash = JSON.stringify(
            Object.keys(cupScores)
                .sort()
                .map((id) => [id, cupScores[id], nicknames[id] || id, profilePics[id] || ''])
        );
        if (hash === this._lastScoreHash) {
            return;
        }
        this._lastScoreHash = hash;

        // Convert to sorted array
        const entries = Object.entries(cupScores)
            .map(([id, cups]) => ({
                id,
                cups,
                name: nicknames[id] || id,
                pic: profilePics[id] || ''
            }))
            .sort((a, b) => Number(b.cups || 0) - Number(a.cups || 0));

        if (entries.length === 0) {
            this.scoreboardList.innerHTML = '<div class="player-empty">Henüz kupa yok</div>';
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
                        <span class="score-wins">${entry.cups}🏆</span>
                        <button class="score-btn score-plus" data-uid="${entry.id}" title="Arttır">+</button>
                    </span>
                </div>
            `;
        });

        this.scoreboardList.innerHTML = html;

        // Event listeners handled by delegation in _createScoreboard
    }

    openActivePlayersPopup() {
        if (this._playersPopupWindow && !this._playersPopupWindow.closed) {
            this._playersPopupWindow.focus();
            return;
        }

        this._playersPopupWindow = window.open('', 'AktifOyuncular', 'width=420,height=620,resizable=yes,scrollbars=yes');
        if (!this._playersPopupWindow) return;

        const doc = this._playersPopupWindow.document;
        doc.write(`<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>⚔️ Aktif Oyuncular</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0a14, #111832, #0a1424);
            color: #eaf0ff;
            min-height: 100vh;
            padding: 22px;
        }
        h1 {
            text-align: center;
            font-size: 22px;
            margin-bottom: 16px;
            color: #00d4ff;
            text-shadow: 0 0 16px rgba(0,212,255,0.3);
        }
        .player-row {
            padding: 10px 12px;
            margin-bottom: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            background: rgba(255,255,255,0.04);
        }
        .player-row.shielded {
            border-color: rgba(0,212,255,0.45);
            background: rgba(0,212,255,0.08);
        }
        .row-main {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }
        .avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            object-fit: cover;
            border: 1px solid rgba(255,255,255,0.2);
            flex-shrink: 0;
        }
        .name {
            flex: 1;
            font-size: 13px;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .stats {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            font-weight: 700;
            flex-shrink: 0;
        }
        .delete-btn {
            width: 24px;
            height: 24px;
            border: 1px solid rgba(239,68,68,0.3);
            border-radius: 6px;
            background: rgba(239,68,68,0.12);
            color: #ff9c9c;
            font-size: 12px;
            line-height: 1;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s, background 0.2s, border-color 0.2s;
        }
        .player-row:hover .delete-btn,
        .player-row:focus-within .delete-btn {
            opacity: 1;
            pointer-events: auto;
        }
        .delete-btn:hover {
            background: rgba(239,68,68,0.22);
            border-color: rgba(239,68,68,0.5);
        }
        .atk { color: #f43f8e; }
        .hp { color: #22d67a; }
        .bar {
            width: 100%;
            height: 5px;
            border-radius: 999px;
            overflow: hidden;
            background: rgba(255,255,255,0.08);
        }
        .fill {
            height: 100%;
            border-radius: 999px;
            transition: width 0.2s ease;
        }
        .shield {
            margin-top: 5px;
            font-size: 10px;
            color: #8ddcff;
            font-weight: 700;
        }
        .empty {
            text-align: center;
            color: rgba(255,255,255,0.45);
            padding: 26px 8px;
            font-size: 13px;
        }
        .hint {
            text-align: center;
            margin-top: 12px;
            font-size: 10px;
            color: rgba(255,255,255,0.28);
        }
    </style>
</head>
<body>
    <h1>⚔️ Aktif Oyuncular</h1>
    <div id="playersRoot"><div class="empty">Aktif oyuncu yok</div></div>
    <div class="hint">Otomatik guncellenir</div>
    <script>
        var lastHash = '';

        function esc(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function getHpColor(percent) {
            if (percent > 60) return '#22d67a';
            if (percent > 30) return '#facc15';
            return '#ef4444';
        }

        function removePlayer(uniqueId) {
            try {
                if (!window.opener || !window.opener.game || typeof window.opener.game.removeActiveBeyblade !== 'function') return;
                window.opener.game.removeActiveBeyblade(uniqueId);
            } catch (err) {
            }
        }

        function refreshPlayers() {
            try {
                if (!window.opener || !window.opener.game) return;
                var game = window.opener.game;
                var all = game.beyblades || [];
                var blurPx = Math.max(0, Number(game.giftConfig && game.giftConfig.profileBlurAmount) || 0);
                var alive = all.filter(function(b) { return b && b.alive; });
                alive.sort(function(a, b) { return b.hp - a.hp; });

                var hash = JSON.stringify(alive.map(function(b) {
                    return [b.uniqueId, Math.ceil(b.hp), b.maxHp, b.attack, b.shieldActive, Math.ceil(b.shieldTimer || 0)];
                }));
                if (hash === lastHash) return;
                lastHash = hash;

                var root = document.getElementById('playersRoot');
                if (alive.length === 0) {
                    root.innerHTML = '<div class="empty">Aktif oyuncu yok</div>';
                    return;
                }

                var html = '';
                for (var i = 0; i < alive.length; i++) {
                    var b = alive[i];
                    var maxHp = Math.max(1, Number(b.maxHp) || 1);
                    var hp = Math.max(0, Number(b.hp) || 0);
                    var hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
                    var hpColor = getHpColor(hpPercent);
                    var rowClass = b.shieldActive ? 'player-row shielded' : 'player-row';
                    var avatar = b.profilePictureUrl ? '<img class="avatar" style="filter:blur(' + blurPx + 'px)" src="' + esc(b.profilePictureUrl) + '" alt="" onerror="this.style.display=\\'none\\'">' : '';
                    var shield = b.shieldActive ? '<div class="shield">Shield: ' + Math.ceil(b.shieldTimer || 0) + 's</div>' : '';
                    var deleteBtn = '<button class="delete-btn" type="button" data-id="' + esc(b.uniqueId) + '" title="Oyuncuyu arenadan sil">🗑️</button>';

                    html += '<div class="' + rowClass + '">';
                    html += '<div class="row-main">';
                    html += avatar;
                    html += '<div class="name">' + esc(b.nickname) + '</div>';
                    html += deleteBtn;
                    html += '<div class="stats"><span class="atk">ATK ' + Math.ceil(b.attack || 0) + '</span><span class="hp">' + Math.ceil(hp) + '/' + maxHp + '</span></div>';
                    html += '</div>';
                    html += '<div class="bar"><div class="fill" style="width:' + hpPercent + '%;background:' + hpColor + '"></div></div>';
                    html += shield;
                    html += '</div>';
                }
                root.innerHTML = html;
            } catch (err) {
            }
        }

        document.getElementById('playersRoot').addEventListener('click', function(event) {
            var btn = event.target.closest('.delete-btn');
            if (!btn) return;
            event.preventDefault();
            event.stopPropagation();
            var uniqueId = String(btn.getAttribute('data-id') || '').trim();
            if (!uniqueId) return;
            removePlayer(uniqueId);
            refreshPlayers();
        });

        setInterval(refreshPlayers, 250);
        refreshPlayers();
    </script>
</body>
</html>`);
        doc.close();
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
    <div id="popupList"><div class="empty">Henüz kupa yok</div></div>
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
                var cupScores = game.cupScores || {};
                var nicknames = game.nicknames;
                var pics = game.profilePics || {};
                var blurPx = Math.max(0, Number(game.giftConfig && game.giftConfig.profileBlurAmount) || 0);
                var hash = JSON.stringify(
                    Object.keys(cupScores)
                        .sort()
                        .map(function(id) { return [id, cupScores[id], nicknames[id] || id, pics[id] || '']; })
                );
                if (hash === lastHash) return;
                lastHash = hash;

                var container = document.getElementById('popupList');
                var keys = Object.keys(cupScores);
                var entries = [];
                for (var i = 0; i < keys.length; i++) {
                    entries.push({
                        id: keys[i],
                        cups: cupScores[keys[i]] || 0,
                        name: nicknames[keys[i]] || keys[i],
                        pic: pics[keys[i]] || ''
                    });
                }
                entries.sort(function(a, b) { return Number(b.cups || 0) - Number(a.cups || 0); });

                if (entries.length === 0) {
                    container.innerHTML = '<div class="empty">Hen\\u00fcz kupa yok</div>';
                    return;
                }

                var icons = ['\\ud83d\\udc51', '\\ud83e\\udd48', '\\ud83e\\udd49'];
                var html = '';
                for (var j = 0; j < entries.length; j++) {
                    var entry = entries[j];
                    var rankIcon = j < 3 ? icons[j] : (j + 1) + '.';
                    var champClass = j === 0 ? ' score-champion' : '';
                    var avatarHtml = entry.pic
                        ? '<img class="score-avatar" style="filter:blur(' + blurPx + 'px)" src="' + entry.pic + '" alt="" onerror="this.style.display=\\'none\\'">'
                        : '<span class="score-avatar score-avatar-placeholder">\\ud83d\\udc64</span>';
                    html += '<div class="score-row' + champClass + '">';
                    html += '<span class="score-rank">' + rankIcon + '</span>';
                    html += avatarHtml;
                    html += '<span class="score-name">' + entry.name + '</span>';
                    html += '<span class="score-controls">';
                    html += '<button class="score-btn score-minus" data-uid="' + entry.id + '">\\u2212</button>';
                    html += '<span class="score-wins">' + entry.cups + '\\ud83c\\udfc6</span>';
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
        const testNames = ['TestUser1', 'TestUser2', 'TestUser3', 'TopMaster', 'SpinMaster'];
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

    _giftFeedImageHtml(data) {
        const imageUrl = String(data?.giftPictureUrl || '').trim();
        if (!/^https?:\/\//i.test(imageUrl)) return '';

        const escaped = this._escapeHtml(imageUrl);
        return `<img class="feed-gift-icon" src="${escaped}" alt="" onerror="this.style.display='none'"> `;
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.UIManager = UIManager;

