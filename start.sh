#!/bin/bash

# 听写学习应用启动脚本

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PID 文件和日志文件
PID_FILE="$SCRIPT_DIR/.app.pid"
LOG_FILE="$SCRIPT_DIR/app.log"
DEPS_HASH_FILE="$SCRIPT_DIR/.deps.hash"

# 默认模式
MODE="dev"

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--prod)
            MODE="prod"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  听写学习应用启动脚本 [模式: $MODE]${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否已经在运行
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}服务已在运行中 (PID: $OLD_PID)${NC}"
        echo -e "${YELLOW}如需重启，请先运行 ./stop.sh 或 ./restart.sh${NC}"
        exit 0
    else
        # PID 文件存在但进程不存在，清理
        rm -f "$PID_FILE"
    fi
fi

# 检查.env文件是否存在
if [ ! -f .env ]; then
    echo -e "${YELLOW}警告: .env 文件不存在，正在创建示例文件...${NC}"
    cat > .env << EOF
# 百度OCR API密钥
# 请到 https://console.bce.baidu.com/ai/#/ai/ocr/overview/index 申请
VITE_BAIDU_OCR_API_KEY=你的百度OCR_API密钥

# 服务监听端口（可选，默认3000）
VITE_PORT=3000
EOF
    echo -e "${YELLOW}已创建 .env 文件，请编辑后重新运行此脚本${NC}"
    exit 1
fi

# 加载并导出环境变量
set -a
source ./.env
set +a

# 校验必需的配置项
echo -e "${GREEN}正在校验配置文件...${NC}"

MISSING_CONFIG=false

# 检查百度OCR API密钥
if [ -z "$VITE_BAIDU_OCR_API_KEY" ] || [ "$VITE_BAIDU_OCR_API_KEY" = "你的百度OCR_API密钥" ]; then
    echo -e "${RED}✗ 错误: VITE_BAIDU_OCR_API_KEY 未配置或使用默认值${NC}"
    echo -e "${YELLOW}  请在 .env 文件中设置正确的百度OCR API密钥${NC}"
    MISSING_CONFIG=true
else
    echo -e "${GREEN}✓ VITE_BAIDU_OCR_API_KEY 已配置${NC}"
fi

# 检查端口号
if [ -z "$VITE_PORT" ]; then
    export VITE_PORT=3000
    echo -e "${YELLOW}⚠ VITE_PORT 未设置，使用默认值: 3000${NC}"
else
    if ! [[ "$VITE_PORT" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}✗ 错误: VITE_PORT 必须是数字${NC}"
        MISSING_CONFIG=true
    else
        export VITE_PORT
        echo -e "${GREEN}✓ VITE_PORT 已配置: $VITE_PORT${NC}"
    fi
fi

# 如果有配置缺失，退出
if [ "$MISSING_CONFIG" = true ]; then
    echo ""
    echo -e "${RED}配置校验失败，请修复上述问题后重新运行${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}配置校验通过！${NC}"
echo ""

# 计算 package.json 的 hash，用于检测依赖变化
CURRENT_DEPS_HASH=$(md5sum package.json 2>/dev/null | cut -d' ' -f1 || md5 -q package.json 2>/dev/null)

# 检查是否需要安装/更新依赖
NEED_INSTALL=false

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}检测到 node_modules 不存在${NC}"
    NEED_INSTALL=true
elif [ -f "$DEPS_HASH_FILE" ]; then
    OLD_DEPS_HASH=$(cat "$DEPS_HASH_FILE")
    if [ "$CURRENT_DEPS_HASH" != "$OLD_DEPS_HASH" ]; then
        echo -e "${YELLOW}检测到 package.json 已更新，需要重新安装依赖${NC}"
        NEED_INSTALL=true
    fi
else
    # 没有 hash 文件，首次运行
    NEED_INSTALL=true
fi

if [ "$NEED_INSTALL" = true ]; then
    echo -e "${YELLOW}正在安装依赖...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}依赖安装失败，请检查网络连接和npm配置${NC}"
        exit 1
    fi
    # 保存当前 hash
    echo "$CURRENT_DEPS_HASH" > "$DEPS_HASH_FILE"
    echo -e "${GREEN}依赖安装完成${NC}"
    echo ""
fi

# 显示启动信息
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  启动信息${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "运行模式: ${GREEN}${MODE}${NC}"
echo -e "监听地址: ${GREEN}0.0.0.0${NC}"
echo -e "监听端口: ${GREEN}${VITE_PORT}${NC}"
echo -e "允许访问: ${GREEN}所有域名${NC}"
echo -e "日志文件: ${GREEN}${LOG_FILE}${NC}"
echo -e "PID 文件: ${GREEN}${PID_FILE}${NC}"
echo ""

# 如果是生产模式，先构建
if [ "$MODE" = "prod" ]; then
    echo -e "${YELLOW}正在构建生产环境包...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}构建失败，请检查错误${NC}"
        exit 1
    fi
    echo -e "${GREEN}构建成功！${NC}"
    echo ""
fi

# 计算后端端口
SERVER_PORT=$((VITE_PORT + 1))

# 后台启动后端代理服务
echo -e "${YELLOW}正在启动后端代理服务 (端口: $SERVER_PORT)...${NC}"
nohup env SERVER_PORT=$SERVER_PORT VITE_BAIDU_OCR_API_KEY=$VITE_BAIDU_OCR_API_KEY node server.js > server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > .server.pid

# 根据模式启动前端
if [ "$MODE" = "prod" ]; then
    echo -e "${YELLOW}正在启动生产环境预览服务 (端口: $VITE_PORT)...${NC}"
    nohup npx vite preview --port $VITE_PORT --host 0.0.0.0 > "$LOG_FILE" 2>&1 &
else
    echo -e "${YELLOW}正在启动开发环境服务器 (端口: $VITE_PORT)...${NC}"
    nohup env VITE_PORT=$VITE_PORT VITE_BAIDU_OCR_API_KEY=$VITE_BAIDU_OCR_API_KEY npm run dev > "$LOG_FILE" 2>&1 &
fi

# 保存前端 PID
APP_PID=$!
echo $APP_PID > "$PID_FILE"

# 等待一下，检查进程是否成功启动
sleep 2

if ps -p $APP_PID > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  服务启动成功！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "进程 PID: ${GREEN}${APP_PID}${NC}"
    echo -e "访问地址: ${GREEN}http://localhost:${VITE_PORT}${NC}"
    echo ""
    echo -e "${YELLOW}管理命令：${NC}"
    echo -e "  查看日志: ${GREEN}tail -f ${LOG_FILE}${NC}"
    echo -e "  停止服务: ${GREEN}./stop.sh${NC}"
    echo -e "  重启服务: ${GREEN}./restart.sh${NC}"
    echo ""
else
    echo -e "${RED}服务启动失败，请查看日志文件: ${LOG_FILE}${NC}"
    rm -f "$PID_FILE"
    exit 1
fi
