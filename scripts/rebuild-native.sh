#!/bin/bash
# 针对Electron的Node版本重编译native模块

echo "开始重编译Native模块..."

# 获取Electron的Node.js版本
ELECTRON_VERSION=$(node -e "console.log(require('electron/package.json').version)")
NODE_ABI=$(node -e "console.log('node-' + process.versions.modules)")

echo "Electron版本: $ELECTRON_VERSION"
echo "Node ABI: $NODE_ABI"

# 重编译所需的Native模块
npx electron-rebuild -f -w better-sqlite3,sharp,playwright-core,node-pty

echo "Native模块重编译完成!"