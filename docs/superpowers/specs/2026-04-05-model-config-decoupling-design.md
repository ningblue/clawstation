# 模型配置解耦设计

## 当前状态

- 已完成应用层独立模型配置存储与 OpenClaw 同步层落地
- 已完成设置页与对话页内联模型选择器接入新配置链路
- 已移除预设厂商 API Key、模型切换、模式切换触发网关重启的旧逻辑
- 已验证并修正 MiniMax、GLM Coding Plan、Kimi Coding Plan 的运行时投影配置
- 当前剩余工作以收尾测试、文档整理和后续扩展为主

## 背景

当前应用的模型配置直接依赖 OpenClaw 引擎配置，没有应用层自己的持久化模型配置。结果是：

1. 模型数据在 4 处重复定义：`provider-groups.ts`、`useModels.ts`、`model-catalog.service.ts`、`settings/index.tsx`
2. “模式”概念（Model API / Coding Plan）靠前端硬编码 provider ID 后缀区分，后端并不知情
3. 用户选择模型后直接改写 `openclaw.json`，没有业务层中间态
4. Provider ID 已经碎片化，例如 `modelstudio`、`modelstudio-plan`、`zai-coding` 混用，部分仅对应用 UI 有意义，OpenClaw 不应该承载这些业务语义

## 目标

- 应用业务层拥有独立的模型配置存储：`model-config.json`
- 业务配置与 OpenClaw 配置通过同步层连接，而不是直接耦合
- 消除重复定义，建立单一真相源
- 老用户升级时无感迁移
- 为后续新增模式、厂商别名、认证方式差异留出扩展空间

## 非目标

- 本期不改 OpenClaw 配置文件结构
- 本期不改 OpenClaw provider 的内部实现
- 本期不引入云端同步
- 本期不实现 `default` 模式的完整业务能力，只保留类型和接口占位
- 本期不处理搜索 API、工具 API 等非模型配置

## 三种模式

保持当前产品划分不变：

| 模式 | 说明 | 本期状态 |
|------|------|----------|
| `default` | 默认大模型 | 仅保留占位，不开放配置 |
| `model-api` | 自定义大模型 - 模型 API | 本期实现 |
| `coding-plan` | 自定义大模型 - Coding Plan | 本期实现 |

## 核心设计原则

1. 应用层拥有业务真相源，OpenClaw 只是运行时投影
2. 密钥不进入 `model-config.json`，只存能力状态和业务元数据
3. 同步方向固定为单向：`model-config.json` -> OpenClaw 配置
4. UI 不再基于 provider ID 命名约定推断模式
5. 同一个业务厂商在不同模式下允许映射到不同 OpenClaw provider
6. 迁移只执行一次，且只读取旧数据，不破坏旧数据

## 架构总览

```text
┌─ 应用业务层 ───────────────────────────────────────────────────┐
│                                                               │
│  UI 层 (InlineModelPicker / AIModelSettings / Settings)       │
│    ↕                                                          │
│  useModels hook ← 从应用层 IPC API 获取数据                   │
│    ↕                                                          │
│  IPC: app:model-config:*                                      │
│                                                               │
└────────────────────────── IPC Bridge ─────────────────────────┘
                              │
┌─ 后端服务层 ────────────────┼──────────────────────────────────┐
│                             │                                  │
│  model-config.route.ts ──→ AppModelConfigManager              │
│                            ├── ~/.clawstation/model-config.json│
│                            │   (应用层独立存储)                │
│                            │                                  │
│                            └─→ ModelConfigSyncService         │
│                                 ├── openclaw.json             │
│                                 └── auth-profiles.json        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                              │
┌─ OpenClaw 引擎 ─────────────┼──────────────────────────────────┐
│  读取 openclaw.json，按 provider 路由 API 请求                │
│  只识别 provider / model，不感知业务模式                     │
└───────────────────────────────────────────────────────────────┘
```

## 存储设计

### 文件

`~/.clawstation/model-config.json`

### 数据结构

```ts
export type ModelModeId = 'default' | 'model-api' | 'coding-plan';

export interface AppModelConfig {
  version: 1;
  activeMode: ModelModeId;
  modes: {
    default: DefaultModeConfig;
    'model-api': ModeConfig;
    'coding-plan': ModeConfig;
  };
}

export interface DefaultModeConfig {
  enabled: false;
}

export interface ModeConfig {
  selectedModel: VendorModelRef | null;
  vendors: VendorConfig[];
}

export interface VendorModelRef {
  vendorId: string;
  modelId: string;
}

export interface VendorConfig {
  vendorId: string;
  label: string;
  icon: string;
  openclawProviderId: string;
  baseUrl: string;
  apiKeyUrl?: string;
  authProfileId: string;
  apiKeyConfigured: boolean;
  models: VendorModel[];
}

export interface VendorModel {
  id: string;
  name: string;
  contextWindow?: number;
}
```

### 设计说明

- `vendorId` 是应用业务 ID，供 UI、迁移、统计、模式切换使用
- `openclawProviderId` 是最终写入 `openclaw.json` 的 provider ID
- `authProfileId` 是认证存储层 ID，允许未来出现“多个 vendor 共用一个认证”的情况
- `apiKeyConfigured` 只是能力快照，不保存密钥本身
- `models` 为该模式下业务允许展示的模型列表，不依赖 OpenClaw 运行时发现结果

## 单一真相源

新增 `vendor-defaults.ts` 作为唯一业务配置源，负责维护：

- 模式定义
- 厂商显示名
- 图标
- API Key 获取链接
- OpenClaw provider 映射
- 该模式下支持的模型列表
- 共享认证关系

以下位置不得再定义业务模型清单：

- `src/renderer/hooks/useModels.ts`
- `src/renderer/config/provider-groups.ts`
- `src/backend/services/model-catalog.service.ts`
- `src/renderer/pages/settings/index.tsx`

这些模块只能消费共享配置或运行时结果，不能再次内嵌模型元数据。

## Provider ID 命名规则

采用 B 方案，明确区分业务 ID 与运行时 ID。

### 规则

- `model-api` 模式优先使用 OpenClaw 原生 provider ID
- `coding-plan` 模式使用独立 provider ID，默认采用 `-plan` 后缀
- 若已有历史原因导致的特殊命名（如 `zai-coding`），允许保留，但必须在共享配置中显式声明，不能靠字符串推导

### 示例

| mode | vendorId | openclawProviderId |
|------|----------|--------------------|
| `model-api` | `modelstudio` | `modelstudio` |
| `coding-plan` | `modelstudio` | `modelstudio-plan` |
| `model-api` | `volcengine` | `volcengine` |
| `coding-plan` | `volcengine` | `volcengine-plan` |

### 结论

模式语义归应用层管理，OpenClaw 只保留运行时 provider 路由职责。

## OpenClaw 配置投影

OpenClaw 配置结构不变，只是 `models.providers` 的内容由应用层投影生成。

```jsonc
{
  "models": {
    "providers": {
      "modelstudio": {
        "baseUrl": "https://...",
        "apiKey": "sk-xxx",
        "models": [{ "id": "qwen3-coder-plus", "name": "Qwen3 Coder Plus" }]
      },
      "modelstudio-plan": {
        "baseUrl": "https://...",
        "apiKey": "sk-yyy",
        "models": [{ "id": "qwen3-coder-plus", "name": "Qwen3 Coder Plus" }]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "modelstudio-plan/qwen3-coder-plus"
    }
  }
}
```

## 同步层设计

`ModelConfigSyncService` 负责把应用配置翻译成 OpenClaw 运行时配置。

### 职责

1. 根据 `model-config.json` 重建目标 provider 配置
2. 从 `auth-profiles.json` 读取密钥，拼装 `models.providers[*].apiKey`
3. 维护 `agents.defaults.model`
4. 在删除 API Key 后清理失效 provider 投影
5. 在模式切换时把默认模型切到该模式已选模型

### 同步触发点

| 用户操作 | 写 `model-config.json` | 同步到 OpenClaw |
|----------|------------------------|-----------------|
| 配置 API Key | `vendor.apiKeyConfigured = true` | 写 auth profile，写 providers 条目 |
| 删除 API Key | `vendor.apiKeyConfigured = false` | 删 auth profile，删 providers 条目 |
| 选择模型 | 更新 `selectedModel` | 更新 `agents.defaults.model` |
| 切换模式 | 更新 `activeMode` | 更新 `agents.defaults.model` |
| 初始化迁移 | 生成完整配置 | 一次性全量同步 |

### 同步规则

1. `model-config.json` 永远是输入源，不从 OpenClaw 配置反向回写业务状态
2. 只有 `apiKeyConfigured = true` 且 auth profile 存在时，才生成对应 provider 投影
3. `selectedModel` 指向未配置 API Key 的 vendor 时，不写入 `agents.defaults.model`
4. 如果当前 `activeMode` 没有可用选中模型，保留 OpenClaw 现值并返回可观测告警
5. 同步应尽量全量重建目标片段，避免增量 patch 带来的脏状态累积

## AppModelConfigManager 设计

`AppModelConfigManager` 负责应用层配置文件本身。

### 职责

- 初始化默认配置
- 首次启动从 legacy 配置迁移
- 提供原子读写
- 对外暴露按模式读取、选模型、切模式、设置 API Key 状态的方法
- 调用同步层完成运行时投影

### 写入原则

- 使用“读最新 -> 纯函数变换 -> 覆盖写入”的模式
- 写入失败时不修改内存态
- 所有对外变更接口都先落 `model-config.json`，后同步 OpenClaw

### 原子性要求

- 配置文件写入采用临时文件 + rename 覆盖
- 若同步 OpenClaw 失败，保留已写入的业务配置，但返回错误并记录日志
- 下次应用启动或用户再次操作时允许重试同步

## 迁移兼容设计

### 触发条件

应用启动时若 `model-config.json` 不存在，则执行一次 `migrateFromLegacy()`。

### 迁移输入

- `openclaw.json`
- `auth-profiles.json`
- 当前内置的 vendor 默认配置

### 迁移流程

```text
migrateFromLegacy()
  │
  ├─ 1. 读取 openclaw.json 中的 agents.defaults.model
  │     解析 provider/model
  │
  ├─ 2. 在 vendor-defaults 中匹配 openclawProviderId
  │     命中则恢复 activeMode 和 selectedModel
  │
  ├─ 3. 读取 auth-profiles.json
  │     标记对应 vendor.apiKeyConfigured = true
  │
  ├─ 4. 生成 model-config.json
  │
  └─ 5. 触发一次全量同步，确保运行时配置与业务配置一致
```

### 迁移映射规则

- 优先按 `openclawProviderId` 精确匹配 vendor
- 若一个 provider 可能映射多个业务 vendor，按模式优先级匹配当前 `agents.defaults.model`
- 未识别 provider 不写入业务配置，仅记录 warning

### 兼容保证

- 只在 `model-config.json` 缺失时执行一次
- 只读取旧文件，不修改旧文件内容
- API Key 仍然保存在 `auth-profiles.json`
- 迁移后用户看到的选中模型、模式、已配置状态尽量与迁移前一致

## IPC API 设计

### 新增通道

```ts
"app:model-config:get" -> AppModelConfig

"app:model-config:getMode" (modeId: ModelModeId) -> ModeConfig

"app:model-config:selectModel" (
  modeId: ModelModeId,
  vendorId: string,
  modelId: string
) -> { success: boolean }

"app:model-config:setApiKey" (
  modeId: ModelModeId,
  vendorId: string,
  apiKey: string
) -> { success: boolean }

"app:model-config:removeApiKey" (
  modeId: ModelModeId,
  vendorId: string
) -> { success: boolean }

"app:model-config:current" -> {
  modeId: ModelModeId;
  vendorId: string;
  modelId: string;
  modelName: string;
  providerLabel: string;
} | null

"app:model-config:setMode" (modeId: ModelModeId) -> { success: boolean }
```

### 保留通道

以下 OpenClaw 原生通道继续保留，供引擎管理页使用：

- `openclaw:status`
- `openclaw:start`
- `openclaw:stop`
- `openclaw:restart`
- `openclaw:config:get`
- `openclaw:config:gateway`

### 废弃通道

以下通道由新应用层 API 替代：

- `openclaw:config:defaultModel:set` -> `app:model-config:selectModel`
- `openclaw:apikey:set` -> `app:model-config:setApiKey`
- `openclaw:apikey:remove` -> `app:model-config:removeApiKey`
- `openclaw:catalog:list` / `openclaw:catalog:providers` -> `app:model-config:get`

### IPC 约束

- 前端不得再直接推导 provider 后缀来判断模式
- `selectModel` 必须显式带 `modeId`
- `setApiKey/removeApiKey` 必须带 `modeId + vendorId`，避免“同名 vendor 跨模式串写”

## 前端重构要求

### useModels

- 数据源改为 `app:model-config:get`
- `DEFAULT_PROVIDER_MODELS` 删除
- `PROVIDER_DISPLAY_NAMES` 删除
- 当前选择、已配置状态、模型列表统一从应用层配置派生
- 运行时 OpenClaw model catalog 仅可作为补充元信息来源，不再是业务主数据源

### provider-groups

- 保留的话只能负责 UI 分组，不再保存模型和认证真相
- 更理想的做法是由 `vendor-defaults.ts` 派生 UI 分组视图模型

### AIModelSettings / InlineModelPicker / Settings

- 不再各自维护 provider label/icon 映射
- 全部使用共享配置字段
- 当前模型展示应展示业务 label，而不是裸字符串 `provider/model`

## 失败处理与回滚策略

### 业务配置写入失败

- 当前操作整体失败
- 不触发 OpenClaw 同步
- 前端收到失败响应

### OpenClaw 同步失败

- `model-config.json` 已更新，业务配置视为成功
- 返回“已保存但引擎同步失败”的错误信息
- 记录日志，允许用户重试或应用重启后自动重试

### auth profile 写入失败

- 当前操作失败
- 不修改 `apiKeyConfigured`
- 不写入 provider 投影

### 非法配置兜底

若检测到以下异常状态：

- `activeMode` 指向不存在模式
- `selectedModel.vendorId` 不存在
- `selectedModel.modelId` 不在 vendor 的模型列表里

则按以下顺序兜底：

1. 保留文件可读并记录 warning
2. 清空非法 `selectedModel`
3. 不自动猜测新模型，避免误切用户模型

## 分阶段实施计划

### Phase 1：共享类型和默认配置

- 新增共享类型
- 新增 `vendor-defaults.ts`
- 删除前端散落的 provider/model 常量

### Phase 2：后端业务配置管理

- 实现 `AppModelConfigManager`
- 实现首次迁移
- 实现 `ModelConfigSyncService`

### Phase 3：IPC 暴露

- 新增 `app:model-config:*` 路由
- preload 暴露新接口
- 保留老接口但标记 deprecated

### Phase 4：前端切换新数据源

- `useModels` 改为新 IPC
- `AIModelSettings` 改为消费应用层配置
- `InlineModelPicker` 改为消费应用层配置

### Phase 5：清理遗留

- 删除重复业务常量
- 删除老通道调用
- 补单测与迁移测试

## 测试与验收

### 单元测试

- `AppModelConfigManager` 默认初始化
- legacy 配置迁移
- 选择模型
- 切换模式
- 配置 / 删除 API Key
- 非法配置自愈

### 集成测试

- 设置 API Key 后，`model-config.json` 与 `openclaw.json` 同步正确
- 删除 API Key 后，对应 provider 投影被清理
- 切换模式后，`agents.defaults.model` 指向目标模式已选模型
- 重启应用后状态可恢复

### 回归验收

- 老用户升级后无需重新配置模型
- 设置页、内联模型选择器、当前模型展示一致
- 不再出现前端显示有模型、后端实际无 provider 的分裂状态
- 不再依赖 provider ID 后缀推断模式

## 风险与注意事项

1. 现有工作区中前端文件已开始重构，但尚未切到新后端接口，属于中间态，不能作为最终实现基线
2. 若继续沿用运行时 model catalog 作为主数据，会重新引入“OpenClaw 反向决定业务展示”的耦合
3. 某些历史 provider 命名并不规整，必须通过显式映射处理，不能靠字符串规则补丁
4. `default` 模式本期仅占位，UI 必须避免把它当成已完成功能

## 新增/改动文件清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/shared/types/model-config.types.ts` | 新增 | 共享类型定义 |
| `src/shared/constants/vendor-defaults.ts` | 新增 | 单一真相源 |
| `src/backend/config/app-model-config.ts` | 新增 | `AppModelConfigManager` |
| `src/backend/services/model-config-sync.service.ts` | 新增 | 同步层 |
| `src/api/routes/model-config.route.ts` | 新增 | 应用层 IPC |
| `src/preload/index.ts` | 更新 | 暴露新 IPC |
| `src/renderer/types/models.ts` | 更新 | 复用共享类型 |
| `src/renderer/hooks/useModels.ts` | 重构 | 改为新数据源 |
| `src/renderer/config/provider-groups.ts` | 重构/瘦身 | 只保留 UI 分组职责 |
| `src/renderer/components/ChatInput/InlineModelPicker.tsx` | 重构 | 消费新 hook |
| `src/renderer/pages/settings/AIModelSettings.tsx` | 重构 | 消费新 hook |
| `src/renderer/pages/settings/index.tsx` | 重构 | 删除重复映射逻辑 |

## 结论

本方案的关键不是“把配置文件换个地方存”，而是把模型配置从 OpenClaw 运行时语义中抽离出来，明确成应用自己的业务模型层。只有这样，前端展示、后端状态、迁移兼容和后续扩展才能真正稳定。
