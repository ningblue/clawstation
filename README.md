# ClawStation - AI数字员工桌面应用

## 项目概述

ClawStation是一个跨平台的AI数字员工桌面应用，基于Electron框架并集成了OpenClaw作为内置AI引擎。该应用提供开箱即用的体验，用户无需配置任何环境或依赖。

## 核心特性

- 开箱即用的AI助手
- 现代化的用户界面（参考lobehub风格）
- 本地数据存储和管理
- 安全的内容过滤和审计日志
- 跨平台支持（Windows, macOS, Linux）

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     ClawStation App                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Electron进程                            │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │ │
│  │  │   前端UI    │  │  IPC主进程  │  │  内置OpenClaw     │  │ │
│  │  │  (Lit/React)│  │   通信层    │  │  (子进程)         │  │ │
│  │  └─────────────┘  └─────────────┘  └───────────────────┘  │ │
│  │         │                │                   │             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  SQLite: 用户数据 / 配置 / 审计日志                  │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 快速开始

1. 确保已安装Node.js 22+
2. 安装依赖：
   ```bash
   npm install
   ```
3. 构建项目：
   ```bash
   npm run build
   ```
4. 运行应用：
   ```bash
   npm start
   ```

## 项目结构

```
clawstation/
├── src/
│   ├── main/                 # Electron主进程
│   │   ├── index.ts          # 入口
│   │   ├── openclaw-manager.ts # OpenClaw进程管理
│   │   ├── ipc-handlers.ts   # IPC处理器
│   │   ├── database.ts       # SQLite数据库
│   │   ├── security.ts       # 安全管控
│   │   └── audit.ts          # 审计日志
│   ├── preload/              # 预加载脚本
│   │   └── index.ts
│   └── renderer/             # 前端UI
│       └── index.html
├── scripts/
│   └── rebuild-native.sh     # native模块重编译
├── resources/                # 静态资源
├── package.json
├── electron-builder.yml      # 打包配置
└── tsconfig.json
```

## 依赖项

- Electron
- React + Tailwind CSS (前端UI)
- TypeScript
- Better-SQLite3 (本地数据库)
- OpenClaw (AI引擎，通过file:协议引用)

## 打包和分发

使用electron-builder创建跨平台安装包:

- Windows: ClawStation-Setup.exe
- macOS: ClawStation.dmg
- Linux: ClawStation.AppImage

## 安全和审计

- 实施严格的安全策略防止远程代码执行
- 完整的审计日志记录所有用户操作
- 内容过滤机制防止敏感数据泄露