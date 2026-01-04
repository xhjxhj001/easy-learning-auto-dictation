#!/bin/bash
# 生产环境预览脚本（用于手机性能测试）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 加载环境变量
set -a
source ./.env
set +a

PORT=${VITE_PORT:-3000}

echo "正在构建生产版本..."
npm run build

echo "正在启动生产预览 (端口: $PORT)..."
# 使用 vite preview 启动，这会加载混淆压缩后的单个 bundle 文件，速度极快
nohup npx vite preview --port $PORT --host 0.0.0.0 > app.log 2>&1 &

echo "预览服务已在后台启动。"
echo "请访问: http://您的电脑IP:$PORT"

