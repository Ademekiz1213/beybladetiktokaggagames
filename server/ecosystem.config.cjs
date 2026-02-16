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
        PREMIUM_CODES: ''
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
