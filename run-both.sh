#!/bin/bash

echo "🎮 PinkMineManager - Khởi động môi trường tích hợp"
echo "================================================"
echo "📱 Web Server: http://localhost:5000"
echo "🤖 Bot Environment: Đang khởi động..."
echo "================================================"

# Chạy đồng thời cả web server và dev environment
npx concurrently \
  --prefix "[{name}]" \
  --names "WEB,BOT" \
  --prefix-colors "cyan,yellow" \
  "NODE_ENV=development tsx server/index.ts" \
  "node dev-environment.js"