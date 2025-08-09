# 🎮 Cấu hình nút Play cho PinkMineManager

## Hướng dẫn thiết lập Workflow để nút Play chạy cả Web + Bot

### Bước 1: Tạo Workflow mới
1. Mở sidebar bên trái và tìm **"Workflows"** 
2. Hoặc nhấn `Cmd+K` (Mac) / `Ctrl+K` (Windows) và tìm "Workflows"
3. Click **"+ New Workflow"**

### Bước 2: Cấu hình Workflow
**Tên workflow:** `PinkMineManager Full Environment`

**Execution mode:** `Sequential` (chạy tuần tự)

### Bước 3: Thêm Task
Click **"+ Add Task"** và chọn **"Execute Shell Command"**

**Command to run:**
```bash
node start-bot-environment.js
```

**Wait for port:** `5000`

### Bước 4: Gán làm nút Play mặc định
1. Trong workflow vừa tạo, click menu 3 chấm (⋯)
2. Chọn **"Set as Run button"**
3. Hoặc click dropdown bên cạnh nút Play và chọn workflow

## 🚀 Kết quả mong đợi

Khi nhấn nút Play (màu xanh), bạn sẽ thấy:

```
╔═══════════════════════════════════════════════════════════╗
║                 🎮 PinkMineManager                        ║
║               Development Environment                     ║
╚═══════════════════════════════════════════════════════════╝
📱 Web Server: http://localhost:5000
🤖 Bot Lolicute: Connecting to Minecraft server
🔧 Status: Initializing services...
Press Ctrl+C to stop all services

[time] 🌐 WEB Starting Express server...
[time] 🌐 WEB ✅ Server is ready on port 5000
[time] 🤖 BOT Launching Bot Lolicute...
[time] 🤖 BOT ✅ Bot connected to Minecraft server
```

## 📋 Scripts có sẵn

Nếu không muốn dùng workflow, bạn có thể chạy trực tiếp:

```bash
# Chạy cả web + bot với UI đẹp
node start-bot-environment.js

# Hoặc dùng development environment
node dev-environment.js

# Hoặc menu lựa chọn
./start-dev.sh
```

## 🔧 Khắc phục sự cố

**Lỗi port 5000 đã được sử dụng:**
- Dừng workflow hiện tại trước khi chạy script mới
- Hoặc dùng `pkill -f "tsx server/index.ts"`

**Bot không kết nối được:**
- Kiểm tra server Minecraft có đang online không
- Kiểm tra phiên bản Minecraft trong `server/botlolicute.ts`

**Muốn thay đổi server Minecraft:**
- Sửa host và port trong file `server/botlolicute.ts`