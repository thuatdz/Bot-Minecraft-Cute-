#!/bin/bash

echo "🎮 Khởi động PinkMineManager Development Environment"
echo "📋 Chọn cách chạy:"
echo "1. Chỉ Web Server (port 5000)"
echo "2. Chỉ Bot Lolicute" 
echo "3. Cả hai đồng thời (khuyến nghị)"
echo ""

read -p "Nhập lựa chọn (1-3): " choice

case $choice in
    1)
        echo "🌐 Khởi động Web Server..."
        NODE_ENV=development tsx server/index.ts
        ;;
    2)
        echo "🤖 Khởi động Bot Lolicute..."
        tsx server/botlolicute.ts
        ;;
    3)
        echo "🚀 Khởi động cả hai services..."
        ./dev-environment.js
        ;;
    *)
        echo "❌ Lựa chọn không hợp lệ!"
        exit 1
        ;;
esac