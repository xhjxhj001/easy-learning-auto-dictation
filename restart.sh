#!/bin/bash

# 听写学习应用重启脚本

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  听写学习应用重启脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 是否强制更新依赖
FORCE_UPDATE=false
# 启动模式
START_FLAGS=""

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--update)
            FORCE_UPDATE=true
            shift
            ;;
        -p|--prod)
            START_FLAGS="$START_FLAGS --prod"
            shift
            ;;
        -h|--help)
            echo "用法: ./restart.sh [选项]"
            echo ""
            echo "选项:"
            echo "  -u, --update    强制更新依赖（即使 package.json 没有变化）"
            echo "  -p, --prod      以生产模式重启"
            echo "  -h, --help      显示帮助信息"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            echo "使用 -h 或 --help 查看帮助"
            exit 1
            ;;
    esac
done

# 如果需要强制更新依赖，删除 hash 文件
if [ "$FORCE_UPDATE" = true ]; then
    echo -e "${YELLOW}将强制更新依赖...${NC}"
    rm -f "$SCRIPT_DIR/.deps.hash"
fi

# 停止服务
echo -e "${YELLOW}正在停止服务...${NC}"
"$SCRIPT_DIR/stop.sh"

# 等待一下确保端口释放
sleep 2

# 启动服务
echo ""
echo -e "${YELLOW}正在启动服务 (参数: $START_FLAGS)...${NC}"
"$SCRIPT_DIR/start.sh" $START_FLAGS

