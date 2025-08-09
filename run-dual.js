import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎮 Khởi động PinkMineManager với Bot Lolicute...');
console.log('📱 Web server sẽ chạy trên port 5000');
console.log('🤖 Bot Lolicute sẽ kết nối đến server Minecraft');

// Chạy web server
const webServer = spawn('tsx', ['server/index.ts'], {
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'pipe'
});

// Chạy bot lolicute
const botServer = spawn('tsx', ['server/botlolicute.ts'], {
  cwd: __dirname,
  stdio: 'pipe'
});

// Xử lý output từ web server
webServer.stdout.on('data', (data) => {
  console.log(`[WEB] ${data.toString().trim()}`);
});

webServer.stderr.on('data', (data) => {
  console.error(`[WEB] ${data.toString().trim()}`);
});

// Xử lý output từ bot server
botServer.stdout.on('data', (data) => {
  console.log(`[BOT] ${data.toString().trim()}`);
});

botServer.stderr.on('data', (data) => {
  console.error(`[BOT] ${data.toString().trim()}`);
});

// Xử lý khi process kết thúc
webServer.on('close', (code) => {
  console.log(`[WEB] Process exited with code ${code}`);
  if (code !== 0) {
    botServer.kill();
  }
});

botServer.on('close', (code) => {
  console.log(`[BOT] Process exited with code ${code}`);
  if (code !== 0) {
    webServer.kill();
  }
});

// Xử lý tín hiệu thoát
process.on('SIGINT', () => {
  console.log('\n🛑 Đang dừng tất cả services...');
  webServer.kill();
  botServer.kill();
  process.exit(0);
});