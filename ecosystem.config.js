module.exports = {
    apps: [
        {
            name: 'ukombozini-backend',
            script: 'server.js',
            cwd: './backend',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 5000
            }
        },
        {
            name: 'ukombozini-frontend',
            script: 'npm',
            args: 'start',
            cwd: './frontend',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        }
    ]
};
