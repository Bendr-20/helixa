module.exports = {
  apps: [{
    name: 'helixa-bot',
    script: 'index.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '500M',
    restart_delay: 5000,
    max_restarts: 10,
  }],
};
