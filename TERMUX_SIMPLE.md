# Setup Bot Lolicute trên Termux - Đơn giản

## Cài đặt nhanh (5 phút):

### 1. Cài Termux basics:
```bash
pkg update && pkg upgrade -y
pkg install nodejs npm git -y
```

### 2. Tạo folder và copy files:
```bash
mkdir botloli && cd botloli
```

**Copy những files này vào folder botloli:**
- `package.json`
- `server/botlolicute.ts` 
- `server/index.ts`
- `tsconfig.json`
- Folder `node_modules/` (nếu có)

### 3. Cài dependencies:
```bash
npm install
```

### 4. Chạy bot:
```bash
# Chỉ bot thôi (không cần web)
npm run bot

# Hoặc chạy cả web interface
npm run dev
```

## Files tối thiểu cần có:

### package.json (cần thiết):
```json
{
  "name": "bot-lolicute",
  "scripts": {
    "bot": "tsx server/botlolicute.ts",
    "dev": "concurrently \"npm run web\" \"npm run bot\"",
    "web": "tsx server/index.ts"
  },
  "dependencies": {
    "mineflayer": "^4.20.1",
    "mineflayer-pathfinder": "^2.4.1",
    "tsx": "^4.7.1",
    "concurrently": "^8.2.2"
  }
}
```

### server/botlolicute.ts (main bot):
- Đã có đầy đủ code bot
- Chỉ cần sửa server IP/port

### tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "esModuleInterop": true,
    "strict": true
  }
}
```

## Chạy background:
```bash
# Dùng screen
screen -S bot
npm run bot
# Nhấn Ctrl+A rồi D để tách

# Quay lại: screen -r bot
```

## Sửa server info:
Mở `server/botlolicute.ts` và sửa:
```typescript
const BOT_CONFIG = {
  host: 'your-server.aternos.me',  // Server của bạn
  port: 25565,
  username: 'botlolicute',
  version: '1.19.4'
};
```

**Xong! Bot sẽ chạy trên Termux.**

## Nếu gặp lỗi:
1. **Lỗi tsx**: `npm install -g tsx`
2. **Lỗi permission**: `termux-setup-storage`
3. **Lỗi network**: Kiểm tra wifi/data
4. **Bot không kết nối**: Kiểm tra server IP/port

Bot chạy trên Termux như máy tính bình thường!