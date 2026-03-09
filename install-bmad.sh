#!/bin/bash
# BMad Method 安装脚本
# 此脚本用于安装BMad Method开发工具

echo "正在安装 BMad Method..."

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 需要安装 Node.js 20+"
    exit 1
fi

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ "$MAJOR_VERSION" -lt 20 ]; then
    echo "错误: 需要 Node.js 20+，当前版本是 $NODE_VERSION"
    exit 1
fi

echo "Node.js 版本: $NODE_VERSION"

# 安装 BMad Method
echo "正在安装 BMad Method..."
npx bmad-method install

echo "BMad Method 安装完成！"
echo ""
echo "下一步："
echo "1. 在您的 AI IDE 中运行: /bmad-help"
echo "2. BMad-Help 将检测您已完成的内容并推荐下一步"
echo ""
echo "更多信息请访问: https://docs.bmad-method.org"