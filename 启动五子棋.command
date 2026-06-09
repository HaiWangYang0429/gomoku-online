#!/bin/bash

echo "================================"
echo "   五子棋联机游戏 - 启动中..."
echo "================================"
echo ""

cd "$(dirname "$0")"

echo "[1/3] 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "错误: 未安装 Node.js，请先安装 https://nodejs.org"
    read -p "按回车退出..."
    exit 1
fi
echo "  Node.js $(node --version)"

echo "[2/3] 安装依赖..."
npm install --silent 2>/dev/null

echo "[3/3] 启动游戏服务器..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
node server.js &
SERVER_PID=$!

sleep 2

echo ""
echo "检查 cloudflared..."
if ! command -v cloudflared &> /dev/null; then
    echo "未找到 cloudflared，正在安装..."
    if command -v brew &> /dev/null; then
        brew install cloudflared
    else
        echo "请先安装 cloudflared 或 Homebrew"
        read -p "按回车退出..."
        exit 1
    fi
fi

echo ""
echo "正在建立公网隧道..."
cloudflared tunnel --url http://localhost:3000 --protocol http2 2>&1 | while IFS= read -r line; do
    echo "$line"
    if echo "$line" | grep -o 'https://[^ ]*\.trycloudflare\.com' > /dev/null 2>&1; then
        URL=$(echo "$line" | grep -o 'https://[^ ]*\.trycloudflare\.com')
        echo ""
        echo "============================================"
        echo "  公网链接: $URL"
        echo "  将此链接发给朋友即可对战！"
        echo "============================================"
        echo ""
        if command -v pbcopy &> /dev/null; then
            echo -n "$URL" | pbcopy
            echo "  (链接已自动复制到剪贴板)"
        fi
        echo ""
    fi
done

kill $SERVER_PID 2>/dev/null
