const { WebcastPushConnection } = require('tiktok-live-connector');

class TikTokHandler {
    constructor(username, options = {}) {
        this.username = TikTokHandler.normalizeUsername(username);
        this.streamerKey = this.username.toLowerCase();
        this.onStatus = options.onStatus;
        this.onEvent = options.onEvent;
        this.enableChatEvents = Boolean(options.enableChatEvents);
        this.enableShareEvents = Boolean(options.enableShareEvents);

        this.connection = null;
        this.isConnected = false;
        this.hasEverConnected = false;
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

    _resolveGiftPictureUrl(data) {
        const directCandidates = [
            data?.giftPictureUrl,
            data?.imageUrl,
            data?.url
        ];

        for (const candidate of directCandidates) {
            const normalized = String(candidate || '').trim();
            if (/^https?:\/\//i.test(normalized)) return normalized;
        }

        const extendedCandidates = [
            data?.extendedGiftInfo?.giftPictureUrl,
            data?.extendedGiftInfo?.imageUrl,
            data?.extendedGiftInfo?.icon?.url_list?.[0],
            data?.extendedGiftInfo?.icon?.urlList?.[0]
        ];

        for (const candidate of extendedCandidates) {
            const normalized = String(candidate || '').trim();
            if (/^https?:\/\//i.test(normalized)) return normalized;
        }

        return '';
    }

    _resolveRoomId(state) {
        if (!state || typeof state !== 'object') return null;

        const direct = state.roomId ?? state.room_id;
        if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
            return String(direct);
        }

        const nested = state.roomInfo?.roomId ?? state.roomInfo?.room_id;
        if (nested !== undefined && nested !== null && String(nested).trim() !== '') {
            return String(nested);
        }

        return null;
    }

    _resolveErrorMessage(err, fallbackMessage = 'Bilinmeyen hata') {
        if (!err) return fallbackMessage;

        const messageCandidates = [
            err.message,
            err?.response?.data?.message,
            err?.response?.data?.error,
            err?.response?.statusText,
            typeof err === 'string' ? err : null
        ];

        for (const candidate of messageCandidates) {
            const normalized = String(candidate || '').trim();
            if (normalized) return normalized;
        }

        return fallbackMessage;
    }

    async connect() {
        if (this.connection && typeof this.connection.disconnect === 'function') {
            try {
                this.connection.disconnect();
            } catch (disconnectError) {
                console.warn(`[TikTok] Previous connection cleanup failed [${this.username}]:`, disconnectError?.message || disconnectError);
            }
        }

        this.connection = new WebcastPushConnection(this.username, {
            enableExtendedGiftInfo: true
        });
        this._setupEventListeners();

        this._emitStatus({
            connected: false,
            connecting: true
        });

        try {
            const state = await this.connection.connect();
            const roomId = this._resolveRoomId(state);
            this.isConnected = true;
            this.hasEverConnected = true;
            console.log(`[TikTok] Connected to ${this.username} | Room ID: ${roomId || 'unknown'}`);

            this._emitStatus({
                connected: true,
                connecting: false,
                roomId
            });
        } catch (err) {
            this.isConnected = false;
            const errorMessage = this._resolveErrorMessage(err, 'Baglanti kurulamadi');
            console.error('[TikTok] Connection failed:', errorMessage);

            this._emitStatus({
                connected: false,
                connecting: false,
                error: errorMessage
            });
        }
    }

    _setupEventListeners() {
        if (!this.connection) return;

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
                giftPictureUrl: this._resolveGiftPictureUrl(data),
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

        // Optional: chat/share are disabled by default to reduce unnecessary event traffic.
        if (this.enableChatEvents) {
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
        }

        if (this.enableShareEvents) {
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
        }

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
        this.connection.on('disconnected', (reason) => {
            console.log(`[TikTok] Disconnected [${this.username}]`);
            this.isConnected = false;
            const errorMessage = this._resolveErrorMessage(reason, 'Baglanti kesildi');

            this._emitStatus({
                connected: false,
                connecting: false,
                error: errorMessage
            });
        });

        // Error
        this.connection.on('error', (err) => {
            const errorMessage = this._resolveErrorMessage(err, 'TikTok baglanti hatasi');
            console.error(`[TikTok] Error [${this.username}]:`, errorMessage);
            this._emitStatus({
                connected: this.isConnected,
                connecting: false,
                error: errorMessage
            });
        });
    }

    disconnect(options = {}) {
        const silent = Boolean(options.silent);

        if (this.connection) {
            if (typeof this.connection.removeAllListeners === 'function') {
                this.connection.removeAllListeners();
            }
            if (typeof this.connection.disconnect === 'function') {
                this.connection.disconnect();
            }
        }

        this.isConnected = false;
        this.likeCounters = {};
        this.connection = null;
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
