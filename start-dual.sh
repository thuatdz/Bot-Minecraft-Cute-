#!/bin/bash

# Script để chạy đồng thời web server và bot lolicute
echo "🎮 Khởi động PinkMineManager với Bot Lolicute..."
echo "📱 Web server sẽ chạy trên port 5000"
echo "🤖 Bot Lolicute sẽ kết nối đến server Minecraft"

# Chạy đồng thời cả hai server
concurrently \
  --prefix "[WEB]" \
  --prefix "[BOT]" \
  --prefix-colors "magenta,cyan" \
  --kill-others-on-fail \
  "NODE_ENV=development tsx server/index.ts" \
  "tsx server/botlolicute.ts"