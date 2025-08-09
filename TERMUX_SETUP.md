# Hướng dẫn chạy Bot Lolicute trên Termux

## Bước 1: Cài đặt môi trường Termux

### Cập nhật Termux
```bash
pkg update && pkg upgrade -y
```

### Cài đặt các package cần thiết
```bash
# Cài Node.js và npm
pkg install nodejs npm git -y

# Kiểm tra phiên bản
node --version
npm --version
```

## Bước 2: Tải và setup project

### Clone project từ GitHub (nếu có)
```bash
# Nếu bạn có repo GitHub
git clone <your-repo-url>
cd <project-folder>

# Hoặc tạo folder mới và copy files
mkdir bot-lolicute
cd bot-lolicute
```

### Copy tất cả files cần thiết vào Termux:
- `package.json`
- `server/` folder (tất cả files .ts)
- `shared/` folder
- `client/` folder
- `tsconfig.json`
- `vite.config.ts`
- `tailwind.config.ts`
- `postcss.config.js`
- `components.json`
- `drizzle.config.ts`

## Bước 3: Cài đặt dependencies

```bash
# Cài tất cả dependencies
npm install

# Nếu có lỗi, thử clear cache
npm cache clean --force
npm install
```

## Bước 4: Setup database (tùy chọn)

### Nếu muốn dùng SQLite thay vì PostgreSQL:
```bash
# Cài SQLite
pkg install sqlite

# Sửa file drizzle.config.ts để dùng SQLite
```

### Nếu muốn dùng PostgreSQL:
```bash
# Cài PostgreSQL
pkg install postgresql

# Khởi động PostgreSQL service
```

## Bước 5: Chạy bot

### Chỉ chạy bot (không cần web interface):
```bash
# Chạy trực tiếp bot
npm run bot

# Hoặc
node server/botlolicute.js
```

### Chạy cả web interface:
```bash
# Chạy cả web + bot
npm run dev
```

## Bước 6: Cấu hình server Minecraft

### Sửa file `server/botlolicute.ts`:
```typescript
const BOT_CONFIG = {
  host: 'your-server-ip',        // IP server Minecraft
  port: 25565,                   // Port server
  username: 'botlolicute',       // Tên bot
  version: '1.19.4',            // Phiên bản MC
  auth: 'offline'               // Offline mode
};
```

## Bước 7: Chạy trong background

### Dùng screen để chạy background:
```bash
# Cài screen
pkg install screen

# Tạo session mới
screen -S botloli

# Chạy bot
npm run bot

# Tách khỏi session: Ctrl+A, D
# Quay lại session: screen -r botloli
```

### Dùng nohup:
```bash
# Chạy background với log
nohup npm run bot > bot.log 2>&1 &

# Xem log
tail -f bot.log

# Dừng bot
pkill -f "botlolicute"
```

## Bước 8: Tối ưu cho Termux

### Tạo script khởi động nhanh:
```bash
# Tạo file start.sh
cat > start.sh << 'EOF'
#!/bin/bash
echo "🚀 Khởi động Bot Lolicute..."
cd /data/data/com.termux/files/home/bot-lolicute
npm run bot
EOF

# Cho phép execute
chmod +x start.sh

# Chạy
./start.sh
```

### Auto-restart khi crash:
```bash
# Tạo file restart.sh
cat > restart.sh << 'EOF'
#!/bin/bash
while true; do
    echo "🚀 Khởi động bot..."
    npm run bot
    echo "💔 Bot đã dừng, khởi động lại sau 10 giây..."
    sleep 10
done
EOF

chmod +x restart.sh
./restart.sh
```

## Lưu ý quan trọng:

### 1. RAM và CPU:
- Bot sẽ dùng khoảng 50-100MB RAM
- Nếu thiết bị yếu, có thể tắt một số tính năng như auto-explore

### 2. Kết nối mạng:
- Bot cần kết nối internet ổn định
- Nếu dùng data di động, chú ý dung lượng

### 3. Battery optimization:
- Tắt battery optimization cho Termux
- Hoặc dùng Termux:Boot để auto-start

### 4. Backup:
```bash
# Backup toàn bộ project
tar -czf bot-backup.tar.gz bot-lolicute/

# Restore
tar -xzf bot-backup.tar.gz
```

## Troubleshooting:

### Lỗi permission:
```bash
termux-setup-storage
```

### Lỗi Node.js:
```bash
# Cài phiên bản Node.js khác
pkg install nodejs-lts
```

### Lỗi network:
```bash
# Kiểm tra kết nối
ping google.com
```

## Files quan trọng cần có:

1. **package.json** - Dependencies và scripts
2. **server/botlolicute.ts** - Main bot code
3. **server/index.ts** - Web server (tùy chọn)
4. **tsconfig.json** - TypeScript config
5. **Tất cả dependencies** trong node_modules

Bot sẽ hoạt động hoàn toàn trên Termux như trên máy tính thường!