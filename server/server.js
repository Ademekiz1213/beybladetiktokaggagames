const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const TikTokHandler = require('./tiktokHandler');
const { registerPremiumRoutes, resolveRequestUser, isAdminEmail, resolveAdminSenderName } = require('./premiumService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

function envInt(name, fallback) {
    const raw = Number(process.env[name]);
    if (!Number.isFinite(raw) || raw < 0) return fallback;
    return Math.floor(raw);
}

const MAX_STREAMERS_PER_TAB = envInt('MAX_STREAMERS_PER_TAB', 20);
const MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER = envInt('MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER', 10);
const MAX_USERNAMES_PER_CONNECT_REQUEST = envInt('MAX_USERNAMES_PER_CONNECT_REQUEST', 8);
const CONNECT_REQUEST_WINDOW_MS = envInt('CONNECT_REQUEST_WINDOW_MS', 60_000);
const MAX_CONNECT_REQUESTS_PER_WINDOW = envInt('MAX_CONNECT_REQUESTS_PER_WINDOW', 12);
const CONNECT_SPACING_MS = envInt('CONNECT_SPACING_MS', 2_000);
const CONNECT_JITTER_MS = envInt('CONNECT_JITTER_MS', 1_200);
const BASE_FAILURE_COOLDOWN_MS = envInt('BASE_FAILURE_COOLDOWN_MS', 30_000);
const MAX_FAILURE_COOLDOWN_MS = envInt('MAX_FAILURE_COOLDOWN_MS', 10 * 60_000);
const MANUAL_RECONNECT_COOLDOWN_MS = envInt('MANUAL_RECONNECT_COOLDOWN_MS', 10_000);
const DISCONNECT_RECONNECT_COOLDOWN_MS = envInt('DISCONNECT_RECONNECT_COOLDOWN_MS', 45_000);
const MAX_GLOBAL_ACTIVE_STREAMERS = envInt('MAX_GLOBAL_ACTIVE_STREAMERS', 40);
const MIN_GIFT_DELAY_SECONDS = envInt('MIN_GIFT_DELAY_SECONDS', 10);
const DEFAULT_GIFT_DELAY_SECONDS = Math.max(
    MIN_GIFT_DELAY_SECONDS,
    envInt('DEFAULT_GIFT_DELAY_SECONDS', MIN_GIFT_DELAY_SECONDS)
);
const ENABLE_TIKTOK_CHAT_EVENTS = String(process.env.ENABLE_TIKTOK_CHAT_EVENTS || '').toLowerCase() === 'true';
const ENABLE_TIKTOK_SHARE_EVENTS = String(process.env.ENABLE_TIKTOK_SHARE_EVENTS || '').toLowerCase() === 'true';

const liveSocketStates = new Map(); // socketId -> live connection snapshot
const globalConnectedStreamerCount = new Map(); // streamerKey -> connected handler count

// Serve client files
app.use(express.json({ limit: '128kb' }));
app.use(express.static(path.join(__dirname, '..', 'client')));
registerPremiumRoutes(app);

app.get('/health', (_req, res) => {
    res.status(200).json({
        ok: true,
        service: 'beyblade-tiktok-server'
    });
});

app.get('/api/admin/live-streamers', async (req, res) => {
    try {
        const user = await resolveRequestUser(req);
        if (!user) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }

        if (!isAdminEmail(user.email)) {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }

        const sockets = Array.from(liveSocketStates.values())
            .map((entry) => ({
                socketId: entry.socketId,
                userEmail: entry.userEmail || null,
                userUid: entry.userUid || null,
                connectedUsernames: Array.isArray(entry.connectedUsernames) ? entry.connectedUsernames : [],
                trackedUsernames: Array.isArray(entry.trackedUsernames) ? entry.trackedUsernames : [],
                connectedCount: Number(entry.connectedCount || 0),
                trackedCount: Number(entry.trackedCount || 0),
                updatedAt: entry.updatedAt || null
            }))
            .sort((a, b) => {
                if (a.connectedCount === b.connectedCount) {
                    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
                }
                return b.connectedCount - a.connectedCount;
            });

        const uniqueConnected = new Set();
        for (const entry of sockets) {
            for (const username of entry.connectedUsernames) {
                uniqueConnected.add(String(username));
            }
        }

        return res.json({
            ok: true,
            totalSockets: sockets.length,
            totalConnectedStreamers: uniqueConnected.size,
            sockets
        });
    } catch (error) {
        console.error('[Admin] /live-streamers failed:', error);
        return res.status(500).json({ ok: false, error: 'Internal error' });
    }
});

app.post('/api/admin/announce', async (req, res) => {
    try {
        const user = await resolveRequestUser(req);
        if (!user) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }

        if (!isAdminEmail(user.email)) {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }

        const message = String(req.body?.message || '').trim();
        if (!message) {
            return res.status(400).json({ ok: false, error: 'Announcement message is required' });
        }

        if (message.length > 300) {
            return res.status(400).json({ ok: false, error: 'Announcement message is too long (max 300 chars)' });
        }

        const sentByName = await resolveAdminSenderName(user.email);
        const announcement = {
            message,
            sentByName: sentByName || user.email,
            sentByEmail: user.email,
            createdAt: new Date().toISOString()
        };

        io.emit('admin-announcement', announcement);

        return res.json({
            ok: true,
            deliveredToSockets: Number(io.engine?.clientsCount || 0),
            announcement
        });
    } catch (error) {
        console.error('[Admin] /announce failed:', error);
        return res.status(500).json({ ok: false, error: 'Internal error' });
    }
});

function normalizeUsername(username) {
    return TikTokHandler.normalizeUsername(username);
}

function parseUsernames(payload) {
    if (typeof payload === 'string') {
        return [payload];
    }

    if (Array.isArray(payload)) {
        return payload;
    }

    if (payload && typeof payload === 'object') {
        if (Array.isArray(payload.usernames)) {
            return payload.usernames;
        }

        if (typeof payload.username === 'string') {
            return [payload.username];
        }
    }

    return [];
}

function sanitizeUsernames(rawUsernames) {
    const unique = new Set();
    const cleaned = [];

    for (const raw of rawUsernames) {
        const normalized = normalizeUsername(raw);
        if (!normalized) continue;

        const key = normalized.toLowerCase();
        if (unique.has(key)) continue;

        unique.add(key);
        cleaned.push(normalized);
    }

    return cleaned;
}

function getConnectedUsernames(handlers) {
    return Array.from(handlers.values())
        .filter((handler) => handler.isConnected)
        .map((handler) => handler.username);
}

function getTrackedUsernames(handlers) {
    return Array.from(handlers.values()).map((handler) => handler.username);
}

function incrementGlobalStreamerCount(streamerKey) {
    const current = Number(globalConnectedStreamerCount.get(streamerKey) || 0);
    globalConnectedStreamerCount.set(streamerKey, current + 1);
}

function decrementGlobalStreamerCount(streamerKey) {
    const current = Number(globalConnectedStreamerCount.get(streamerKey) || 0);
    if (current <= 1) {
        globalConnectedStreamerCount.delete(streamerKey);
        return;
    }
    globalConnectedStreamerCount.set(streamerKey, current - 1);
}

function getGlobalActiveStreamerCount() {
    let total = 0;
    for (const value of globalConnectedStreamerCount.values()) {
        total += Number(value || 0);
    }
    return total;
}

function formatRetryAfterMs(ms) {
    const totalSeconds = Math.max(1, Math.ceil((Number(ms) || 0) / 1000));
    if (totalSeconds < 60) return `${totalSeconds}s`;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (seconds === 0) return `${minutes}dk`;
    return `${minutes}dk ${seconds}s`;
}

function normalizeGiftDelaySeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_GIFT_DELAY_SECONDS;
    return Math.max(MIN_GIFT_DELAY_SECONDS, Math.floor(parsed));
}

function updateLiveSocketState(socket, handlers, payload = {}) {
    const socketId = socket?.id;
    if (!socketId) return;

    const previous = liveSocketStates.get(socketId) || {
        socketId,
        userEmail: null,
        userUid: null,
        connectedUsernames: [],
        trackedUsernames: [],
        connectedCount: 0,
        trackedCount: 0,
        updatedAt: null
    };

    const connectedUsernames = getConnectedUsernames(handlers);
    const trackedUsernames = getTrackedUsernames(handlers);

    liveSocketStates.set(socketId, {
        ...previous,
        connectedUsernames,
        trackedUsernames,
        connectedCount: connectedUsernames.length,
        trackedCount: trackedUsernames.length,
        lastStatus: payload,
        updatedAt: new Date().toISOString()
    });
}

function emitSocketStatus(socket, handlers, payload = {}) {
    const connectedUsernames = getConnectedUsernames(handlers);

    const statusPayload = {
        globalConnected: connectedUsernames.length > 0,
        connectedCount: connectedUsernames.length,
        connectedUsernames,
        trackedCount: handlers.size,
        trackedUsernames: getTrackedUsernames(handlers),
        ...payload
    };

    updateLiveSocketState(socket, handlers, statusPayload);
    socket.emit('tiktok-status', statusPayload);
}

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Each tab/socket gets isolated streamer handlers.
    const sessionHandlers = new Map(); // streamerKey -> TikTokHandler
    const failedConnectAttempts = new Map(); // streamerKey -> { count, blocked, lastError, nextAllowedAt }
    const streamerCooldowns = new Map(); // streamerKey -> { until, reason }
    const pendingConnectTimers = new Map(); // streamerKey -> timeout
    const pendingConnects = new Set(); // streamerKey
    const pendingGiftEmitTimers = new Map(); // timeout -> streamerKey
    let giftDelaySeconds = DEFAULT_GIFT_DELAY_SECONDS;
    let connectRequestTimestamps = []; // request timestamps for this socket

    liveSocketStates.set(socket.id, {
        socketId: socket.id,
        userEmail: null,
        userUid: null,
        connectedUsernames: [],
        trackedUsernames: [],
        connectedCount: 0,
        trackedCount: 0,
        updatedAt: new Date().toISOString()
    });

    function trimConnectRequestWindow(now = Date.now()) {
        connectRequestTimestamps = connectRequestTimestamps.filter(
            (value) => (now - value) <= CONNECT_REQUEST_WINDOW_MS
        );
    }

    function consumeConnectRequestSlot() {
        const now = Date.now();
        trimConnectRequestWindow(now);
        if (connectRequestTimestamps.length >= MAX_CONNECT_REQUESTS_PER_WINDOW) {
            return false;
        }
        connectRequestTimestamps.push(now);
        return true;
    }

    function getStreamerRetryState(streamerKey) {
        const now = Date.now();

        const failedState = failedConnectAttempts.get(streamerKey);
        if (failedState?.blocked) {
            return {
                blocked: true,
                failedAttempts: failedState.count,
                retryAfterMs: Number.POSITIVE_INFINITY
            };
        }
        if (failedState?.nextAllowedAt && failedState.nextAllowedAt > now) {
            return {
                blocked: false,
                failedAttempts: failedState.count,
                retryAfterMs: failedState.nextAllowedAt - now
            };
        }

        const cooldownState = streamerCooldowns.get(streamerKey);
        if (cooldownState?.until && cooldownState.until > now) {
            return {
                blocked: false,
                retryAfterMs: cooldownState.until - now,
                reason: cooldownState.reason || 'cooldown'
            };
        }

        return null;
    }

    function setStreamerCooldown(streamerKey, durationMs, reason = 'cooldown') {
        const normalizedDuration = Math.max(0, Number(durationMs) || 0);
        if (normalizedDuration <= 0) return;

        streamerCooldowns.set(streamerKey, {
            until: Date.now() + normalizedDuration,
            reason
        });
    }

    function clearPendingConnect(streamerKey) {
        const timer = pendingConnectTimers.get(streamerKey);
        if (timer) {
            clearTimeout(timer);
        }
        pendingConnectTimers.delete(streamerKey);
        pendingConnects.delete(streamerKey);
    }

    function queueGiftEventForSocket(eventName, eventData = {}) {
        const streamerKey = String(eventData?.streamerKey || '').toLowerCase();
        const delayMs = Math.max(0, normalizeGiftDelaySeconds(giftDelaySeconds) * 1000);

        if (delayMs <= 0) {
            socket.emit(eventName, eventData);
            return;
        }

        const delayedPayload = {
            ...eventData,
            delayAppliedOnServer: true,
            serverGiftDelayMs: delayMs
        };

        const timer = setTimeout(() => {
            pendingGiftEmitTimers.delete(timer);
            if (!socket.connected) return;
            socket.emit(eventName, delayedPayload);
        }, delayMs);

        pendingGiftEmitTimers.set(timer, streamerKey);
    }

    function clearPendingGiftEventsForStreamer(streamerKey) {
        for (const [timer, queuedStreamerKey] of Array.from(pendingGiftEmitTimers.entries())) {
            if (queuedStreamerKey !== streamerKey) continue;
            clearTimeout(timer);
            pendingGiftEmitTimers.delete(timer);
        }
    }

    function clearAllPendingGiftEvents() {
        for (const timer of Array.from(pendingGiftEmitTimers.keys())) {
            clearTimeout(timer);
            pendingGiftEmitTimers.delete(timer);
        }
    }

    function disconnectHandler(streamerKey, handler, options = {}) {
        if (!handler) return;

        const silent = options.silent !== false;
        const cooldownMs = Math.max(0, Number(options.cooldownMs) || 0);

        handler._released = true;
        clearPendingConnect(streamerKey);
        clearPendingGiftEventsForStreamer(streamerKey);

        if (handler._countedGlobally) {
            decrementGlobalStreamerCount(streamerKey);
            handler._countedGlobally = false;
        }

        if (sessionHandlers.get(streamerKey) === handler) {
            sessionHandlers.delete(streamerKey);
        }

        if (cooldownMs > 0) {
            setStreamerCooldown(streamerKey, cooldownMs, 'manual_disconnect');
        }

        handler.disconnect({ silent });
    }

    function canConnectToStreamer(streamerKey, username) {
        if (sessionHandlers.size + pendingConnects.size >= MAX_STREAMERS_PER_TAB) {
            return {
                ok: false,
                error: `Bu sekmede maksimum ${MAX_STREAMERS_PER_TAB} yayinciya baglanabilirsiniz`
            };
        }

        const globalActiveCount = getGlobalActiveStreamerCount();
        if (globalActiveCount >= MAX_GLOBAL_ACTIVE_STREAMERS) {
            return {
                ok: false,
                error: `Sunucuda ayni anda maksimum ${MAX_GLOBAL_ACTIVE_STREAMERS} aktif baglanti acilabilir`
            };
        }

        const sameStreamerActive = Number(globalConnectedStreamerCount.get(streamerKey) || 0);
        if (sameStreamerActive > 0) {
            return {
                ok: false,
                error: `${username} zaten baska bir sekmede bagli. Ban riskini azaltmak icin ayni yayinciya ikinci baglanti engellendi.`
            };
        }

        return { ok: true };
    }

    function connectStreamerForSocket(username) {
        const normalized = normalizeUsername(username);
        if (!normalized) return null;

        const streamerKey = normalized.toLowerCase();
        const existing = sessionHandlers.get(streamerKey);
        if (existing) {
            return existing;
        }

        const retryState = getStreamerRetryState(streamerKey);
        if (retryState?.blocked) {
            emitSocketStatus(socket, sessionHandlers, {
                username: normalized,
                connectBlocked: true,
                failedAttempts: retryState.failedAttempts,
                error: `${normalized} icin ${MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER} basarisiz deneme oldu. Bu sekmede tekrar denenmeyecek.`
            });
            return null;
        }

        if (retryState?.retryAfterMs && Number.isFinite(retryState.retryAfterMs)) {
            const retryAfterMs = Math.max(1_000, Math.floor(retryState.retryAfterMs));
            emitSocketStatus(socket, sessionHandlers, {
                username: normalized,
                retryAfterMs,
                error: `${normalized} icin yeniden baglanti bekleme suresi var. ${formatRetryAfterMs(retryAfterMs)} sonra tekrar deneyin.`
            });
            return null;
        }

        const globalGate = canConnectToStreamer(streamerKey, normalized);
        if (!globalGate.ok) {
            emitSocketStatus(socket, sessionHandlers, {
                username: normalized,
                error: globalGate.error
            });
            return null;
        }

        const handler = new TikTokHandler(normalized, {
            enableChatEvents: ENABLE_TIKTOK_CHAT_EVENTS,
            enableShareEvents: ENABLE_TIKTOK_SHARE_EVENTS,
            onStatus: (status) => {
                if (handler._released) {
                    return;
                }

                const statusPayload = { ...status };

                if (statusPayload.connected) {
                    failedConnectAttempts.delete(streamerKey);
                    streamerCooldowns.delete(streamerKey);
                    if (!handler._countedGlobally) {
                        incrementGlobalStreamerCount(streamerKey);
                        handler._countedGlobally = true;
                    }
                }

                // Auto-remove dead handler so same streamer can reconnect in this tab.
                if (!status.connecting && !status.connected) {
                    clearPendingGiftEventsForStreamer(streamerKey);
                    if (handler._countedGlobally) {
                        decrementGlobalStreamerCount(streamerKey);
                        handler._countedGlobally = false;
                    }

                    const current = sessionHandlers.get(streamerKey);
                    if (current === handler) {
                        sessionHandlers.delete(streamerKey);
                    }

                    const shouldCountFailure = !handler.hasEverConnected && !status.disconnectedByUser;
                    if (shouldCountFailure) {
                        const previous = failedConnectAttempts.get(streamerKey) || {
                            count: 0,
                            blocked: false,
                            lastError: null,
                            nextAllowedAt: 0
                        };
                        const count = previous.count + 1;
                        const blocked = count >= MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER;
                        const cooldownMs = blocked
                            ? 0
                            : Math.min(
                                MAX_FAILURE_COOLDOWN_MS,
                                BASE_FAILURE_COOLDOWN_MS * Math.max(1, Math.pow(2, count - 1))
                            );

                        failedConnectAttempts.set(streamerKey, {
                            count,
                            blocked,
                            lastError: status.error || previous.lastError || null,
                            nextAllowedAt: blocked ? Number.POSITIVE_INFINITY : Date.now() + cooldownMs
                        });

                        statusPayload.failedAttempts = count;
                        statusPayload.connectBlocked = blocked;
                        if (blocked) {
                            statusPayload.error = `${handler.username} icin ${MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER} basarisiz deneme oldu. Bu sekmede tekrar denenmeyecek.`;
                        } else {
                            statusPayload.retryAfterMs = cooldownMs;
                            statusPayload.error = `${handler.username} baglantisi basarisiz. ${formatRetryAfterMs(cooldownMs)} sonra tekrar deneyin.`;
                        }
                    } else if (!status.disconnectedByUser) {
                        setStreamerCooldown(streamerKey, DISCONNECT_RECONNECT_COOLDOWN_MS, 'disconnect');
                        statusPayload.retryAfterMs = DISCONNECT_RECONNECT_COOLDOWN_MS;
                    }
                }

                emitSocketStatus(socket, sessionHandlers, statusPayload);
            },
            onEvent: (eventName, eventData) => {
                // Important: emit only to this tab.
                if (eventName === 'tiktok-gift') {
                    queueGiftEventForSocket(eventName, eventData);
                    return;
                }
                socket.emit(eventName, eventData);
            }
        });

        handler._countedGlobally = false;
        handler._released = false;
        sessionHandlers.set(streamerKey, handler);
        handler.connect();

        return handler;
    }

    function scheduleConnectStreamer(username, queueIndex = 0) {
        const normalized = normalizeUsername(username);
        if (!normalized) return false;

        const streamerKey = normalized.toLowerCase();
        const existing = sessionHandlers.get(streamerKey);
        if (existing) {
            emitSocketStatus(socket, sessionHandlers, {
                username: existing.username,
                connected: existing.isConnected,
                connecting: !existing.isConnected,
                alreadyTracked: true
            });
            return false;
        }

        if (pendingConnects.has(streamerKey)) {
            emitSocketStatus(socket, sessionHandlers, {
                username: normalized,
                connecting: true,
                queued: true,
                alreadyQueued: true
            });
            return false;
        }

        const retryState = getStreamerRetryState(streamerKey);
        if (retryState?.blocked) {
            emitSocketStatus(socket, sessionHandlers, {
                username: normalized,
                connectBlocked: true,
                failedAttempts: retryState.failedAttempts,
                error: `${normalized} icin ${MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER} deneme limiti doldu.`
            });
            return false;
        }

        if (retryState?.retryAfterMs && Number.isFinite(retryState.retryAfterMs)) {
            const retryAfterMs = Math.max(1_000, Math.floor(retryState.retryAfterMs));
            emitSocketStatus(socket, sessionHandlers, {
                username: normalized,
                retryAfterMs,
                error: `${normalized} icin bekleme suresi var. ${formatRetryAfterMs(retryAfterMs)} sonra tekrar deneyin.`
            });
            return false;
        }

        const globalGate = canConnectToStreamer(streamerKey, normalized);
        if (!globalGate.ok) {
            emitSocketStatus(socket, sessionHandlers, {
                username: normalized,
                error: globalGate.error
            });
            return false;
        }

        const jitterMs = CONNECT_JITTER_MS > 0 ? Math.floor(Math.random() * CONNECT_JITTER_MS) : 0;
        const delayMs = Math.max(0, queueIndex * CONNECT_SPACING_MS + jitterMs);

        pendingConnects.add(streamerKey);
        emitSocketStatus(socket, sessionHandlers, {
            username: normalized,
            connecting: true,
            queued: true,
            queueDelayMs: delayMs
        });

        const timer = setTimeout(() => {
            pendingConnectTimers.delete(streamerKey);
            pendingConnects.delete(streamerKey);

            if (!socket.connected) {
                return;
            }

            connectStreamerForSocket(normalized);
        }, delayMs);

        pendingConnectTimers.set(streamerKey, timer);
        return true;
    }

    function disconnectStreamerForSocket(username) {
        const normalized = normalizeUsername(username);
        if (!normalized) return false;

        const streamerKey = normalized.toLowerCase();
        clearPendingConnect(streamerKey);

        const handler = sessionHandlers.get(streamerKey);
        if (!handler) return false;

        disconnectHandler(streamerKey, handler, {
            silent: true,
            cooldownMs: MANUAL_RECONNECT_COOLDOWN_MS
        });
        return true;
    }

    function disconnectAllStreamersForSocket() {
        clearAllPendingGiftEvents();

        for (const streamerKey of Array.from(pendingConnects.values())) {
            clearPendingConnect(streamerKey);
            setStreamerCooldown(streamerKey, MANUAL_RECONNECT_COOLDOWN_MS, 'manual_disconnect');
        }

        for (const [streamerKey, handler] of Array.from(sessionHandlers.entries())) {
            disconnectHandler(streamerKey, handler, {
                silent: true,
                cooldownMs: MANUAL_RECONNECT_COOLDOWN_MS
            });
        }

        sessionHandlers.clear();
        pendingConnects.clear();
        pendingConnectTimers.clear();
    }

    // Send snapshot to newly connected tab.
    emitSocketStatus(socket, sessionHandlers, {
        connected: false,
        snapshot: true,
        giftDetectionDelaySeconds: giftDelaySeconds
    });

    socket.on('set-gift-delay', (payload) => {
        const nextDelay = normalizeGiftDelaySeconds(
            payload?.giftDetectionDelaySeconds ?? payload?.seconds ?? payload
        );
        giftDelaySeconds = nextDelay;

        emitSocketStatus(socket, sessionHandlers, {
            giftDetectionDelaySeconds: giftDelaySeconds
        });
    });

    socket.on('register-session-user', (payload) => {
        const userEmail = String(payload?.email || '').trim().toLowerCase();
        const userUid = String(payload?.uid || '').trim();

        const current = liveSocketStates.get(socket.id);
        if (!current) return;

        liveSocketStates.set(socket.id, {
            ...current,
            userEmail: userEmail || current.userEmail || null,
            userUid: userUid || current.userUid || null,
            updatedAt: new Date().toISOString()
        });
    });

    // Connect one or more TikTok lives for only this tab.
    socket.on('connect-tiktok', (payload) => {
        const usernames = sanitizeUsernames(parseUsernames(payload));

        if (usernames.length === 0) {
            emitSocketStatus(socket, sessionHandlers, {
                connected: getConnectedUsernames(sessionHandlers).length > 0,
                error: 'Lutfen en az bir yayinci kullanici adi girin'
            });
            return;
        }

        if (!consumeConnectRequestSlot()) {
            emitSocketStatus(socket, sessionHandlers, {
                error: `Cok hizli baglanma denemesi algilandi. ${formatRetryAfterMs(CONNECT_REQUEST_WINDOW_MS)} sonra tekrar deneyin.`
            });
            return;
        }

        const queuedUsernames = usernames.slice(0, MAX_USERNAMES_PER_CONNECT_REQUEST);
        if (usernames.length > queuedUsernames.length) {
            emitSocketStatus(socket, sessionHandlers, {
                error: `Tek seferde en fazla ${MAX_USERNAMES_PER_CONNECT_REQUEST} yayinci baglatilabilir.`
            });
        }

        let scheduled = 0;
        for (const username of queuedUsernames) {
            console.log(`[TikTok][${socket.id}] Connection request for: ${username}`);
            if (scheduleConnectStreamer(username, scheduled)) {
                scheduled += 1;
            }
        }
    });

    // Disconnect one streamer or all streamers for only this tab.
    socket.on('disconnect-tiktok', (payload) => {
        const usernames = sanitizeUsernames(parseUsernames(payload));

        if (usernames.length === 0) {
            console.log(`[TikTok][${socket.id}] Disconnect all request`);

            disconnectAllStreamersForSocket();

            emitSocketStatus(socket, sessionHandlers, {
                connected: false,
                disconnectedByUser: true,
                username: null
            });
            return;
        }

        for (const username of usernames) {
            console.log(`[TikTok][${socket.id}] Disconnect request for: ${username}`);
            disconnectStreamerForSocket(username);
        }

        emitSocketStatus(socket, sessionHandlers, {
            connected: getConnectedUsernames(sessionHandlers).length > 0,
            disconnectedByUser: true
        });
    });

    socket.on('disconnect', () => {
        disconnectAllStreamersForSocket();
        clearAllPendingGiftEvents();
        failedConnectAttempts.clear();
        streamerCooldowns.clear();
        connectRequestTimestamps = [];
        liveSocketStates.delete(socket.id);

        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
});
