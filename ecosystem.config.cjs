// PM2 Ecosystem — DateClone
// Usage:
//   pm2 start ecosystem.config.cjs     (start all)
//   pm2 stop all                        (stop all)
//   pm2 restart all                     (restart all)
//   pm2 logs                            (view logs)
//   pm2 save                            (save process list)
//   pm2 startup                         (auto-start on Windows boot)

module.exports = {
    apps: [
        {
            name: "dateclone-backend",
            script: "server.js",
            cwd: "./backend",
            interpreter: "node",
            watch: false,          // don't watch in production
            autorestart: true,
            restart_delay: 3000,          // wait 3s before restart
            max_restarts: 20,
            min_uptime: "10s",
            env: {
                NODE_ENV: "development",
                PORT: "5000",
            },
            env_production: {
                NODE_ENV: "production",
                PORT: "5000",
            },
            // Log files
            out_file: "./logs/backend-out.log",
            error_file: "./logs/backend-err.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            merge_logs: true,
        },
    ],
};
