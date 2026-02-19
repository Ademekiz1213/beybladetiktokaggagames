const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const TikTokHandler = require('./tiktokHandler');
const { registerPremiumRoutes, resolveRequestUser, isAdminEmail } = require('./premiumService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const MAX_STREAMERS_PER_TAB = 20;
const MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER = 10;
const liveSocketStates = new Map(); // socketId -> live connection snapshot

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

        const announcement = {
            message,
            sentBy: user.email,
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
    const failedConnectAttempts = new Map(); // streamerKey -> { count, blocked, lastError }

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

    function connectStreamerForSocket(username) {
        const normalized = normalizeUsername(username);
        if (!normalized) return null;

        const streamerKey = normalized.toLowerCase();
        const existing = sessionHandlers.get(streamerKey);
        if (existing) {
            return existing;
        }

        const handler = new TikTokHandler(normalized, {
            onStatus: (status) => {
                const statusPayload = { ...status };

                if (statusPayload.connected) {
                    failedConnectAttempts.delete(streamerKey);
                }

                // Auto-remove dead handler so same streamer can reconnect in this tab.
                if (!status.connecting && !status.connected) {
                    const current = sessionHandlers.get(streamerKey);
                    if (current === handler) {
                        sessionHandlers.delete(streamerKey);
                    }

                    const shouldCountFailure = !handler.hasEverConnected && !status.disconnectedByUser;
                    if (shouldCountFailure) {
                        const previous = failedConnectAttempts.get(streamerKey) || {
                            count: 0,
                            blocked: false,
                            lastError: null
                        };
                        const count = previous.count + 1;
                        const blocked = count >= MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER;

                        failedConnectAttempts.set(streamerKey, {
                            count,
                            blocked,
                            lastError: status.error || previous.lastError || null
                        });

                        statusPayload.failedAttempts = count;
                        statusPayload.connectBlocked = blocked;
                        if (blocked) {
                            statusPayload.error = `${handler.username} icin ${MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER} basarisiz deneme oldu. Bu sekmede tekrar denenmeyecek.`;
                        }
                    }
                }

                emitSocketStatus(socket, sessionHandlers, statusPayload);
            },
            onEvent: (eventName, eventData) => {
                // Important: emit only to this tab.
                socket.emit(eventName, eventData);
            }
        });

        sessionHandlers.set(streamerKey, handler);
        handler.connect();

        return handler;
    }

    function disconnectStreamerForSocket(username) {
        const normalized = normalizeUsername(username);
        if (!normalized) return false;

        const streamerKey = normalized.toLowerCase();
        const handler = sessionHandlers.get(streamerKey);
        if (!handler) return false;

        sessionHandlers.delete(streamerKey);
        handler.disconnect({ silent: true });
        return true;
    }

    // Send snapshot to newly connected tab.
    emitSocketStatus(socket, sessionHandlers, {
        connected: false,
        snapshot: true
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

        for (const username of usernames) {
            const key = username.toLowerCase();
            const existing = sessionHandlers.get(key);
            const failedState = failedConnectAttempts.get(key);

            if (existing) {
                emitSocketStatus(socket, sessionHandlers, {
                    username: existing.username,
                    connected: existing.isConnected,
                    connecting: !existing.isConnected,
                    alreadyTracked: true
                });
                continue;
            }

            if (failedState?.blocked) {
                emitSocketStatus(socket, sessionHandlers, {
                    connected: getConnectedUsernames(sessionHandlers).length > 0,
                    username,
                    connectBlocked: true,
                    failedAttempts: failedState.count,
                    error: `${username} icin 10 deneme limiti doldu. Bu sekmede tekrar denenmeyecek.`
                });
                continue;
            }

            if (sessionHandlers.size >= MAX_STREAMERS_PER_TAB) {
                emitSocketStatus(socket, sessionHandlers, {
                    connected: getConnectedUsernames(sessionHandlers).length > 0,
                    username,
                    error: `Bu sekmede maksimum ${MAX_STREAMERS_PER_TAB} yayinciya baglanabilirsiniz`
                });
                break;
            }

            console.log(`[TikTok][${socket.id}] Connection request for: ${username}`);
            connectStreamerForSocket(username);
        }
    });

    // Disconnect one streamer or all streamers for only this tab.
    socket.on('disconnect-tiktok', (payload) => {
        const usernames = sanitizeUsernames(parseUsernames(payload));

        if (usernames.length === 0) {
            console.log(`[TikTok][${socket.id}] Disconnect all request`);

            for (const handler of sessionHandlers.values()) {
                handler.disconnect({ silent: true });
            }
            sessionHandlers.clear();

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
        for (const handler of sessionHandlers.values()) {
            handler.disconnect({ silent: true });
        }
        sessionHandlers.clear();
        failedConnectAttempts.clear();
        liveSocketStates.delete(socket.id);

        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
});
