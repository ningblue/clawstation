# 构建流程简化方案

## 核心思路：单一 OpenClaw 来源

**现状问题：**
- 开发时用 `lib/openclaw/` 源码
- 打包时用 `resources/openclaw/` 编译产物
- 路径处理复杂，容易出错

**简化方案：**
- 统一使用 `resources/openclaw/`（编译后的产物）
- 开发和生产完全一致，零差异
- 不再维护 `lib/openclaw` 作为构建依赖

## 实施步骤

### 1. 统一 OpenClaw 来源

```
resources/openclaw/          # 唯一来源，开发和生产都用它
├── dist/                    # 编译后的 OpenClaw
├── node_modules/            # 生产依赖
└── wrapper.js               # 入口包装器
```

**移除以下复杂逻辑：**
- 开发时检测 `lib/openclaw` 的逻辑
- 动态编译 OpenClaw 的逻辑
- 路径切换逻辑（isPackaged 判断）

### 2. 预编译二进制策略

由于我们不修改 OpenClaw 源码，完全可以使用预编译包：

**方案：GitHub Releases 托管**
```
releases/
├── openclaw-v2026.3.8-win-x64.7z
├── openclaw-v2026.3.8-darwin-arm64.7z
├── openclaw-v2026.3.8-darwin-x64.7z
└── openclaw-v2026.3.8-linux-x64.7z
```

**开发环境设置：**
```bash
# 首次设置（或版本更新时）
npm run setup:openclaw

# 这个脚本会：
# 1. 检测当前平台
# 2. 从 GitHub Releases 下载对应版本的预编译包
# 3. 解压到 resources/openclaw/
# 4. 验证完整性
```

### 3. Node.js 运行时统一

**现状问题：**
- Windows 上解压经常失败
- 没有缓存，每次都重新下载

**简化方案：**

**本地缓存目录：**
```
.cache/
└── node/
    ├── v22.14.0-win-x64.zip
    ├── v22.14.0-darwin-arm64.tar.gz
    └── v22.14.0-darwin-x64.tar.gz
```

**下载策略：**
1. 先检查本地缓存 `.cache/node/`
2. 如果有，直接复制到 `resources/node/`
3. 如果没有，下载到缓存，再复制

**解压工具统一：**
- Windows：使用自带的 `7za.exe`（ electron-builder 已依赖）
- macOS/Linux：使用系统 `tar`

### 4. 构建流程简化

**新构建流程（3步）：**

```bash
# Step 1: 环境准备（只需运行一次，或依赖变更时）
npm run setup
# - 下载 OpenClaw 预编译包
# - 下载 Node.js 运行时
# - 检查所有资源是否就位

# Step 2: 开发模式
npm run dev
# - 直接启动 Electron
# - 使用 resources/openclaw（与生产一致）

# Step 3: 打包
npm run build
# - 构建主进程和渲染进程
# - electron-builder 打包
# - 验证构建产物
```

**移除的步骤：**
- 不再编译 OpenClaw（省去 5分钟+）
- 不再区分开发和生产路径
- 不再动态下载依赖（提前准备好）

### 5. 目录结构清理

**移除（不再维护）：**
- `lib/openclaw/` → 从子模块改为可选，仅用于参考
- `scripts/build-openclaw.js` → 删除
- `scripts/archive-openclaw.js` → 简化或删除

**保留：**
- `scripts/download-node.js` → 改进缓存逻辑
- `scripts/after-pack.js` → 保持平台特定处理

**新增：**
- `scripts/setup.js` → 环境准备脚本
- `scripts/setup-openclaw.js` → 下载预编译包
- `.cache/` → 本地构建缓存（gitignore）

### 6. 跨平台统一处理

**平台检测：**
```javascript
const platform = process.platform; // win32, darwin, linux
const arch = process.arch;         // x64, arm64
```

**统一资源路径：**
```javascript
// 所有平台都用相同的路径结构
const resourcesPath = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, '../../resources');

const openclawPath = path.join(resourcesPath, 'openclaw');
const nodePath = path.join(resourcesPath, 'node', 'bin', 'node');
```

### 7. 实施计划

**阶段 1：清理（1天）**
- [ ] 修改代码，统一使用 resources/openclaw
- [ ] 移除 lib/openclaw 构建依赖
- [ ] 简化路径检测逻辑

**阶段 2：脚本改进（2天）**
- [ ] 改进 download-node.js（添加缓存）
- [ ] 创建 setup-openclaw.js（下载预编译包）
- [ ] 创建统一的 setup.js

**阶段 3：验证（1天）**
- [ ] Windows 完整测试
- [ ] macOS 完整测试
- [ ] CI/CD 集成

## 优势

1. **简单**：开发和生产完全一致
2. **快速**：不再编译 OpenClaw，节省 5分钟+
3. **稳定**：预编译包可重现，不依赖环境
4. **可维护**：路径统一，逻辑清晰

## 风险

1. **无法快速修改 OpenClaw**：需要重新发布预编译包
   - 缓解：我们本来就不修改 OpenClaw

2. **预编译包版本管理**：需要跟踪版本
   - 缓解：在 package.json 中锁定版本

3. **磁盘空间**：resources/ 变大（+70MB）
   - 缓解：.gitignore 排除，只保留下载脚本

## 开发环境兼容方案

### 开发环境类型支持

| 环境类型 | 适用场景 | OpenClaw 来源 |
|---------|---------|--------------|
| **快速开发** | 不修改 OpenClaw，只改应用代码 | 下载预编译包 |
| **深度开发** | 需要修改 OpenClaw 源码 | 本地编译（保留原能力） |
| **混合模式** | 大部分用预编译，偶尔调试 OpenClaw | 可切换 |

### 开发流程设计

#### 首次开发环境设置

```bash
# 克隆项目后首次设置
npm install

# 方案 A：快速开发（推荐，90% 开发者）
npm run setup:dev
# 自动检测平台，下载对应预编译包到 resources/openclaw/
# 下载 Node.js 运行时到 resources/node/
# 总耗时约 1-2 分钟

# 方案 B：深度开发（需要修改 OpenClaw 源码）
npm run setup:dev:full
# 下载 OpenClaw 源码到 lib/openclaw/
# 编译 OpenClaw（5-10分钟）
# 复制到 resources/openclaw/
```

#### 日常开发流程

**快速开发（不修改 OpenClaw）：**
```bash
# 启动开发服务器
npm run dev
# 直接启动，不编译 OpenClaw
# 使用 resources/openclaw（预编译包）
# 修改代码后自动重启

# 调试应用
npm run dev:debug
# 带开发者工具启动
```

**深度开发（修改 OpenClaw）：**
```bash
# 1. 修改 lib/openclaw 源码
# ...

# 2. 重新编译并同步到 resources/
npm run build:openclaw:dev
# 编译 lib/openclaw
# 自动复制到 resources/openclaw/

# 3. 启动开发服务器
npm run dev
```

#### 版本更新处理

**OpenClaw 版本更新：**
```bash
# 检查新版本
npm run check:openclaw

# 更新到最新版本（预编译包）
npm run update:openclaw
# 下载新版本，替换 resources/openclaw/

# 更新并重新编译（深度开发模式）
npm run update:openclaw:full
```

**Node.js 版本更新：**
```bash
# 更新 Node.js 运行时
npm run update:node
# 删除缓存，重新下载
```

### 开发环境配置

**配置文件：`.clawstation-dev.json`**（gitignore）
```json
{
  "mode": "quick",  // quick | full
  "openclaw": {
    "version": "2026.3.8",
    "source": "prebuilt",  // prebuilt | compiled
    "lastSync": "2026-03-13T10:00:00Z"
  },
  "node": {
    "version": "22.14.0",
    "cached": true
  }
}
```

**环境检测脚本：**
```javascript
// scripts/check-dev-env.js
// 运行 npm run dev 前自动执行

function checkDevEnv() {
  // 1. 检查 resources/openclaw/ 是否存在
  // 2. 检查 resources/node/ 是否存在
  // 3. 检查版本是否匹配 package.json
  // 4. 如有问题，提示运行 npm run setup:dev
}
```

### 不同场景的开发流程

#### 场景 1：新成员首次加入

```bash
git clone <repo>
cd clawstation
npm install
npm run setup:dev        # 2分钟下载依赖
npm run dev              # 开始开发
```

#### 场景 2：日常开发（只改应用代码）

```bash
# 每天开始工作
npm run dev              # 直接启动，无需等待
```

#### 场景 3：需要调试 OpenClaw 问题

```bash
# 切换到完整开发模式
npm run setup:dev:full   # 一次性设置

# 修改 lib/openclaw 代码
# ...

# 重新编译
npm run build:openclaw:dev

# 测试
npm run dev
```

#### 场景 4：CI/CD 构建

```bash
# 使用预编译包，不编译
npm run setup:ci         # 下载预编译包
npm run build            # 构建应用
```

### 路径处理统一

**开发环境路径解析：**
```javascript
// src/main/paths.ts
import { app } from 'electron';
import path from 'path';

export function getResourcesPath() {
  // 开发环境：项目根目录/resources/
  // 生产环境：app.getPath('resources')
  if (process.env.NODE_ENV === 'development') {
    return path.join(__dirname, '../../resources');
  }
  return process.resourcesPath;
}

export function getOpenClawPath() {
  return path.join(getResourcesPath(), 'openclaw');
}

export function getNodePath() {
  const platform = process.platform;
  const resourcesPath = getResourcesPath();

  if (platform === 'win32') {
    return path.join(resourcesPath, 'node', 'node.exe');
  }
  return path.join(resourcesPath, 'node', 'bin', 'node');
}
```

### 命令汇总

```bash
# 首次设置
npm run setup:dev            # 快速模式（下载预编译包）
npm run setup:dev:full       # 完整模式（编译源码）

# 日常开发
npm run dev                  # 启动开发服务器
npm run dev:debug            # 调试模式

# 依赖更新
npm run update:openclaw      # 更新 OpenClaw（预编译）
npm run update:openclaw:full # 更新并重新编译
npm run update:node          # 更新 Node.js

# 构建
npm run build                # 完整构建
npm run build:win            # Windows 构建
npm run build:mac            # macOS 构建

# 检查
npm run check:env            # 检查开发环境
npm run check:openclaw       # 检查 OpenClaw 版本
```

## 实施后的好处

### 对开发者

| 场景 | 现在 | 简化后 |
|-----|------|--------|
| 首次加入 | 10分钟（编译 OpenClaw） | 2分钟（下载预编译包） |
| 日常启动 | 等待编译 | 秒开 |
| 切换分支 | 可能需要重新编译 | 无需等待 |
| 调试 OpenClaw | 必须编译 | 可选择编译或下载 |

### 对 CI/CD

- 构建时间：10分钟 → 3分钟
- 环境依赖：需要 pnpm → 只需 npm
- 稳定性：容易失败 → 可靠下载

## 风险与缓解

| 风险 | 缓解措施 |
|-----|---------|
| 无法修改 OpenClaw | 保留 `npm run setup:dev:full` 选项 |
| 预编译包版本滞后 | CI/CD 自动发布，版本锁定 |
| 磁盘空间占用 | .cache/ 可清理，resources/ 可重建 |
| 网络下载失败 | 重试机制 + 本地下载选项 |

## 结论

这个方案同时满足：
1. **快速开发**：大多数人用预编译包，2分钟进入开发
2. **深度开发**：需要时可编译源码，保留灵活性
3. **稳定构建**：CI/CD 可靠，不再看运气

实施后将彻底解决：
- 路径混乱问题
- 构建时间过长问题
- 环境依赖问题
