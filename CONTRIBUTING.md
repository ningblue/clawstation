# 贡献指南

感谢您对 X-Claw 项目的关注！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请通过 [GitHub Issues](https://github.com/ningblue/clawstation/issues) 提交。

提交问题时，请包含以下信息：
- 问题的清晰描述
- 复现步骤（如果是 bug）
- 期望的行为
- 实际的行为
- 截图（如果适用）
- 环境信息（操作系统、Node.js 版本等）

### 提交代码

1. **Fork 仓库**
   ```bash
   git clone https://github.com/ningblue/clawstation.git
   cd clawstation
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **开发环境准备**
   ```bash
   # 获取 OpenClaw 依赖
   mkdir -p lib
   git clone --depth 1 https://github.com/openclaw/openclaw.git lib/openclaw

   # 安装依赖
   npm install

   # 构建 OpenClaw
   npm run build:openclaw

   # 启动开发模式
   npm run dev
   ```

4. **提交更改**
   - 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范
   - 例如：`feat: 添加新功能`、`fix: 修复 bug`、`docs: 更新文档`

5. **推送并创建 Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 代码规范

### TypeScript
- 使用 TypeScript 编写所有代码
- 启用严格模式检查
- 避免使用 `any` 类型

### 代码风格
- 使用一致的缩进（2 个空格）
- 使用单引号
- 添加适当的注释

### 提交规范
```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型说明：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

## 开发指南

### 项目结构
```
src/
  main/          # Electron 主进程
  preload/       # 预加载脚本
  renderer/      # React 前端
  backend/       # 后端服务
  data/          # 数据库
  api/           # IPC 处理器
```

### 构建流程
```bash
# 开发模式
npm run dev

# 构建 OpenClaw
npm run build:openclaw

# 构建完整应用
npm run build

# 构建 macOS
npm run build:mac

# 构建 Windows
npm run build:win
```

## 行为准则

- 尊重所有参与者
- 接受建设性的批评
- 关注最有益于社区的内容
- 对其他社区成员表示同理心

## 许可证

通过贡献代码，您同意您的贡献将在 [MIT 许可证](LICENSE) 下发布。

## 联系方式

- GitHub Issues: [https://github.com/ningblue/clawstation/issues](https://github.com/ningblue/clawstation/issues)

感谢您的贡献！
