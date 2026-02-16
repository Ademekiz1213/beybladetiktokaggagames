const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const TikTokHandler = require('./tiktokHandler');
const { registerPremiumRoutes } = require('./premiumService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const MAX_STREAMERS_PER_TAB = 20;

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

function emitSocketStatus(socket, handlers, payload = {}) {
    const connectedUsernames = getConnectedUsernames(handlers);

    socket.emit('tiktok-status', {
        globalConnected: connectedUsernames.length > 0,
        connectedCount: connectedUsernames.length,
        connectedUsernames,
        trackedCount: handlers.size,
        trackedUsernames: getTrackedUsernames(handlers),
        ...payload
    });
}

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Each tab/socket gets isolated streamer handlers.
    const sessionHandlers = new Map(); // streamerKey -> TikTokHandler

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
                // Auto-remove dead handler so same streamer can reconnect in this tab.
                if (!status.connecting && !status.connected) {
                    const current = sessionHandlers.get(streamerKey);
                    if (current === handler) {
                        sessionHandlers.delete(streamerKey);
                    }
                }

                emitSocketStatus(socket, sessionHandlers, status);
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

            if (existing) {
                emitSocketStatus(socket, sessionHandlers, {
                    username: existing.username,
                    connected: existing.isConnected,
                    connecting: !existing.isConnected,
                    alreadyTracked: true
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

        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
});
