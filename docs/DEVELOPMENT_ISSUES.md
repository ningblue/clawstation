# ClawStation 开发问题记录

## 问题1: TypeScript 编译不复制 HTML 文件

**问题描述**:
- 运行 `npm run build` 时，TypeScript 编译 (`tsc`) 不会复制 `.html` 文件到 `dist/` 目录
- 导致修改 `src/renderer/index.html` 后，前端不更新

**解决方案**:
在 `package.json` 的 `build` 脚本中添加复制 HTML 文件的步骤:
```json
"build": "tsc && electron-builder"
```
需要修改为:
```json
"build": "tsc && node scripts/copy-html.js && electron-builder"
```

**预防措施**:
- 创建 `scripts/copy-html.js` 脚本自动复制 HTML 文件
- 或者使用 `cp` 命令在构建后复制

---

## 问题2: 不要修改 lib/openclaw 源代码

**问题描述**:
- 用户明确要求不要修改 `lib/openclaw` 的源代码
- 应该通过 ClawStation 后端读取 OpenClaw 的配置文件来获取模型信息

**解决方案**:
- 创建 `src/backend/services/model-catalog.service.ts` 从 OpenClaw 的 `models.json` 文件读取模型数据
- 不通过修改 OpenClaw 的 HTTP API 来获取数据

---

## 问题3: 生成 models.json 文件

**问题描述**:
- OpenClaw 需要运行 `openclaw models list --all --json` 来生成模型目录文件

**解决方案**:
- 首次运行需要手动执行命令生成文件:
```bash
mkdir -p "$HOME/.clawstation/agents/default/agent"
OPENCLAW_STATE_DIR="$HOME/.clawstation" node openclaw.mjs models list --all --json > "$HOME/.clawstation/agents/default/agent/models.json"
```

---

## 问题4: IPC 处理器注册顺序

**问题描述**:
- OpenClaw 的 IPC 处理器必须在 OpenClaw 启动后、窗口加载前注册
- 否则前端调用会失败

**解决方案**:
- 在 `src/main/index.ts` 中，确保 `initializeApiHandlers(openclawManager)` 在窗口加载之前调用
