# 模型配置解耦设计

## 背景

当前应用的模型配置直接依赖 OpenClaw 引擎的配置数据结构，没有应用层自己的存储。导致：

1. 模型数据 4 处重复定义（`provider-groups.ts`、`useModels.ts`、`model-catalog.service.ts`、`settings/index.tsx`）
2. 模式概念（Model API / Coding Plan）靠前端硬编码 provider ID 后缀区分，后端不知情
3. 用户选择模型后直写 `openclaw.json`，无中间层
4. Provider ID 碎片化（如 `modelstudio` vs `modelstudio-plan`），部分 ID OpenClaw 不认识

## ���标

- 应用业务层拥有独立的模型配置存储（`model-config.json`）
- 业务配置与 OpenClaw 配置通过映射同步层连接，不直接耦合
- 消除重复定义，建立单一真相源
- 老用户升级无感迁移

## 三种模式

保持现有划分不变：

| 模式 | 说明 | 当前状态 |
|------|------|----------|
| `default` | 默认大模型 | 暂不实现，预留 |
| `model-api` | 自定义大模型 - 模型API | 用户自己的 API Key 直连厂商 |
| `coding-plan` | 自定义大模型 - Coding Plan | 厂商预付费套餐 |

## 架构总览

```
┌─ 应用业务层 ──────────────────────────────────────────────────┐
│                                                                │
│  UI 层 (InlineModelPicker / AIModelSettings / Settings)       │
│    ↕                                                          │
│  useModels hook ← 从应用层 IPC API 获取数据                   │
│    ↕                                                          │
│  IPC: app:model-config:*                                      │
│                                                                │
└────────────────────────── IPC Bridge ──────────────────────────┘
                               │
┌─ 后端服务层 ─────────────────┼─────────────────────────────────┐
│                              │                                  │
│  model-config.route.ts ──→ AppModelConfigManager               │
│                             ├── ~/.clawstation/model-config.json│
│                             │   (应用层独立存储)                │
│                             │                                   │
│                             └─→ ModelConfigSyncService          │
│                                  ├── openclaw.json (写入)       │
│                                  └── auth-profiles.json (写入)  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
┌─ OpenClaw 引擎 ─────────────┼─────────────────────────────────┐
│  读取 openclaw.json，按 provider 路由 API 请求                 │
│  Provider = { baseUrl, apiKey, models[] } 的字典               │
│  不感知"模式"概念，只看 provider ID                            │
└─────────────────────────────────────────────────────────────────┘
```

## 存储设计

### 文件：`~/.clawstation/model-config.json`

```typescript
interface AppModelConfig {
  version: 1;
  activeMode: 'default' | 'model-api' | 'coding-plan';
  modes: {
    'model-api': ModeConfig;
    'coding-plan': ModeConfig;
  };
}

interface ModeConfig {
  selectedModel: { vendorId: string; modelId: string } | null;
  vendors: VendorConfig[];
}

interface VendorConfig {
  vendorId: string;           // 应用层厂商ID，如 "modelstudio"
  label: string;              // 显示名，如 "百炼（千问）"
  icon: string;               // 图标缩写��如 "BL"
  openclawProviderId: string; // 写入 openclaw.json 的 provider ID
  baseUrl: string;            // 该模式下的 API 端点
  apiKeyUrl?: string;         // 获取 API Key 的链接
  apiKeyConfigured: boolean;  // 是否已配置 API Key
  models: VendorModel[];      // 该模式下可用��模型列表
}

interface VendorModel {
  id: string;                 // 模型 ID
  name: string;               // 显示名
  contextWindow?: number;     // 上下文窗口大小
}
```

### Provider ID 命名规则（B 方案）

- model-api 模式：使用 OpenClaw 原生 ID（如 `modelstudio`, `minimax`, `volcengine`）
- coding-plan 模式：加 `-plan` 后缀（如 `modelstudio-plan`, `minimax-plan`, `volcengine-plan`）
- 两套配置共存于 `openclaw.json` 的 `models.providers` 中
- 切换模式只需改 `agents.defaults.model` 指向不同 provider

### OpenClaw 配置变化

结构完全不变，仅 `models.providers` 中可能多出 `-plan` 后缀的条目：

```jsonc
// openclaw.json
{
  "models": {
    "providers": {
      "modelstudio":      { "baseUrl": "https://..api..", "apiKey": "sk-xxx", "models": [...] },
      "modelstudio-plan": { "baseUrl": "https://..coding..", "apiKey": "sk-yyy", "models": [...] }
    }
  },
  "agents": {
    "defaults": { "model": "modelstudio-plan/qwen3-coder-plus" }
  }
}
```

## 同步层设计（ModelConfigSyncService）

职责：应用配置变更时，翻译写入 OpenClaw 配置。

### 同步触发点

| 用户操作 | 写 model-config.json | 同步到 openclaw |
|----------|---------------------|-----------------|
| 配置 API Key | vendor.apiKeyConfigured = true | auth-profiles.json + models.providers[openclawId] |
| 删除 API Key | vendor.apiKeyConfigured = false | 删除 auth-profiles + 删除 providers 条目 |
| 选择模型 | selectedModel + activeMode | agents.defaults.model = "openclawId/modelId" |
| 切换模式 | activeMode | agents.defaults.model 指向新模式的选择 |

### 同步规则

1. 写入 `models.providers[openclawProviderId]` 时，包含完整的 `{ baseUrl, apiKey, models }` 配置
2. `apiKey` 从 `auth-profiles.json` 读取，不在 `model-config.json` 中存储密钥
3. 同步是**单向的**：app config → openclaw config，不反向读取

## 迁移兼容设计

### 触发条件

应用启动时，`AppModelConfigManager.initialize()` 检测到 `model-config.json` 不���在。

### 迁移流程

```
migrateFromLegacy()
  │
  ├─ 1. 读 openclaw.json → agents.defaults.model
  │     解析 "provider/model" → 在初始 vendor 数据中匹配所属模式
  │     → 设置 activeMode 和 selectedModel
  │
  ├─ 2. 读 auth-profiles.json → 已配置的 provider 列表
  │     匹配 vendor 数据 → 标记 apiKeyConfigured = true
  │
  └─ 3. 生成 model-config.json
```

### 兼容保证

- 只在 `model-config.json` 不存在时执行一次
- 只读取旧文件，不修改旧文件
- API Key 继续存储在 `auth-profiles.json`（OpenClaw 原生格式）
- 迁移后用户看到的状态与迁移前一致

## 新增/改动文件清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/shared/types/model-config.types.ts` | 新增 | 共享类型定义（AppModelConfig, ModeConfig, VendorConfig 等） |
| `src/shared/constants/vendor-defaults.ts` | 新增 | 厂商初始数据（单一真相源，替代 4 处重复定义） |
| `src/backend/config/app-model-config.ts` | 新增 | AppModelConfigManager，管理 model-config.json 读写 + 迁移 |
| `src/backend/services/model-config-sync.service.ts` | 新增 | 同步层，app config → openclaw config 的翻译写入 |
| `src/api/routes/model-config.route.ts` | 新增 | IPC handlers，暴露应用层模型配置 API |
| `src/preload/index.ts` | 更新 | 新增应用层模型配置 IPC 通道 |
| `src/renderer/types/models.ts` | 更新 | ��用共享类型 |
| `src/renderer/hooks/useModels.ts` | 重构 | 数据源改为新 IPC API，删除 DEFAULT_PROVIDER_MODELS 和重复映射 |
| `src/renderer/config/provider-groups.ts` | 重构/移除 | 业务数据迁移到 vendor-defaults.ts |
| `src/renderer/components/ChatInput/InlineModelPicker.tsx` | 重构 | 数据来源改为 useModels hook，不再直接引用 provider-groups |
| `src/renderer/pages/settings/AIModelSettings.tsx` | 重构 | 同上 |
| `src/renderer/pages/settings/index.tsx` | 重构 | 删除重复的 PROVIDER_DISPLAY_NAMES、getProviderIcon |

## IPC API 设计

### 新增通道

```typescript
// 获取完整应用层模型配置
"app:model-config:get" → AppModelConfig

// 获取指定模式的配置
"app:model-config:getMode" (modeId: string) → ModeConfig

// 选择模型（同时更新 activeMode）
"app:model-config:selectModel" (vendorId: string, modelId: string) → { success: boolean }

// 配置 API Key
"app:model-config:setApiKey" (vendorId: string, apiKey: string, modeId: string) → { success: boolean }

// 删除 API Key
"app:model-config:removeApiKey" (vendorId: string, modeId: string) → { success: boolean }

// 获取当前激活的模型信息
"app:model-config:current" → { mode, vendorId, modelId, modelName, providerLabel } | null

// 切换模式
"app:model-config:setMode" (modeId: string) → { success: boolean }
```

### 保留通道

以下 OpenClaw 原生通道保留，供引擎管理页面使用��
- `openclaw:status`, `openclaw:start`, `openclaw:stop`, `openclaw:restart`
- `openclaw:config:get`, `openclaw:config:gateway`

### 废弃通道

以下通道将被新 API 替代，标记废弃：
- `openclaw:config:defaultModel:set` → 改用 `app:model-config:selectModel`
- `openclaw:apikey:set` / `openclaw:apikey:remove` → 改用 `app:model-config:setApiKey` / `removeApiKey`
- `openclaw:catalog:list` / `openclaw:catalog:providers` → 改用 `app:model-config:get`
