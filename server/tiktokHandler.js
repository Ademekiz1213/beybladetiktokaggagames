const { WebcastPushConnection } = require('tiktok-live-connector');

class TikTokHandler {
    constructor(username, options = {}) {
        this.username = TikTokHandler.normalizeUsername(username);
        this.streamerKey = this.username.toLowerCase();
        this.onStatus = options.onStatus;
        this.onEvent = options.onEvent;

        this.connection = null;
        this.isConnected = false;
        this.likeCounters = {}; // viewerId -> accumulated likes
    }

    static normalizeUsername(username) {
        return String(username || '').trim().replace(/^@+/, '');
    }

    _emitStatus(status) {
        if (typeof this.onStatus !== 'function') return;

        this.onStatus({
            username: this.username,
            streamerKey: this.streamerKey,
            ...status
        });
    }

    _emitEvent(eventName, payload) {
        if (typeof this.onEvent !== 'function') return;

        this.onEvent(eventName, {
            streamerUsername: this.username,
            streamerKey: this.streamerKey,
            ...payload
        });
    }

    _buildScopedIdentity(data) {
        const rawUserId = data.userId !== undefined && data.userId !== null
            ? String(data.userId)
            : '';
        const rawUniqueId = data.uniqueId ? String(data.uniqueId) : '';

        const baseUserId = rawUserId || rawUniqueId || 'unknown';
        const baseUniqueId = rawUniqueId || rawUserId || 'unknown';

        return {
            rawUserId: baseUserId,
            rawUniqueId: baseUniqueId,
            userId: `${this.streamerKey}:${baseUserId}`,
            uniqueId: `${this.streamerKey}:${baseUniqueId}`
        };
    }

    async connect() {
        this.connection = new WebcastPushConnection(this.username);

        this._emitStatus({
            connected: false,
            connecting: true
        });

        try {
            const state = await this.connection.connect();
            this.isConnected = true;
            console.log(`[TikTok] Connected to ${this.username} | Room ID: ${state.roomId}`);

            this._emitStatus({
                connected: true,
                connecting: false,
                roomId: state.roomId
            });

            this._setupEventListeners();
        } catch (err) {
            this.isConnected = false;
            console.error('[TikTok] Connection failed:', err.message);

            this._emitStatus({
                connected: false,
                connecting: false,
                error: err.message
            });
        }
    }

    _setupEventListeners() {
        // Gift event
        this.connection.on('gift', (data) => {
            const ids = this._buildScopedIdentity(data);

            const giftInfo = {
                userId: ids.userId,
                uniqueId: ids.uniqueId,
                viewerUserId: ids.rawUserId,
                viewerUniqueId: ids.rawUniqueId,
                nickname: data.nickname,
                profilePictureUrl: data.profilePictureUrl,
                giftId: data.giftId,
                giftName: data.giftName || `Gift_${data.giftId}`,
                diamondCount: data.diamondCount || 0,
                repeatCount: data.repeatCount || 1,
                repeatEnd: data.repeatEnd,
                giftType: data.giftType
            };

            // Only process when gift streak ends (repeatEnd) or non-repeatable gifts
            if (data.giftType === 1 && !data.repeatEnd) {
                console.log(`[TikTok] Gift streak: ${giftInfo.nickname} -> ${giftInfo.giftName} x${giftInfo.repeatCount}`);
                return;
            }

            console.log(`[TikTok] Gift: ${giftInfo.nickname} -> ${giftInfo.giftName} x${giftInfo.repeatCount} (${giftInfo.diamondCount} diamonds) [${this.username}]`);
            this._emitEvent('tiktok-gift', giftInfo);
        });

        // Like event
        this.connection.on('like', (data) => {
            const ids = this._buildScopedIdentity(data);
            const counterKey = ids.rawUserId;
            const likeCount = data.likeCount || 1;
            const totalLikes = data.totalLikeCount || 0;

            if (!this.likeCounters[counterKey]) {
                this.likeCounters[counterKey] = 0;
            }
            this.likeCounters[counterKey] += likeCount;

            const likeInfo = {
                userId: ids.userId,
                uniqueId: ids.uniqueId,
                viewerUserId: ids.rawUserId,
                viewerUniqueId: ids.rawUniqueId,
                nickname: data.nickname,
                profilePictureUrl: data.profilePictureUrl,
                likeCount,
                totalLikes,
                accumulatedLikes: this.likeCounters[counterKey]
            };

            console.log(`[TikTok] Like: ${likeInfo.nickname} +${likeCount} (accumulated: ${this.likeCounters[counterKey]}) [${this.username}]`);
            this._emitEvent('tiktok-like', likeInfo);
        });

        // Follow event
        this.connection.on('follow', (data) => {
            const ids = this._buildScopedIdentity(data);

            const followInfo = {
                userId: ids.userId,
                uniqueId: ids.uniqueId,
                viewerUserId: ids.rawUserId,
                viewerUniqueId: ids.rawUniqueId,
                nickname: data.nickname,
                profilePictureUrl: data.profilePictureUrl
            };

            console.log(`[TikTok] Follow: ${followInfo.nickname} [${this.username}]`);
            this._emitEvent('tiktok-follow', followInfo);
        });

        // Chat event
        this.connection.on('chat', (data) => {
            const ids = this._buildScopedIdentity(data);

            const chatInfo = {
                userId: ids.userId,
                uniqueId: ids.uniqueId,
                viewerUserId: ids.rawUserId,
                viewerUniqueId: ids.rawUniqueId,
                nickname: data.nickname,
                profilePictureUrl: data.profilePictureUrl,
                comment: data.comment
            };

            this._emitEvent('tiktok-chat', chatInfo);
        });

        // Share event
        this.connection.on('share', (data) => {
            const ids = this._buildScopedIdentity(data);

            const shareInfo = {
                userId: ids.userId,
                uniqueId: ids.uniqueId,
                viewerUserId: ids.rawUserId,
                viewerUniqueId: ids.rawUniqueId,
                nickname: data.nickname,
                profilePictureUrl: data.profilePictureUrl
            };

            console.log(`[TikTok] Share: ${shareInfo.nickname} [${this.username}]`);
            this._emitEvent('tiktok-share', shareInfo);
        });

        // Stream end
        this.connection.on('streamEnd', () => {
            console.log(`[TikTok] Stream ended [${this.username}]`);
            this.isConnected = false;

            this._emitStatus({
                connected: false,
                connecting: false,
                error: 'Yayin sona erdi'
            });
        });

        // Disconnected
        this.connection.on('disconnected', () => {
            console.log(`[TikTok] Disconnected [${this.username}]`);
            this.isConnected = false;

            this._emitStatus({
                connected: false,
                connecting: false,
                error: 'Baglanti kesildi'
            });
        });

        // Error
        this.connection.on('error', (err) => {
            console.error(`[TikTok] Error [${this.username}]:`, err.message);
        });
    }

    disconnect(options = {}) {
        const silent = Boolean(options.silent);

        if (this.connection) {
            this.connection.disconnect();
        }

        this.isConnected = false;
        this.likeCounters = {};
        console.log(`[TikTok] Disconnected manually [${this.username}]`);

        if (!silent) {
            this._emitStatus({
                connected: false,
                connecting: false,
                disconnectedByUser: true
            });
        }
    }

    resetLikeCounters() {
        this.likeCounters = {};
    }
}

module.exports = TikTokHandler;
