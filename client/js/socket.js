// Socket.IO Client Manager
class SocketManager {
    constructor() {
        this.socket = null;
        this.eventHandlers = {};
    }

    connect() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('[Socket] Connected to server');
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

    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    _trigger(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach((handler) => handler(data));
        }
    }
}

window.socketManager = new SocketManager();
