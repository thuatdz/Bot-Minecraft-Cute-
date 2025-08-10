# Minecraft Bot Manager - Cute Edition 🌸

Ứng dụng web quản lý bot Minecraft với giao diện cute màu hồng, được xây dựng bằng React và Express.js.

## ✨ Tính năng chính

- 🤖 Quản lý bot Minecraft Java Edition
- 🎮 Giao diện web đẹp với theme màu hồng kawaii
- 📊 Theo dõi trạng thái bot real-time
- 💬 Console web để giao tiếp với bot
- 🔧 Cấu hình bot linh hoạt
- 🎵 Nhạc nền tự động phát
- 📱 Responsive design

## 🚀 Hướng dẫn cài đặt

### Yêu cầu hệ thống
- Node.js 18+ 
- npm hoặc yarn
- PostgreSQL database (hoặc sử dụng Neon Database)

### 1. Clone repository
```bash
git clone <repository-url>
cd minecraft-bot-manager
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình môi trường
Tạo file `.env` trong thư mục gốc:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/botmanager

# Session Secret
SESSION_SECRET=your-very-secret-key-here

# Optional: Google AI (for advanced features)
GOOGLE_API_KEY=your-google-ai-key
```

### 4. Khởi tạo database
```bash
npm run db:push
```

### 5. Chạy ứng dụng

#### Development mode (recommended)
```bash
npm run dev
```
App sẽ chạy tại: http://localhost:5000

#### Production mode
```bash
npm run build
npm start
```

## 📁 Cấu trúc project

```
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/         # Các trang
│   │   └── lib/           # Utilities
│   └── index.html
├── server/                 # Backend Express
│   ├── botmineflayer.ts   # Logic bot Minecraft
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Database operations
│   └── index.ts           # Main server
├── shared/
│   └── schema.ts          # Shared types & validation
└── package.json
```

## 🎮 Hướng dẫn sử dụng

### 1. Thêm bot mới
- Truy cập giao diện web
- Click "Thêm Bot"
- Nhập thông tin server Minecraft:
  - Server IP/hostname
  - Port (mặc định 25565)
  - Username bot
  - Phiên bản Minecraft
  - Loại authentication (Microsoft/Mojang/Offline)

### 2. Quản lý bot
- **Start/Stop**: Bật/tắt bot
- **Console**: Xem log và gửi lệnh
- **Config**: Thay đổi cài đặt bot
- **Status**: Theo dõi health, food, vị trí

### 3. Tính năng bot
- Tự động chào hỏi khi join server
- Di chuyển ngẫu nhiên
- Trả lời chat đơn giản
- Tự vệ khi bị tấn công
- Tự động reconnect khi disconnect

## 🔧 Scripts có sẵn

```bash
# Development
npm run dev          # Chạy cả web và bot
npm run web          # Chỉ chạy web server
npm run bot          # Chỉ chạy bot

# Production
npm run build        # Build for production
npm start            # Start production server

# Database
npm run db:push      # Push schema changes to DB

# Type checking
npm run check        # TypeScript type check
```

## 🌐 Deploy lên các platform

### Replit
1. Import project vào Replit
2. Cài đặt environment variables
3. Chạy `npm run dev`

### Railway.app
1. Connect GitHub repo với Railway
2. Set environment variables
3. Deploy tự động

### Render.com
1. Connect GitHub repo
2. Build command: `npm run build`
3. Start command: `npm start`

### Heroku
1. `heroku create your-app-name`
2. `heroku addons:create heroku-postgresql`
3. `git push heroku main`

## 🛠️ Customization

### Thay đổi theme
Chỉnh sửa file `client/src/index.css` để thay đổi màu sắc:

```css
:root {
  --primary: 330 81% 60%;        /* Màu hồng chính */
  --primary-foreground: 0 0% 98%; /* Chữ trên nền hồng */
  /* ... các màu khác */
}
```

### Thêm tính năng bot
Chỉnh sửa `server/botmineflayer.ts` để thêm:
- Lệnh chat mới
- Hành vi tự động
- Tương tác với game

## 🐛 Troubleshooting

### Bot không kết nối được
- Kiểm tra server IP và port
- Đảm bảo server Minecraft online
- Kiểm tra authentication type
- Xem log trong console

### Database errors
- Kiểm tra DATABASE_URL
- Chạy `npm run db:push` để sync schema
- Đảm bảo PostgreSQL đang chạy

### Port bị chiếm
- Thay đổi PORT trong .env
- Hoặc kill process đang dùng port 5000

## 📝 Changelog

### v1.0.0
- Giao diện web cơ bản
- Quản lý multiple bots
- Real-time console
- Responsive design
- Kawaii theme

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push và tạo Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 👥 Credits

Được phát triển với ❤️ bởi cộng đồng Minecraft Việt Nam.

---

**Lưu ý**: Bot này chỉ hoạt động với Minecraft Java Edition, không hỗ trợ Pocket Edition (PE/Bedrock).