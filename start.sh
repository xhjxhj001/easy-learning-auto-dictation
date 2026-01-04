#!/bin/bash

# 听写学习应用启动脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  听写学习应用启动脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

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

# 加载环境变量
source .env

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

# 检查端口号（可选，有默认值）
if [ -z "$VITE_PORT" ]; then
    export VITE_PORT=3000
    echo -e "${YELLOW}⚠ VITE_PORT 未设置，使用默认值: 3000${NC}"
else
    # 验证端口号是否为数字
    if ! [[ "$VITE_PORT" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}✗ 错误: VITE_PORT 必须是数字${NC}"
        MISSING_CONFIG=true
    else
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

# 检查node_modules是否存在
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}检测到 node_modules 不存在，正在安装依赖...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}依赖安装失败，请检查网络连接和npm配置${NC}"
        exit 1
    fi
    echo -e "${GREEN}依赖安装完成${NC}"
    echo ""
fi

# 显示启动信息
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  启动信息${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "监听地址: ${GREEN}0.0.0.0${NC}"
echo -e "监听端口: ${GREEN}${VITE_PORT}${NC}"
echo -e "允许访问: ${GREEN}所有域名${NC}"
echo ""
echo -e "${YELLOW}正在启动开发服务器...${NC}"
echo ""

# 启动开发服务器
npm run dev

