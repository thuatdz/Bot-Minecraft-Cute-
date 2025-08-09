#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorLog(prefix, color, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${timestamp}] ${prefix}${colors.reset} ${message}`);
}

function startupLog(service, status, details) {
  const icons = {
    WEB: '🌐',
    BOT: '🤖',
    SYS: '⚙️'
  };
  console.log(`${colors.bright}${icons[service] || '📋'} ${service}${colors.reset}: ${status} - ${details}`);
}

console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bright}${colors.magenta}🎮 PinkMineManager Development Environment${colors.reset}`);
console.log(`${colors.cyan}📱 Web Server: http://localhost:5000${colors.reset}`);
console.log(`${colors.yellow}🤖 Bot Lolicute: Connecting to Minecraft server${colors.reset}`);
console.log(`${colors.green}Press Ctrl+C to stop all services${colors.reset}`);
console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}\n`);

// Khởi động thông báo
startupLog('WEB', 'STARTING', 'Initializing Express server on port 5000');

// Spawn web server
const webServer = spawn('tsx', ['server/index.ts'], {
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'pipe'
});

// Spawn bot server với delay 3 giây
setTimeout(() => {
  startupLog('BOT', 'STARTING', 'Launching Bot Lolicute for Minecraft server');
  
  const botServer = spawn('tsx', ['server/botlolicute.ts'], {
    cwd: __dirname,
    stdio: 'pipe'
  });

  // Handle bot server output
  botServer.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) colorLog('BOT', colors.yellow, message);
  });

  botServer.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) colorLog('BOT', colors.red, `ERROR: ${message}`);
  });

  botServer.on('close', (code) => {
    colorLog('BOT', colors.red, `Process exited with code ${code}`);
    if (code !== 0) {
      colorLog('BOT', colors.yellow, 'Restarting bot in 5 seconds...');
      setTimeout(() => {
        spawn('tsx', ['server/botlolicute.ts'], {
          cwd: __dirname,
          stdio: 'inherit'
        });
      }, 5000);
    }
  });

  // Handle cleanup for bot
  process.on('SIGINT', () => {
    colorLog('SYS', colors.red, 'Stopping Bot Lolicute...');
    botServer.kill('SIGINT');
  });

}, 3000);

// Handle web server output
webServer.stdout.on('data', (data) => {
  const message = data.toString().trim();
  if (message) colorLog('WEB', colors.cyan, message);
});

webServer.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message) colorLog('WEB', colors.red, `ERROR: ${message}`);
});

webServer.on('close', (code) => {
  colorLog('WEB', colors.red, `Process exited with code ${code}`);
  process.exit(code);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log(`\n${colors.red}🛑 Stopping all services...${colors.reset}`);
  webServer.kill('SIGINT');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  webServer.kill('SIGTERM');
  process.exit(0);
});