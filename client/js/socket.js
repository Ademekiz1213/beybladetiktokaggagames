// Socket.IO Client Manager
class SocketManager {
    constructor() {
        this.socket = null;
        this.eventHandlers = {};
        this.sessionUserPayload = null;
        this.giftDetectionDelaySeconds = 10;
        this.giftCatalogSnapshot = null;

        window.addEventListener('auth-ready', (event) => {
            const user = event?.detail?.user || null;
            this.registerSessionUser(user);
        });
    }

    connect() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('[Socket] Connected to server');
            this._emitSessionUserIfPossible();
            this._emitGiftDelayIfPossible();
            this._trigger('socket-connected');
        });

        this.socket.on('disconnect', () => {
            console.log('[Socket] Disconnected from server');
            this._trigger('socket-disconnected');
        });

        // TikTok status updates
        this.socket.on('tiktok-status', (data) => {
            console.log('[Socket] TikTok status:', data);
            this._trigger('tiktok-status', data);
        });

        // TikTok events
        this.socket.on('tiktok-gift', (data) => {
            console.log('[Socket] Gift:', data);
            this._trigger('tiktok-gift', data);
        });

        this.socket.on('tiktok-like', (data) => {
            this._trigger('tiktok-like', data);
        });

        this.socket.on('tiktok-follow', (data) => {
            console.log('[Socket] Follow:', data);
            this._trigger('tiktok-follow', data);
        });

        this.socket.on('tiktok-chat', (data) => {
            this._trigger('tiktok-chat', data);
        });

        this.socket.on('tiktok-share', (data) => {
            console.log('[Socket] Share:', data);
            this._trigger('tiktok-share', data);
        });

        this.socket.on('admin-announcement', (data) => {
            console.log('[Socket] Admin announcement:', data);
            this._trigger('admin-announcement', data);
        });

        this.socket.on('gift-catalog-snapshot', (data) => {
            this.giftCatalogSnapshot = data || null;
            this._trigger('gift-catalog-snapshot', data);
        });

        this.socket.on('gift-catalog-updated', (data) => {
            this._mergeGiftCatalogUpdate(data);
            this._trigger('gift-catalog-updated', data);
        });
    }

    connectTikTok(username) {
        if (!this.socket) return;
        this.socket.emit('connect-tiktok', { username });
    }

    connectTikTokMany(usernames) {
        if (!this.socket) return;
        this.socket.emit('connect-tiktok', { usernames });
    }

    disconnectTikTok(username) {
        if (!this.socket) return;

        if (username) {
            this.socket.emit('disconnect-tiktok', { username });
            return;
        }

        this.socket.emit('disconnect-tiktok', {});
    }

    disconnectTikTokMany(usernames) {
        if (!this.socket) return;
        this.socket.emit('disconnect-tiktok', { usernames });
    }

    setGiftDetectionDelay(seconds) {
        const parsed = Number(seconds);
        this.giftDetectionDelaySeconds = Math.max(1, Number.isFinite(parsed) ? Math.floor(parsed) : 10);
        this._emitGiftDelayIfPossible();
    }

    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    registerSessionUser(user) {
        const email = String(user?.email || '').trim().toLowerCase();
        const uid = String(user?.uid || '').trim();
        if (!email) {
            return;
        }

        this.sessionUserPayload = { email, uid };
        this._emitSessionUserIfPossible();
    }

    _emitSessionUserIfPossible() {
        if (!this.socket || !this.socket.connected || !this.sessionUserPayload) {
            return;
        }

        this.socket.emit('register-session-user', this.sessionUserPayload);
    }

    _emitGiftDelayIfPossible() {
        if (!this.socket || !this.socket.connected) {
            return;
        }

        this.socket.emit('set-gift-delay', {
            giftDetectionDelaySeconds: this.giftDetectionDelaySeconds
        });
    }

    _mergeGiftCatalogUpdate(payload) {
        const gift = payload?.gift;
        if (!gift || !this.giftCatalogSnapshot || !Array.isArray(this.giftCatalogSnapshot.gifts)) {
            return;
        }

        const giftName = String(gift.giftName || '').trim();
        if (!giftName) return;

        const normalizedName = giftName.toLowerCase();
        const existingIndex = this.giftCatalogSnapshot.gifts.findIndex((item) => {
            return String(item?.giftName || '').trim().toLowerCase() === normalizedName;
        });

        if (existingIndex >= 0) {
            this.giftCatalogSnapshot.gifts[existingIndex] = {
                ...this.giftCatalogSnapshot.gifts[existingIndex],
                ...gift
            };
        } else {
            this.giftCatalogSnapshot.gifts.push(gift);
        }

        if (payload?.updatedAt) {
            this.giftCatalogSnapshot.updatedAt = payload.updatedAt;
        }
    }

    _trigger(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach((handler) => handler(data));
        }
    }
}

window.socketManager = new SocketManager();
