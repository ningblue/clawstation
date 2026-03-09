# ClawStation UI/UX 改进方案

参考 LobeHub 设计，对 ClawStation 对话页面进行全面交互升级。

## 1. 消息气泡增强

### 1.1 消息操作菜单
- 复制消息内容
- 重新生成回复
- 编辑消息
- 删除消息
- 折叠/展开长消息
- 分享消息

### 1.2 代码块增强
- 集成 highlight.js 语法高亮
- 代码块一键复制按钮
- 显示代码语言标签
- 行号显示（可选）

### 1.3 思考过程展示
- 可折叠的思考过程区域
- 思考时间显示
- 思考步骤展示

## 2. 输入区域增强

### 2.1 工具栏
- 附件按钮（预留功能）
- 语音输入按钮（预留功能）
- 模型参数快捷调整（temperature等）
- 快捷提示词栏

### 2.2 输入框
- 支持多行输入
- 自动调整高度
- 快捷键支持（Cmd+Enter 发送）

## 3. 模型切换快捷入口

- 对话页面顶部显示当前模型
- 点击弹出模型选择面板
- 支持搜索模型
- 显示模型提供商标签

## 4. 会话列表改进

### 4.1 搜索功能
- Cmd/Ctrl+K 快捷键触发
- 实时过滤会话
- 高亮匹配文本

### 4.2 分组显示
- 今天
- 昨天
- 上周
- 更早

### 4.3 会话管理
- 固定/置顶会话
- 拖拽排序

## 5. 快捷键支持

| 快捷键 | 功能 |
|--------|------|
| Cmd/Ctrl+K | 搜索会话 |
| Cmd/Ctrl+N | 新建会话 |
| Cmd/Ctrl+Enter | 发送消息 |
| Escape | 关闭设置面板/取消编辑 |
| Cmd/Ctrl+Shift+O | 打开设置 |

## 实现文件

- `src/renderer/styles/chat.css` - 对话页面样式
- `src/renderer/components/chat/` - 对话组件
  - `MessageBubble.tsx` - 消息气泡组件
  - `MessageActions.tsx` - 消息操作菜单
  - `CodeBlock.tsx` - 代码块组件
  - `ChatInput.tsx` - 输入区域组件
  - `ModelSelector.tsx` - 模型选择器
  - `ConversationList.tsx` - 会话列表
