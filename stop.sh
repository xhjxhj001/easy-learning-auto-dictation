#!/bin/bash

# 听写学习应用停止脚本

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PID 文件
PID_FILE="$SCRIPT_DIR/.app.pid"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  听写学习应用停止脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查 PID 文件是否存在
if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}服务未在运行（PID 文件不存在）${NC}"
    
    # 尝试通过端口号查找进程
    if [ -f ".env" ]; then
        source ./.env
        PORT=${VITE_PORT:-3000}
        
        # 查找占用该端口的进程
        PID=$(lsof -ti:$PORT 2>/dev/null)
        if [ -n "$PID" ]; then
            echo -e "${YELLOW}发现端口 $PORT 被进程 $PID 占用${NC}"
            read -p "是否要终止该进程？(y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                kill $PID 2>/dev/null
                sleep 1
                if ps -p $PID > /dev/null 2>&1; then
                    kill -9 $PID 2>/dev/null
                fi
                echo -e "${GREEN}进程已终止${NC}"
            fi
        fi
    fi
    exit 0
fi

# 读取 PID
APP_PID=$(cat "$PID_FILE")

echo -e "${YELLOW}正在停止服务 (PID: $APP_PID)...${NC}"

# 检查进程是否存在
if ! ps -p $APP_PID > /dev/null 2>&1; then
    echo -e "${YELLOW}进程 $APP_PID 已不存在${NC}"
    rm -f "$PID_FILE"
    exit 0
fi

# 尝试优雅停止（SIGTERM）
kill $APP_PID 2>/dev/null

# 等待进程结束
WAIT_TIME=0
MAX_WAIT=10

while ps -p $APP_PID > /dev/null 2>&1; do
    if [ $WAIT_TIME -ge $MAX_WAIT ]; then
        echo -e "${YELLOW}进程未响应，强制终止...${NC}"
        kill -9 $APP_PID 2>/dev/null
        break
    fi
    sleep 1
    WAIT_TIME=$((WAIT_TIME + 1))
done

# 同时终止可能的子进程（node 进程）
pkill -f "vite" 2>/dev/null

# 清理 PID 文件
rm -f "$PID_FILE"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  服务已停止${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

