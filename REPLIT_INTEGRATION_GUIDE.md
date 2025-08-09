# Hướng dẫn tích hợp Replit - PinkMineManager

## Tổng quan
Đã tạo thành công các script tích hợp để khi bấm nút **Start** của Replit sẽ khởi động đồng thời:
- 🌐 **Web Server** (Express + React) trên port 5000  
- 🤖 **Bot Development Environment** (dev-environment.js)

## Các script đã tạo

### 1. `start-replit.js` 
Script chính với quản lý process đầy đủ và logging màu sắc
```bash
node start-replit.js
```

### 2. `run-both.sh`
Script bash đơn giản sử dụng concurrently
```bash
./run-both.sh
```

### 3. `start-integrated.js`
Script Node.js sử dụng concurrently với cấu hình tối ưu

## Cách tích hợp vào nút Start của Replit

### Phương án 1: Thay đổi lệnh workflow (Được khuyến nghị)
Replit Admin có thể cập nhật workflow args trong file `.replit`:
```toml
[[workflows.workflow.tasks]]
task = "shell.exec"
args = "./run-both.sh"  # hoặc "node start-replit.js"
waitForPort = 5000
```

### Phương án 2: Tạo workflow mới
Tạo workflow mới trong Replit Settings với lệnh:
```bash
./run-both.sh
```

### Phương án 3: Chạy thủ công
Hiện tại có thể test bằng cách chạy trong Terminal:
```bash
# Chạy script bash
./run-both.sh

# Hoặc chạy script Node.js  
node start-replit.js
```

## Tính năng của môi trường tích hợp

### ✅ Đã hoạt động
- Khởi động đồng thời web server và bot environment
- Logging màu sắc phân biệt các service
- Quản lý process tự động (cleanup khi thoát)
- WebSocket console real-time
- Database PostgreSQL tích hợp

### 🎯 Lợi ích
- **Tiện lợi**: Chỉ cần 1 nút Start cho tất cả
- **Đồng bộ**: Web và Bot environment luôn chạy cùng nhau  
- **Monitoring**: Console logs từ cả hai service
- **Stable**: Process management tự động

## Kiểm tra hoạt động

Khi script chạy thành công, bạn sẽ thấy:
```
🎮 PinkMineManager - Khởi động môi trường tích hợp
================================================
📱 Web Server: http://localhost:5000
🤖 Bot Environment: Đang khởi động...
================================================
[WEB] 10:24:48 AM [express] serving on port 5000
[BOT] 🤖 BOT: STARTING - Launching Bot Lolicute for Minecraft server
```

## Trạng thái hiện tại
- ✅ Scripts đã được tạo và test thành công
- ✅ Cả hai service khởi động đồng thời  
- ✅ WebSocket console hoạt động bình thường
- ✅ Database PostgreSQL kết nối ổn định
- 🔄 Chờ cập nhật workflow configuration

## Yêu cầu kết thúc
Để hoàn tất tích hợp, cần cập nhật lệnh workflow từ:
```bash
npm run dev  
```
Thành:
```bash  
./run-both.sh
```

Khi đó nút **Start** của Replit sẽ khởi động cả Web Server và Bot Environment cùng lúc!