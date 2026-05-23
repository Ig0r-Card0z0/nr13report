module.exports = {
  apps: [
    {
      name: 'nr13-backend',
      cwd: './backend',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 9000,
        FRONTEND_URL: 'https://relatorios.nortendengenharia.com.br',
        UPLOADS_DIR: '/root/nr13report/uploads',
      },
    },
    {
      name: 'nr13-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'https://relatorios.nortendengenharia.com.br',
      },
    },
  ],
};