module.exports = {
  apps: [
    {
      name: 'beyblade',
      script: 'server.js',
      cwd: '/var/www/beyblade/server',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        FIREBASE_WEB_API_KEY: '',
        PREMIUM_ADMIN_EMAILS: '',
        PREMIUM_CODES: '',
        MAX_STREAMERS_PER_TAB: 20,
        MAX_FAILED_CONNECT_ATTEMPTS_PER_STREAMER: 10,
        MAX_USERNAMES_PER_CONNECT_REQUEST: 8,
        CONNECT_REQUEST_WINDOW_MS: 60000,
        MAX_CONNECT_REQUESTS_PER_WINDOW: 12,
        CONNECT_SPACING_MS: 2000,
        CONNECT_JITTER_MS: 1200,
        BASE_FAILURE_COOLDOWN_MS: 30000,
        MAX_FAILURE_COOLDOWN_MS: 600000,
        MANUAL_RECONNECT_COOLDOWN_MS: 10000,
        DISCONNECT_RECONNECT_COOLDOWN_MS: 45000,
        MAX_GLOBAL_ACTIVE_STREAMERS: 40,
        ENABLE_TIKTOK_CHAT_EVENTS: false,
        ENABLE_TIKTOK_SHARE_EVENTS: false
      },
      max_memory_restart: '700M',
      restart_delay: 1000,
      max_restarts: 20,
      out_file: '/var/log/beyblade/out.log',
      error_file: '/var/log/beyblade/error.log',
      merge_logs: true,
      time: true
    }
  ]
};
