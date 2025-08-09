#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bright}${colors.magenta}🎮 PinkMineManager - Replit Integrated Environment${colors.reset}`);
console.log(`${colors.cyan}📱 Web Interface: Cổng 5000${colors.reset}`);
console.log(`${colors.yellow}🤖 Bot Development: Node Environment${colors.reset}`);
console.log(`${colors.green}Nhấn Ctrl+C để dừng tất cả dịch vụ${colors.reset}`);
console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}\n`);

// Khởi động Web Server (Express + Vite)
console.log(`${colors.green}🌐 [WEB]${colors.reset} Đang khởi động web server...`);
const webServer = spawn('tsx', ['server/index.ts'], {
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'pipe'
});

// Khởi động Dev Environment (Bot development environment)
console.log(`${colors.yellow}🤖 [BOT]${colors.reset} Đang khởi động môi trường phát triển bot...`);
const devEnv = spawn('node', ['dev-environment.js'], {
  cwd: __dirname,
  env: { ...process.env },
  stdio: 'pipe'
});

// Web Server Output Handling
webServer.stdout.on('data', (data) => {
  const message = data.toString().trim();
  if (message) {
    console.log(`${colors.cyan}🌐 [WEB]${colors.reset} ${message}`);
  }
});

webServer.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message) {
    console.log(`${colors.red}🌐 [WEB ERROR]${colors.reset} ${message}`);
  }
});

// Dev Environment Output Handling
devEnv.stdout.on('data', (data) => {
  const message = data.toString().trim();
  if (message) {
    console.log(`${colors.yellow}🤖 [BOT]${colors.reset} ${message}`);
  }
});

devEnv.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message) {
    console.log(`${colors.red}🤖 [BOT ERROR]${colors.reset} ${message}`);
  }
});

// Xử lý khi các process kết thúc
webServer.on('close', (code) => {
  console.log(`${colors.red}🌐 [WEB]${colors.reset} Process exited with code ${code}`);
});

devEnv.on('close', (code) => {
  console.log(`${colors.red}🤖 [BOT]${colors.reset} Process exited with code ${code}`);
});

// Xử lý tín hiệu thoát để đóng tất cả processes
function cleanup() {
  console.log(`\n${colors.bright}${colors.red}🛑 Đang dừng tất cả dịch vụ...${colors.reset}`);
  
  webServer.kill('SIGTERM');
  devEnv.kill('SIGTERM');
  
  setTimeout(() => {
    webServer.kill('SIGKILL');
    devEnv.kill('SIGKILL');
    process.exit(0);
  }, 3000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Hiển thị trạng thái sau 3 giây
setTimeout(() => {
  console.log(`\n${colors.bright}${colors.green}✅ Tất cả dịch vụ đã khởi động thành công!${colors.reset}`);
  console.log(`${colors.cyan}📱 Truy cập ứng dụng tại: http://localhost:5000${colors.reset}\n`);
}, 3000);