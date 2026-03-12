# Clawstation - Claude Code 配置

## 项目概述

Clawstation 是一个 Electron 桌面应用，提供 AI 助手功能。包含主进程、渲染进程和 AI 引擎 (OpenClaw/clawstation-engine)。

## 常用命令

### 服务管理（优先使用）
```bash
# 启动应用（自动清理端口、构建、启动）
./scripts/clawstation-service.sh start

# 停止应用（优雅关闭所有进程）
./scripts/clawstation-service.sh stop

# 重启应用
./scripts/clawstation-service.sh restart

# 查看状态
./scripts/clawstation-service.sh status

# 查看日志
./scripts/clawstation-service.sh logs

# 构建应用
./scripts/clawstation-service.sh build

# 清理缓存
./scripts/clawstation-service.sh clean
```

### npm 脚本
```bash
# 开发模式（仅使用当 service.sh 不能满足需求时）
npm run dev

# 构建
npm run build              # 完整构建
npm run build:main         # 仅主进程
npm run build:renderer     # 仅渲染进程

# 原生模块
npm run rebuild:native     # 重新编译 better-sqlite3 等原生模块
```

## 开发工作流

### 代码变更后的完整流程（必须执行）

```bash
# 1. 清理 Electron 缓存（CSS/React 修改后必须）
rm -rf ~/Library/Application\ Support/clawstation/Cache
rm -rf ~/Library/Application\ Support/clawstation/GPUCache

# 2. 清理构建缓存
rm -rf dist/renderer/*

# 3. 重新构建渲染进程
npm run build:renderer

# 4. 重启服务
./scripts/clawstation-service.sh restart
```

**简化版（推荐）：**
```bash
rm -rf ~/Library/Application\ Support/clawstation/Cache dist/renderer/* && npm run build:renderer && ./scripts/clawstation-service.sh restart
```

### 修改内容对应处理

| 修改内容 | 构建命令 | 清理缓存 |
|---------|---------|---------|
| CSS 样式 | `npm run build:renderer` | ✅ 必须 |
| React 组件 | `npm run build:renderer` | ✅ 必须 |
| HTML 结构 | `npm run build:renderer` | ✅ 必须 |
| 主进程代码 | `npm run build:main` | ❌ 不需要 |
| 仅文本内容 | `npm run build:renderer` | ✅ 必须 |

### 快速验证
- 按 `Cmd+Shift+R` 强制刷新验证样式变化
- 如无效再执行完整流程

## 关键端口和进程

| 端口 | 用途 | 进程名 |
|-----|------|-------|
| 18791 | AI 引擎 | clawstation-engine |
| 18793 | 浏览器控制 | Playwright |

**重要：** 只通过 `clawstation-service.sh` 管理进程，禁止使用 `pkill/kill -9` 直接终止。

## 项目结构

```
clawstation/
├── scripts/
│   └── clawstation-service.sh    # 服务管理脚本（优先使用）
├── src/
│   ├── main/                     # Electron 主进程
│   │   └── index.ts
│   ├── renderer/                 # React 渲染进程
│   ├── backend/                  # 后端服务
│   ├── api/                      # API 路由
│   └── shared/                   # 共享代码
├── lib/openclaw/                 # OpenClaw 源代码（问题排查优先看这里）
├── resources/openclaw/           # OpenClaw 编译产物
├── dist/                         # 构建输出
└── logs/                         # 应用日志
```

## 配置文件

```
~/.clawstation/openclaw.json              # AI 模型和网关配置
~/.clawstation/agents/                    # 代理配置
~/Library/Application Support/clawstation/ # Electron 应用数据（macOS）
~/Library/Logs/clawstation/               # 系统日志（macOS）
```

## 故障排查指南

### AI 引擎启动失败 / 端口 18791 被占用
```bash
./scripts/clawstation-service.sh status  # 查看状态
./scripts/clawstation-service.sh restart # 完全重启
```

### 应用白屏
```bash
./scripts/clawstation-service.sh clean
./scripts/clawstation-service.sh restart
```

### 架构不匹配错误 (dlopen error: have 'x86_64', need 'arm64')
```bash
npm run rebuild:native
# 或
npx electron-rebuild -f -w better-sqlite3
```

### OpenClaw 问题排查
遇到配置验证、插件问题时，**优先查看 `lib/openclaw/` 源代码**，而非 `resources/openclaw/dist/` 编译产物。

### 构建问题排查
遇到应用打包后无法启动、签名相关错误时，**参考 `BUILD_LESSONS.md`**，避免重复踩坑。

## 重要约束

1. **禁止直接使用 pkill/kill**：始终使用 `./scripts/clawstation-service.sh stop`
2. **CSS/React 修改必须清理缓存**：Electron 会缓存渲染进程
3. **跨平台拉代码后**：先运行 `npm run rebuild:native` 再启动
4. **重启前先停止服务**：避免端口冲突

## 技术栈

- **框架**: Electron + React + TypeScript
- **构建**: Vite + electron-builder
- **数据库**: better-sqlite3
- **AI 引擎**: OpenClaw (自定义)
- **样式**: Tailwind CSS + shadcn/ui
