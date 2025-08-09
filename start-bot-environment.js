#!/usr/bin/env node

// Script chạy khi nhấn nút Play của Replit
// Chạy đồng thời web server và bot lolicute với UI đẹp

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import WebSocket, { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
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

// Clear console và hiển thị banner
console.clear();

const bannerLines = [
  `${colors.bright}${colors.magenta}╔═══════════════════════════════════════════════════════════╗${colors.reset}`,
  `${colors.bright}${colors.magenta}║                 🎮 PinkMineManager                        ║${colors.reset}`,
  `${colors.bright}${colors.magenta}║               Development Environment                     ║${colors.reset}`,
  `${colors.bright}${colors.magenta}╚═══════════════════════════════════════════════════════════╝${colors.reset}`,
  `${colors.cyan}📱 Web Server: ${colors.bright}http://localhost:5000${colors.reset}`,
  `${colors.yellow}🤖 Bot Lolicute: ${colors.bright}Connecting to Minecraft server${colors.reset}`,
  `${colors.green}🔧 Status: ${colors.bright}Initializing services...${colors.reset}`,
  `${colors.dim}Press Ctrl+C to stop all services${colors.reset}\n`
];

bannerLines.forEach(line => {
  console.log(line);
  console.error(line); // Gửi đến stderr để Replit console chắc chắn nhận được
});

// Khởi tạo WebSocket để gửi logs đến frontend console
let wsClients = [];

// Tạo WebSocket server đơn giản để gửi logs
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  wsClients.push(ws);
  
  ws.on('close', () => {
    wsClients = wsClients.filter(client => client !== ws);
  });
});

// Hàm gửi log đến tất cả WebSocket clients
function sendToConsole(message) {
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({ 
          type: 'log', 
          message: message,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        // Client đã disconnect
      }
    }
  });
}

function log(prefix, color, message) {
  const timestamp = new Date().toLocaleTimeString();
  const icon = prefix === 'WEB' ? '🌐' : prefix === 'BOT' ? '🤖' : '⚙️';
  const formattedMessage = `${color}[${timestamp}] ${icon} ${prefix}${colors.reset} ${message}`;
  const plainMessage = `[${timestamp}] ${icon} ${prefix} ${message}`;
  
  // Hiển thị trong terminal với màu sắc
  console.log(formattedMessage);
  
  // Gửi plain text đến console.error để Replit console chắc chắn nhận được
  console.error(plainMessage);
  
  // Gửi đến WebSocket clients (cho browser console)
  sendToConsole(plainMessage);
}

// Khởi động web server
log('WEB', colors.cyan, 'Starting Express server...');
const webServer = spawn('tsx', ['server/index.ts'], {
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'pipe'
});

// Xử lý output web server
webServer.stdout.on('data', (data) => {
  const message = data.toString().trim();
  if (message) {
    if (message.includes('serving on port')) {
      log('WEB', colors.green, '✅ Server is ready on port 5000');
    } else {
      log('WEB', colors.cyan, message);
    }
  }
});

webServer.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message && !message.includes('ExperimentalWarning')) {
    log('WEB', colors.red, `ERROR: ${message}`);
  }
});

// Khởi động bot sau 3 giây
setTimeout(() => {
  log('BOT', colors.yellow, 'Launching Bot Lolicute...');
  
  const botServer = spawn('tsx', ['server/botlolicute.ts'], {
    cwd: __dirname,
    stdio: 'pipe'
  });

  // Xử lý output bot server
  botServer.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      if (message.includes('đã tham gia server')) {
        log('BOT', colors.green, '✅ Bot connected to Minecraft server');
      } else if (message.includes('Khởi động Bot')) {
        log('BOT', colors.yellow, 'Initializing Bot Lolicute...');
      } else {
        log('BOT', colors.yellow, message);
      }
    }
  });

  botServer.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message && !message.includes('ExperimentalWarning')) {
      if (message.includes('Server version')) {
        log('BOT', colors.red, '❌ Minecraft server version incompatible');
      } else if (message.includes('ECONNREFUSED')) {
        log('BOT', colors.red, '❌ Cannot connect to Minecraft server');
      } else {
        log('BOT', colors.red, `ERROR: ${message}`);
      }
    }
  });

  botServer.on('close', (code) => {
    if (code !== 0) {
      log('BOT', colors.red, `Process exited with code ${code}`);
      log('BOT', colors.yellow, 'Restarting bot in 5 seconds...');
      setTimeout(() => {
        spawn('tsx', ['server/botlolicute.ts'], {
          cwd: __dirname,
          stdio: 'inherit'
        });
      }, 5000);
    }
  });

  // Cleanup cho bot
  process.on('SIGINT', () => {
    log('SYS', colors.red, 'Stopping Bot Lolicute...');
    botServer.kill('SIGINT');
  });

}, 3000);

// Xử lý web server events
webServer.on('close', (code) => {
  log('WEB', colors.red, `Web server exited with code ${code}`);
  process.exit(code);
});

// Cleanup chính
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

// Hiển thị thông tin trạng thái mỗi 30 giây
setInterval(() => {
  log('SYS', colors.dim, 'Services running... Web + Bot active');
}, 30000);