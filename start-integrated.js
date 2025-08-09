#!/usr/bin/env node

// Script tích hợp để chạy cả web server và dev environment
const { spawn } = require('child_process');

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
console.log(`${colors.bright}${colors.magenta}🎮 PinkMineManager - Môi trường tích hợp Replit${colors.reset}`);
console.log(`${colors.cyan}📱 Web + Bot Environment khởi động cùng lúc${colors.reset}`);
console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════${colors.reset}\n`);

// Sử dụng concurrently để chạy cả hai service
const concurrentlyProcess = spawn('npx', [
  'concurrently',
  '--prefix', '[{name}]',
  '--names', 'WEB,BOT',
  '--prefix-colors', 'cyan,yellow',
  'NODE_ENV=development tsx server/index.ts',
  'node dev-environment.js'
], {
  stdio: 'inherit',
  env: { ...process.env }
});

concurrentlyProcess.on('close', (code) => {
  console.log(`\n${colors.red}🛑 Tất cả dịch vụ đã dừng với mã: ${code}${colors.reset}`);
  process.exit(code);
});

// Xử lý tín hiệu thoát
process.on('SIGINT', () => {
  console.log(`\n${colors.bright}${colors.red}🛑 Đang dừng tất cả dịch vụ...${colors.reset}`);
  concurrentlyProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  concurrentlyProcess.kill('SIGTERM');
});

console.log(`${colors.green}✅ Cả Web Server và Bot Environment đã khởi động!${colors.reset}\n`);