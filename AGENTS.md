# X-Claw 服务管理指南

## 概述

本文档描述了 X-Claw 桌面应用的完整启停流程和管理脚本的使用方法。

## 服务管理脚本

### 位置

```
scripts/clawstation-service.sh
```

### 使用方法

#### 1. 启动服务

```bash
./scripts/clawstation-service.sh start
```

这会：

- 检查是否已有实例在运行
- 清理占用端口（18791, 18793）的旧进程
- 启动 Electron 应用和 AI 引擎
- 保存进程 PID 到 `.clawstation.pid`

#### 2. 停止服务

```bash
./scripts/clawstation-service.sh stop
```

这会：

- 停止 Electron 主进程
- 停止所有 X-Claw 相关子进程
- 停止占用端口的 AI 引擎进程
- 清理 PID 文件

#### 3. 重启服务

```bash
./scripts/clawstation-service.sh restart
```

#### 4. 查看状态

```bash
./scripts/clawstation-service.sh status
```

#### 5. 查看日志

```bash
./scripts/clawstation-service.sh logs
```

#### 6. 构建应用

```bash
./scripts/clawstation-service.sh build
```

#### 7. 清理缓存

```bash
./scripts/clawstation-service.sh clean
```

## 端口说明

| 端口  | 用途               | 说明                  |
| ----- | ------------------ | --------------------- |
| 18791 | AI 引擎 (OpenClaw) | Kimi AI 服务端口      |
| 18793 | 浏览器控制         | Playwright 浏览器控制 |

## 进程结构

```
X-Claw (主进程)
├── Electron Helper (GPU)      - 图形渲染
├── Electron Helper (Renderer) - 渲染进程
├── Electron Helper (Utility)  - 网络服务
├── clawstation-engine         - AI 引擎 (原 clawstation-claw)
└── 其他子进程
```

## 重要说明

### 1. 禁止使用 pkill/kill 直接终止进程

❌ **不要这样做：**

```bash
pkill -f clawstation
kill -9 <pid>
```

✅ **正确做法：**

```bash
./scripts/clawstation-service.sh stop
```

### 2. 托盘退出不生效的解决方案

如果托盘菜单的"退出"按钮不生效，请使用：

```bash
./scripts/clawstation-service.sh stop
```

### 3. AI 引擎启动失败

如果 AI 引擎启动失败，通常是端口被占用：

```bash
# 查看状态
./scripts/clawstation-service.sh status

# 停止所有服务并重新启动
./scripts/clawstation-service.sh restart
```

### 4. 日志位置

```
logs/clawstation.log           - 应用日志
logs/build-main.log            - 主进程构建日志
logs/build-renderer.log        - 渲染进程构建日志
~/Library/Logs/clawstation/    - 系统日志（macOS）
```

## 故障排查

### 问题 1：端口被占用

**症状：** AI 引擎启动失败，提示端口 18791 被占用

**解决：**

```bash
./scripts/clawstation-service.sh stop
./scripts/clawstation-service.sh start
```

### 问题 2：应用白屏

**症状：** 窗口打开但显示空白

**解决：**

```bash
# 清理缓存并重启
./scripts/clawstation-service.sh clean
./scripts/clawstation-service.sh restart
```

### 问题 3：构建失败

**症状：** npm run build 报错

**解决：**

```bash
# 重新构建
./scripts/clawstation-service.sh build
```

### 问题 5：macOS 架构不匹配 (dlopen error)

**症状：** 启动时报错 `dlopen(...): tried: '...' (mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64'))`

**原因：** 原生模块（如 better-sqlite3）是为 Intel (x64) 编译的，但在 Apple Silicon (arm64) 上运行。通常发生在使用 x64 终端安装依赖后切换环境，或 CI 构建配置错误。

**解决：**

```bash
# 强制为当前架构重新编译原生依赖
npm rebuild better-sqlite3
# 或者
npx electron-builder install-app-deps
```

### 问题 6：Windows 构建失败

**症状：** `npm run build:openclaw` 报错 `'.' is not recognized as an internal or external command`

**原因：** 旧版构建脚本是 Shell 脚本。

**解决：** 确保使用最新的 `scripts/build-openclaw.js` (Node.js 版本)，它已自动集成在 `npm run build` 中。

## 开发工作流

### 日常开发 - 代码变更后

**每次修改代码后，必须执行以下完整流程：**

```bash
# 1. 清理 Electron 缓存（重要！）
rm -rf ~/Library/Application\ Support/clawstation/Cache
rm -rf ~/Library/Application\ Support/clawstation/GPUCache

# 2. 清理构建缓存
rm -rf dist/renderer/*

# 3. 重新构建渲染进程
npm run build:renderer

# 4. 重启服务（会自动停止旧进程）
./scripts/clawstation-service.sh restart
```

**简化命令（推荐）：**

```bash
# 完整流程一条命令
rm -rf ~/Library/Application\ Support/clawstation/Cache dist/renderer/* && npm run build:renderer && ./scripts/clawstation-service.sh restart
```

### 为什么需要这个流程？

1. **清理缓存** - Electron 会缓存渲染进程，修改 CSS/React 组件后必须清理
2. **重新构建** - TypeScript/React 代码需要编译到 dist 目录
3. **重启服务** - 确保加载最新的构建产物

### 修改不同代码时的处理

| 修改内容   | 是否需要构建                   | 是否需要清理缓存 |
| ---------- | ------------------------------ | ---------------- |
| CSS 样式   | ✅ 需要                        | ✅ 需要          |
| React 组件 | ✅ 需要                        | ✅ 需要          |
| HTML 结构  | ✅ 需要                        | ✅ 需要          |
| 主进程代码 | ✅ 需要 (`npm run build:main`) | ❌ 不需要        |
| 仅文本内容 | ✅ 需要                        | ✅ 需要          |

### 快速验证

如果只是验证样式变化，可以尝试：

1. 在应用中按 `Cmd+Shift+R` 强制刷新
2. 如果不行再执行完整流程

### 发布前准备

```bash
# 清理并完整构建
./scripts/clawstation-service.sh clean
./scripts/clawstation-service.sh build

# 测试启动
./scripts/clawstation-service.sh restart
```

## 配置文件

### OpenClaw 配置

```
~/.clawstation/openclaw.json
```

包含 AI 模型配置、API 密钥、网关设置等。

### 应用配置

```
~/.clawstation/agents/
~/.clawstation/canvas/
```

## 注意事项

1. **始终使用脚本管理服务**，不要直接使用 pkill/kill
2. **重启前先停止服务**，避免端口冲突
3. **定期查看日志**，及时发现异常
4. **构建失败时先清理缓存**

## 相关文件

- `scripts/clawstation-service.sh` - 服务管理脚本
- `package.json` - npm 脚本定义
- `src/main/index.ts` - 主进程入口
- `src/renderer/` - 渲染进程代码
- `lib/openclaw/` - OpenClaw 源代码（遇到 OpenClaw 相关问题时，优先查看此目录源码，而非 `resources/openclaw/dist/` 编译产物）

## 开发提示

### OpenClaw 问题排查

遇到 OpenClaw 相关问题时（如配置验证、插件问题等），请优先查看 `lib/openclaw/` 目录的源代码，而不是搜索 `resources/openclaw/dist/` 目录的编译后代码。源代码更易理解和调试。
