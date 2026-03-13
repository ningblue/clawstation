# 跨平台测试报告 - 构建流程简化

**测试日期**: 2026-03-13
**测试人员**: cross-platform-tester
**测试目标**: 验证新的构建流程 (setup:dev, setup:dev:full) 在各平台的可用性

## 测试环境

### 环境1: Windows (当前)
- **平台**: win32
- **架构**: x64
- **Node版本**: 待检测
- **状态**: 开发环境已存在

### 环境2: macOS (Intel) - 待测试
- **平台**: darwin
- **架构**: x64

### 环境3: macOS (Apple Silicon) - 待测试
- **平台**: darwin
- **架构**: arm64

---

## 阶段1: Windows 环境测试

### 1.1 现状评估

**当前问题识别**:

1. **缺少 setup:dev 脚本**: package.json 中没有定义 setup:dev 和 setup:dev:full 命令
2. **路径逻辑复杂**: openclaw.service.ts 中有多达 6 组不同的路径解析逻辑
3. **混合使用 lib/openclaw 和 resources/openclaw**: 代码同时检查两个位置

**当前目录状态**:
```
resources/openclaw/          ✅ 存在 (预编译包)
resources/node/              ✅ 存在 (Node.js运行时)
lib/openclaw/               ✅ 存在 (源码)
resources/openclaw.7z       ✅ 存在 (压缩包)
```

### 1.2 测试: 现有 npm run dev 流程

**测试命令**: `npm run dev`

**预期行为**:
1. Electron 启动
2. 找到 resources/openclaw/wrapper.js
3. AI 引擎在端口 18791 启动

**实际结果**: [待测试]

### 1.3 路径解析测试

**测试代码**:
```javascript
// 测试 resolveOpenClawPath 使用的路径
const possiblePaths = [
  // 开发环境路径 (优先级最高)
  path.join(__dirname, "../../../../resources/openclaw/wrapper.js"),
  path.join(__dirname, "../../../resources/openclaw/wrapper.js"),
  path.join(process.cwd(), "resources/openclaw/wrapper.js"),
];
```

**测试结果**:
- [ ] 路径1存在
- [ ] 路径2存在
- [ ] 路径3存在

---

## 发现的问题

### 问题1: 缺少 setup:dev 脚本实现

**严重程度**: 🔴 高

**描述**: 根据 build-simplification.md 设计文档，应该有以下命令：
- `npm run setup:dev` - 下载预编译包
- `npm run setup:dev:full` - 编译源码
- `npm run check:env` - 检查环境

**现状**: package.json 中只有旧命令：
- `npm run build:openclaw` - 编译 OpenClaw
- `npm run archive:openclaw` - 创建压缩包

**影响**: 新成员无法按照简化流程快速开始开发

### 问题2: 路径解析逻辑过于复杂

**严重程度**: 🟡 中

**描述**: openclaw.service.ts 中的 resolveOpenClawPath() 方法检查超过30个不同路径。

**建议**: 简化为统一路径：
```javascript
// 开发环境
const openclawPath = path.join(process.cwd(), 'resources/openclaw/wrapper.js');
// 生产环境
const openclawPath = path.join(process.resourcesPath, 'openclaw/wrapper.js');
```

### 问题3: lib/openclaw 和 resources/openclaw 并存

**严重程度**: 🟡 中

**描述**: 代码同时支持两个来源，导致：
1. 路径判断复杂
2. 不确定使用哪个版本
3. 维护困难

**建议**: 统一使用 resources/openclaw，lib/openclaw 仅作为可选源码

---

## 性能测试

### 下载时间测试

| 资源 | 大小 | 下载时间 | 备注 |
|-----|------|---------|------|
| openclaw.7z | ~70MB | [待测试] | 预编译包 |
| Node.js (win-x64) | ~30MB | [待测试] | 运行时 |

### 启动时间测试

| 场景 | 时间 | 备注 |
|-----|------|------|
| 首次 setup:dev | [待测试] | 下载+解压 |
| 日常 npm run dev | [待测试] | 直接启动 |
| setup:dev:full | [待测试] | 完整编译 |

---

## 建议实施方案

### 立即实施 (优先级1)

1. **创建 scripts/setup.js**
   - 检测当前平台
   - 从 GitHub Releases 下载预编译包
   - 解压到 resources/openclaw/

2. **更新 package.json**
   ```json
   {
     "scripts": {
       "setup:dev": "node scripts/setup.js --mode=quick",
       "setup:dev:full": "node scripts/setup.js --mode=full",
       "check:env": "node scripts/check-env.js"
     }
   }
   ```

3. **简化路径逻辑**
   - 修改 openclaw.service.ts
   - 只检查 resources/openclaw/wrapper.js

### 短期优化 (优先级2)

1. **添加本地缓存**
   - .cache/node/
   - .cache/openclaw/

2. **改进错误提示**
   - 当 resources/openclaw 不存在时，提示运行 npm run setup:dev

### 长期改进 (优先级3)

1. **CI/CD 自动发布预编译包**
2. **版本检查和自动更新**

---

## 测试结论

**当前状态**: 🔴 无法按新流程测试

**原因**: 缺少 setup:dev 脚本实现

**建议**: 先完成阶段1和阶段2的实施，再进行完整测试

---

## 附录: 当前可用命令

### 现有命令
```bash
npm run build:openclaw      # 编译 OpenClaw 源码
npm run archive:openclaw    # 创建压缩包
npm run download:node       # 下载 Node.js 运行时
npm run dev                 # 启动开发服务器
npm run build               # 完整构建
```

### 期望的新命令
```bash
npm run setup:dev           # 快速设置 (下载预编译包)
npm run setup:dev:full      # 完整设置 (编译源码)
npm run check:env           # 检查环境
npm run update:openclaw     # 更新 OpenClaw
npm run update:node         # 更新 Node.js
```
