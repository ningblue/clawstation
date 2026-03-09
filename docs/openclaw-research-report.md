# OpenClaw 研究报告

## 概述

本报告基于对 OpenClaw 核心代码库的深入分析，涵盖 agents、tools、memory 等关键模块，为 ClawStation 桌面应用提供功能集成参考。

---

## 1. OpenClaw 功能清单

### 1.1 核心工具 (Core Tools)

| 功能名称 | 描述 | 当前支持状态 | 所属分类 |
|---------|------|-------------|---------|
| read | 读取文件内容 | ✅ 已支持 | Files |
| write | 创建或覆盖文件 | ✅ 已支持 | Files |
| edit | 精确编辑文件 | ✅ 已支持 | Files |
| apply_patch | 补丁文件 (OpenAI) | ✅ 已支持 | Files |
| exec | 执行 shell 命令 | ✅ 已支持 | Runtime |
| process | 管理后台进程 | ✅ 已支持 | Runtime |
| web_search | 网络搜索 | ✅ 已支持 | Web |
| web_fetch | 获取网页内容 | ✅ 已支持 | Web |
| memory_search | 语义搜索 | ✅ 已支持 | Memory |
| memory_get | 读取记忆文件 | ✅ 已支持 | Memory |
| sessions_list | 列出会话 | ✅ 已支持 | Sessions |
| sessions_history | 会话历史 | ✅ 已支持 | Sessions |
| sessions_send | 发送消息到会话 | ✅ 已支持 | Sessions |
| sessions_spawn | 生成子代理 | ✅ 已支持 | Sessions |
| subagents | 管理子代理 | ✅ 已支持 | Sessions |
| session_status | 会话状态 | ✅ 已支持 | Sessions |
| browser | 控制网页浏览器 | ✅ 已支持 | UI |
| canvas | 控制画布 | ✅ 已支持 | UI |
| message | 发送消息 | ✅ 已支持 | Messaging |
| cron | 定时任务 | ✅ 已支持 | Automation |
| gateway | 网关控制 | ✅ 已支持 | Automation |
| nodes | 节点和设备 | ✅ 已支持 | Nodes |
| agents_list | 列出代理 | ✅ 已支持 | Agents |
| image | 图像理解 | ✅ 已支持 | Media |
| tts | 文本转语音 | ✅ 已支持 | Media |

### 1.2 工具配置文件 (Tool Profiles)

| Profile ID | 描述 | 包含工具 |
|-----------|------|---------|
| minimal | 最小化工具集 | session_status |
| coding | 编码工具集 | read, write, edit, apply_patch, exec, process, memory_search, memory_get, sessions_list, sessions_history, sessions_send, sessions_spawn, subagents, session_status, image |
| messaging | 消息工具集 | sessions_list, sessions_history, sessions_send, session_status, message |
| full | 完整工具集 | 所有工具 |

### 1.3 Memory 功能

| 功能 | 描述 | 状态 |
|-----|------|------|
| 向量搜索 | 基于嵌入向量的语义搜索 | ✅ 已支持 |
| FTS 全文搜索 | 纯文本搜索 (无嵌入) | ✅ 已支持 |
| 混合搜索 | 向量 + 关键词混合排名 | ✅ 已支持 |
| 多源索引 | 支持 memory/ 和 sessions/ 文件 | ✅ 已支持 |
| 实时同步 | 文件监视自动索引 | ✅ 已支持 |
| 嵌入缓存 | 减少 API 调用 | ✅ 已支持 |
| 批量处理 | 批量嵌入处理 | ✅ 已支持 |
| QMD 后端 | 外部 QMD 记忆服务 | ✅ 已支持 |

### 1.4 嵌入提供商 (Embedding Providers)

| 提供商 | 类型 | 状态 |
|-------|------|------|
| OpenAI | 远程 API | ✅ 已支持 |
| Gemini | 远程 API | ✅ 已支持 |
| Voyage | 远程 API | ✅ 已支持 |
| Mistral | 远程 API | ✅ 已支持 |
| Local (node-llama-cpp) | 本地模型 | ✅ 已支持 |
| Auto | 自动选择 | ✅ 已支持 |

### 1.5 会话管理功能

| 功能 | 描述 | 状态 |
|-----|------|------|
| 会话列表 | 列出所有会话 | ✅ 已支持 |
| 会话历史 | 获取会话消息历史 | ✅ 已支持 |
| 发送消息 | 向会话发送消息 | ✅ 已支持 |
| 生成子代理 | 创建子代理会话 | ✅ 已支持 |
| 子代理管理 | 列出/管理子代理 | ✅ 已支持 |
| 会话状态 | 获取会话状态信息 | ✅ 已支持 |

### 1.6 浏览器控制功能

| 功能 | 描述 | 状态 |
|-----|------|------|
| 浏览器状态 | 获取浏览器状态 | ✅ 已支持 |
| 启动/停止 | 控制浏览器实例 | ✅ 已支持 |
| 配置文件管理 | Chrome/OpenClaw 配置 | ✅ 已支持 |
| 标签页管理 | 打开/关闭/切换标签 | ✅ 已支持 |
| 页面快照 | AI 可读的页面表示 | ✅ 已支持 |
| 截图 | 页面截图 | ✅ 已支持 |
| 导航 | 页面导航 | ✅ 已支持 |
| 控制台消息 | 获取浏览器控制台 | ✅ 已支持 |
| PDF 导出 | 保存页面为 PDF | ✅ 已支持 |
| 文件上传 | 处理文件选择器 | ✅ 已支持 |
| 对话框处理 | 确认/提示对话框 | ✅ 已支持 |
| 页面操作 | 点击/输入等交互 | ✅ 已支持 |

---

## 2. 缺失功能的支持方案

### 2.1 已识别缺失功能

| 缺失功能 | 影响等级 | 支持方案 |
|---------|---------|---------|
| 可视化工具配置界面 | 高 | 需要新增 React 组件 |
| 记忆管理可视化 | 高 | 需要新增 API + 组件 |
| 嵌入提供商配置 UI | 中 | 需要新增表单组件 |
| 浏览器控制面板 | 中 | 需要新增 UI 组件 |
| 会话管理界面 | 中 | 需要新增列表/详情组件 |
| 子代理监控 | 中 | 需要新增状态监控组件 |
| 文件系统浏览器 | 低 | 可复用现有编辑器 |
| 进程管理器 | 低 | 需要新增简单列表组件 |

### 2.2 优先级建议

1. **P0 (必需)**: 工具配置界面、记忆搜索界面
2. **P1 (重要)**: 会话管理、嵌入配置
3. **P2 (可选)**: 浏览器控制面板、子代理监控

---

## 3. 需要新增的 API 端点

### 3.1 工具管理 API

```typescript
// GET /api/tools/catalog
// 获取工具目录
interface ToolCatalogResponse {
  sections: Array<{
    id: string;
    label: string;
    tools: Array<{
      id: string;
      label: string;
      description: string;
    }>;
  }>;
  profiles: Array<{
    id: "minimal" | "coding" | "messaging" | "full";
    label: string;
    toolIds: string[];
  }>;
}

// GET /api/tools/profiles/:profileId
// 获取特定配置文件的详细信息

// POST /api/tools/validate
// 验证工具配置
interface ToolValidationRequest {
  toolId: string;
  config: Record<string, unknown>;
}
```

### 3.2 Memory 管理 API

```typescript
// GET /api/memory/status
// 获取记忆系统状态
interface MemoryStatusResponse {
  backend: "builtin" | "qmd";
  provider: string;
  model?: string;
  files: number;
  chunks: number;
  dirty: boolean;
  sources: string[];
  fts: {
    enabled: boolean;
    available: boolean;
  };
  vector: {
    enabled: boolean;
    available?: boolean;
    dims?: number;
  };
}

// POST /api/memory/search
// 执行记忆搜索
interface MemorySearchRequest {
  query: string;
  maxResults?: number;
  minScore?: number;
}

interface MemorySearchResponse {
  results: Array<{
    path: string;
    startLine: number;
    endLine: number;
    score: number;
    snippet: string;
    source: "memory" | "sessions";
  }>;
}

// POST /api/memory/sync
// 触发记忆同步

// GET /api/memory/file/:path
// 读取记忆文件内容

// DELETE /api/memory/cache
// 清除嵌入缓存
```

### 3.3 会话管理 API

```typescript
// GET /api/sessions
// 列出所有会话
interface SessionsListResponse {
  sessions: Array<{
    id: string;
    agentId: string;
    label?: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
  }>;
}

// GET /api/sessions/:sessionId
// 获取会话详情

// GET /api/sessions/:sessionId/history
// 获取会话历史消息

// POST /api/sessions/:sessionId/send
// 发送消息到会话

// POST /api/sessions/:sessionId/spawn
// 生成子代理

// GET /api/sessions/:sessionId/subagents
// 获取子代理列表

// DELETE /api/sessions/:sessionId
// 删除会话
```

### 3.4 浏览器控制 API

```typescript
// GET /api/browser/status
// 获取浏览器状态

// POST /api/browser/start
// 启动浏览器

// POST /api/browser/stop
// 停止浏览器

// GET /api/browser/tabs
// 获取标签页列表

// POST /api/browser/tabs/open
// 打开新标签页

// POST /api/browser/snapshot
// 获取页面快照

// POST /api/browser/screenshot
// 截图

// POST /api/browser/act
// 执行页面操作
```

### 3.5 嵌入配置 API

```typescript
// GET /api/embeddings/providers
// 获取可用嵌入提供商列表

// GET /api/embeddings/config
// 获取当前嵌入配置

// POST /api/embeddings/config
// 更新嵌入配置

// POST /api/embeddings/test
// 测试嵌入提供商连接
```

---

## 4. 需要新增的页面/组件

### 4.1 页面路由

| 路由 | 页面名称 | 描述 |
|-----|---------|------|
| /tools | 工具管理页 | 工具目录和配置 |
| /tools/memory | 记忆管理页 | 记忆搜索和管理 |
| /tools/browser | 浏览器控制页 | 浏览器远程控制 |
| /sessions | 会话管理页 | 会话列表和管理 |
| /sessions/:id | 会话详情页 | 单个会话详情 |
| /settings/embeddings | 嵌入设置页 | 嵌入提供商配置 |

### 4.2 React 组件清单

#### 4.2.1 工具相关组件

```typescript
// ToolCatalog.tsx - 工具目录组件
interface ToolCatalogProps {
  onToolSelect?: (toolId: string) => void;
  selectedProfile?: "minimal" | "coding" | "messaging" | "full";
}

// ToolProfileSelector.tsx - 工具配置选择器
interface ToolProfileSelectorProps {
  value: string;
  onChange: (profile: string) => void;
  allowCustom?: boolean;
}

// ToolConfigPanel.tsx - 工具配置面板
interface ToolConfigPanelProps {
  toolId: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}
```

#### 4.2.2 Memory 相关组件

```typescript
// MemorySearch.tsx - 记忆搜索组件
interface MemorySearchProps {
  onResultSelect?: (result: MemorySearchResult) => void;
  maxResults?: number;
  minScore?: number;
}

// MemoryStatusCard.tsx - 记忆状态卡片
interface MemoryStatusCardProps {
  status: MemoryProviderStatus;
}

// MemoryFileViewer.tsx - 记忆文件查看器
interface MemoryFileViewerProps {
  filePath: string;
  highlightLines?: [number, number];
}

// EmbeddingProviderSelector.tsx - 嵌入提供商选择器
interface EmbeddingProviderSelectorProps {
  value: string;
  onChange: (provider: string) => void;
  providers: Array<{
    id: string;
    name: string;
    type: "local" | "remote";
  }>;
}
```

#### 4.2.3 会话相关组件

```typescript
// SessionList.tsx - 会话列表
interface SessionListProps {
  agentId?: string;
  onSelect?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
}

// SessionDetail.tsx - 会话详情
interface SessionDetailProps {
  sessionId: string;
}

// SessionHistory.tsx - 会话历史
interface SessionHistoryProps {
  sessionId: string;
  limit?: number;
}

// SubagentList.tsx - 子代理列表
interface SubagentListProps {
  parentSessionId: string;
}

// SpawnSubagentDialog.tsx - 生成子代理对话框
interface SpawnSubagentDialogProps {
  parentSessionId: string;
  open: boolean;
  onClose: () => void;
  onSpawn: (result: SpawnResult) => void;
}
```

#### 4.2.4 浏览器相关组件

```typescript
// BrowserControlPanel.tsx - 浏览器控制面板
interface BrowserControlPanelProps {
  sandboxBridgeUrl?: string;
  allowHostControl?: boolean;
}

// BrowserTabList.tsx - 浏览器标签列表
interface BrowserTabListProps {
  tabs: Array<{
    id: string;
    url: string;
    title?: string;
    active?: boolean;
  }>;
  onSelect?: (tabId: string) => void;
  onClose?: (tabId: string) => void;
}

// BrowserSnapshot.tsx - 浏览器快照显示
interface BrowserSnapshotProps {
  snapshot: {
    format: "ai" | "aria";
    content: string;
    url?: string;
  };
}

// BrowserScreenshot.tsx - 浏览器截图
interface BrowserScreenshotProps {
  imagePath: string;
  fullPage?: boolean;
}
```

---

## 5. 配置数据结构设计

### 5.1 工具配置 (ToolsConfig)

```typescript
interface ToolsConfig {
  // 工具配置文件
  profile?: "minimal" | "coding" | "messaging" | "full" | "custom";

  // 自定义工具允许列表
  allow?: string[];

  // 工具拒绝列表
  deny?: string[];

  // 执行工具配置
  exec?: {
    host?: "sandbox" | "gateway" | "node";
    security?: "allowlist" | "deny" | "full";
    ask?: "on" | "off" | "on-miss";
    node?: string;
    pathPrepend?: string[];
    safeBins?: string[];
    safeBinTrustedDirs?: string[];
    safeBinProfiles?: Record<string, SafeBinProfile>;
    backgroundMs?: number;
    timeoutSec?: number;
    cleanupMs?: number;
    notifyOnExit?: boolean;
    applyPatch?: {
      enabled?: boolean;
      workspaceOnly?: boolean;
      allowModels?: string[];
    };
  };

  // 文件系统工具配置
  fs?: {
    workspaceOnly?: boolean;
  };

  // 循环检测配置
  loopDetection?: {
    enabled?: boolean;
    detectors?: {
      repetition?: boolean;
      oscillation?: boolean;
      stagnation?: boolean;
    };
  };
}

interface SafeBinProfile {
  allowArgs?: string[];
  denyArgs?: string[];
  requireArgs?: string[];
}
```

### 5.2 记忆配置 (MemoryConfig)

```typescript
interface MemoryConfig {
  // 记忆搜索配置
  memorySearch?: {
    // 提供商: openai | local | gemini | voyage | mistral | auto
    provider?: string;

    // 远程 API 配置
    remote?: {
      baseUrl?: string;
      apiKey?: string;
      headers?: Record<string, string>;
    };

    // 本地模型配置
    local?: {
      modelPath?: string;
      modelCacheDir?: string;
    };

    // 回退配置
    fallback?: "openai" | "local" | "gemini" | "voyage" | "mistral" | "none";

    // 模型选择
    model?: string;

    // 数据源
    sources?: ("memory" | "sessions")[];

    // 额外路径
    extraPaths?: string[];

    // 存储配置
    store?: {
      path?: string;
      vector?: {
        enabled?: boolean;
        extensionPath?: string;
      };
    };

    // 查询配置
    query?: {
      maxResults?: number;
      minScore?: number;
      hybrid?: {
        enabled?: boolean;
        vectorWeight?: number;
        textWeight?: number;
        candidateMultiplier?: number;
        mmr?: {
          enabled?: boolean;
          lambda?: number;
        };
        temporalDecay?: {
          enabled?: boolean;
          halfLifeDays?: number;
        };
      };
    };

    // 同步配置
    sync?: {
      onSessionStart?: boolean;
      onSearch?: boolean;
      intervalMs?: number;
    };

    // 缓存配置
    cache?: {
      enabled?: boolean;
      maxEntries?: number;
    };

    // 批量配置
    batch?: {
      enabled?: boolean;
      wait?: boolean;
      concurrency?: number;
      pollIntervalMs?: number;
      timeoutMs?: number;
    };
  };
}
```

### 5.3 浏览器配置 (BrowserConfig)

```typescript
interface BrowserConfig {
  browser?: {
    enabled?: boolean;

    // 快照默认配置
    snapshotDefaults?: {
      mode?: "efficient" | "full";
    };

    // Chrome 扩展配置
    chromeExtension?: {
      enabled?: boolean;
    };

    // Playwright 配置
    playwright?: {
      headless?: boolean;
      executablePath?: string;
    };
  };

  // 网关节点浏览器配置
  gateway?: {
    nodes?: {
      browser?: {
        mode?: "auto" | "manual" | "off";
        node?: string;
      };
    };
  };
}
```

### 5.4 会话配置 (SessionsConfig)

```typescript
interface SessionsConfig {
  // 会话存储配置
  sessions?: {
    // 会话保留策略
    retention?: {
      maxAgeDays?: number;
      maxCount?: number;
    };

    // 自动保存配置
    autoSave?: {
      enabled?: boolean;
      intervalMs?: number;
    };
  };

  // 子代理配置
  subagents?: {
    // 最大深度
    maxDepth?: number;

    // 默认超时
    defaultTimeoutSeconds?: number;

    // 工具继承
    inheritTools?: boolean;
  };
}
```

### 5.5 完整配置结构

```typescript
interface ClawStationConfig {
  // OpenClaw 核心配置
  openclaw?: {
    // 工具配置
    tools?: ToolsConfig;

    // 记忆配置
    ...MemoryConfig;

    // 浏览器配置
    ...BrowserConfig;

    // 会话配置
    ...SessionsConfig;

    // 代理默认配置
    agents?: {
      defaults?: {
        model?: string;
        thinking?: "low" | "medium" | "high";
        tools?: {
          profile?: string;
        };
        memorySearch?: MemoryConfig["memorySearch"];
        sandbox?: {
          mode?: "off" | "non-main" | "all";
          browser?: {
            enabled?: boolean;
          };
        };
      };

      // 特定代理配置
      list?: Array<{
        id: string;
        name?: string;
        model?: string;
        thinking?: string;
        tools?: ToolsConfig;
        memorySearch?: MemoryConfig["memorySearch"];
      }>;
    };
  };

  // ClawStation 桌面应用配置
  clawstation?: {
    // UI 配置
    ui?: {
      theme?: "light" | "dark" | "system";
      sidebarCollapsed?: boolean;
      defaultPage?: string;
    };

    // 快捷命令配置
    quickCommands?: Array<{
      id: string;
      label: string;
      command: string;
      icon?: string;
    }>;

    // 键盘快捷键
    keyboardShortcuts?: Record<string, string>;
  };
}
```

---

## 6. 集成建议

### 6.1 后端集成

1. **IPC 通道扩展**: 在现有 IPC 处理器基础上新增以下通道:
   - `tools:catalog` - 工具目录
   - `tools:execute` - 工具执行
   - `memory:search` - 记忆搜索
   - `memory:status` - 记忆状态
   - `sessions:list` - 会话列表
   - `sessions:history` - 会话历史
   - `browser:control` - 浏览器控制

2. **配置管理**: 复用现有的 `src/main/openclaw-manager.ts` 模式，新增 `OpenClawConfigManager` 类。

3. **安全考虑**: 所有工具执行应通过主进程代理，确保沙箱安全。

### 6.2 前端集成

1. **状态管理**: 使用 Zustand 创建 `useOpenClawStore` 管理 OpenClaw 相关状态。

2. **API 客户端**: 在 `src/renderer/utils/api.ts` 中新增 OpenClaw API 封装。

3. **组件库**: 基于 shadcn/ui 构建工具配置表单组件。

### 6.3 依赖要求

```json
{
  "dependencies": {
    "@sinclair/typebox": "^0.x",
    "@mariozechner/pi-agent-core": "^0.x",
    "@mariozechner/pi-coding-agent": "^0.x"
  }
}
```

---

## 7. 参考文件

### 7.1 核心源码文件

- `lib/openclaw/src/agents/tool-catalog.ts` - 工具目录定义
- `lib/openclaw/src/agents/pi-tools.ts` - 工具创建和配置
- `lib/openclaw/src/agents/openclaw-tools.ts` - OpenClaw 工具集合
- `lib/openclaw/src/memory/manager.ts` - 记忆管理器
- `lib/openclaw/src/memory/types.ts` - 记忆类型定义
- `lib/openclaw/src/memory/search-manager.ts` - 记忆搜索管理
- `lib/openclaw/src/memory/embeddings.ts` - 嵌入提供商
- `lib/openclaw/src/agents/tools/browser-tool.ts` - 浏览器工具
- `lib/openclaw/src/agents/tools/message-tool.ts` - 消息工具
- `lib/openclaw/src/agents/tools/sessions-spawn-tool.ts` - 子代理工具
- `lib/openclaw/src/agents/bash-tools.exec.ts` - 执行工具

### 7.2 配置文件参考

- `lib/openclaw/src/config/types.ts` - 配置类型导出
- `lib/openclaw/src/config/types.tools.ts` - 工具配置类型
- `lib/openclaw/src/config/types.memory.ts` - 记忆配置类型

---

*报告生成时间: 2026-02-26*
*基于 OpenClaw 代码库分析*
