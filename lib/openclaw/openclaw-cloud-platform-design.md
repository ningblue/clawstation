# OpenClaw 云管平台 (OCP) 设计方案

## 一、平台概述

### 1.1 产品定位
**OpenClaw Cloud Platform (OCP)** 是一个多租户 SaaS 平台，为用户提供托管的 OpenClaw Gateway 服务，让用户无需运维即可拥有个人 AI 助手。

### 1.2 核心价值
- 🚀 **一键部署**: 用户注册即获得专属 OpenClaw 实例
- 🔒 **数据隔离**: 每个用户独立 Pod + 独立存储
- 📱 **全渠道支持**: WhatsApp/Telegram/Slack/Discord 等 15+ 渠道
- 🤖 **AI 就绪**: 预配置主流模型 (Claude/GPT/Gemini)
- 📊 **可视化管理**: Web 控制台管理配置、会话、渠道

---

## 二、整体架构设计

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    用户接入层 (Access Layer)                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│   │   Web Console   │    │  Mobile App     │    │   CLI Tool      │    │  Public API   │  │
│   │   (管理控制台)   │    │  (移动应用)      │    │  (命令行工具)    │    │  (开放 API)   │  │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘    └───────┬───────┘  │
│            │                      │                      │                      │         │
│            └──────────────────────┴──────────────────────┘──────────────────────┘         │
│                                           │                                                 │
│                              ┌────────────┴────────────┐                                   │
│                              │     API Gateway         │                                   │
│                              │  - 认证/授权 (JWT)       │                                   │
│                              │  - 限流/熔断             │                                   │
│                              │  - 路由分发              │                                   │
│                              └────────────┬────────────┘                                   │
│                                           │                                                 │
└───────────────────────────────────────────┼─────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 平台控制层 (Control Plane)                                   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           OCP Core Services (核心服务)                               │   │
│  │                                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │  User Service   │  │ Instance Mgr    │  │  Config Service │  │  Billing Service│  │   │
│  │  │  (用户服务)      │  │ (实例管理器)     │  │  (配置服务)      │  │  (计费服务)      │  │   │
│  │  │                 │  │                 │  │                 │  │                 │  │   │
│  │  │ • 注册/登录      │  │ • 创建/销毁      │  │ • 配置模板       │  │ • 套餐管理       │  │   │
│  │  │ • 权限管理       │  │ • 扩缩容        │  │ • 配置下发       │  │ • 用量统计       │  │   │
│  │  │ • 用户数据       │  │ • 健康检查       │  │ • 配置版本       │  │ • 账单生成       │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘  │   │
│  │                                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │ Channel Service │  │  Model Service  │  │  Monitor Service│  │  Alert Service  │  │   │
│  │  │ (渠道服务)       │  │ (模型服务)       │  │ (监控服务)       │  │ (告警服务)       │  │   │
│  │  │                 │  │                 │  │                 │  │                 │  │   │
│  │  │ • 渠道配置       │  │ • 模型代理       │  │ • 指标收集       │  │ • 阈值告警       │  │   │
│  │  │ • 渠道状态       │  │ • 密钥托管       │  │ • 日志聚合       │  │ • 通知推送       │  │   │
│  │  │ • QR 码登录      │  │ • 用量控制       │  │ • 链路追踪       │  │ • 自动恢复       │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           K8s Operator (自定义控制器)                                 │   │
│  │                                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │  OpenClawInstance CRD (自定义资源)                                           │    │   │
│  │  │                                                                               │    │   │
│  │  │  apiVersion: openclaw.cloud/v1alpha1                                          │    │   │
│  │  │  kind: OpenClawInstance                                                       │    │   │
│  │  │  metadata:                                                                    │    │   │
│  │  │    name: user-123-instance                                                    │    │   │
│  │  │    namespace: user-123                                                        │    │   │
│  │  │  spec:                                                                        │    │   │
│  │  │    userId: "user-123"                                                         │    │   │
│  │  │    tier: "pro"              # free/pro/enterprise                             │    │   │
│  │  │    region: "cn-north-1"                                                       │    │   │
│  │  │    storageSize: "10Gi"                                                        │    │   │
│  │  │    channels:                                                                  │    │   │
│  │  │      - whatsapp                                                               │    │   │
│  │  │      - telegram                                                               │    │   │
│  │  │    modelProvider: "anthropic"                                                 │    │   │
│  │  │    resources:                                                                 │    │   │
│  │  │      memory: "512Mi"                                                          │    │   │
│  │  │      cpu: "500m"                                                              │    │   │
│  │  │  status:                                                                      │    │   │
│  │  │    phase: "Running"         # Pending/Creating/Running/Stopped/Error          │    │   │
│  │  │    gatewayUrl: "wss://user-123.ocr.openclaw.cloud"                            │    │   │
│  │  │    lastActivity: "2025-02-27T10:00:00Z"                                       │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                      │   │
│  │  Controller 职责:                                                                    │   │
│  │  1. Watch OpenClawInstance CR 变化                                                 │   │
│  │  2. 协调 K8s 资源 (Deployment/Service/Ingress/PVC)                                  │   │
│  │  3. 管理生命周期 (创建/更新/删除/扩缩容)                                             │   │
│  │  4. 健康检查和自动恢复                                                                │   │
│  │                                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              K8s 运行时层 (Runtime Layer)                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         用户实例命名空间 (User Namespace)                              │   │
│  │  namespace: user-123                                                                  │   │
│  │                                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │  OpenClaw Gateway Pod (用户专属实例)                                         │    │   │
│  │  │                                                                               │    │   │
│  │  │  ┌─────────────────────────────────────────────────────────────────────────┐ │    │   │
│  │  │  │  Container: openclaw-gateway                                             │ │    │   │
│  │  │  │                                                                          │ │    │   │
│  │  │  │  Environment:                                                            │ │    │   │
│  │  │  │    OPENCLAW_STATE_DIR=/data/openclaw                                     │ │    │   │
│  │  │  │    OPENCLAW_CONFIG_PATH=/data/openclaw/openclaw.json                     │ │    │   │
│  │  │  │    OPENCLAW_GATEWAY_PORT=18789                                           │ │    │   │
│  │  │  │    OPENCLAW_GATEWAY_TOKEN=<secret>                                       │ │    │   │
│  │  │  │    OPENCLAW_NIX_MODE=1                                                   │ │    │   │
│  │  │  │                                                                          │ │    │   │
│  │  │  │  Resources:                                                              │ │    │   │
│  │  │  │    requests:                                                             │ │    │   │
│  │  │  │      memory: 256Mi                                                       │ │    │   │
│  │  │  │      cpu: 250m                                                           │ │    │   │
│  │  │  │    limits:                                                               │ │    │   │
│  │  │  │      memory: 1Gi                                                         │ │    │   │
│  │  │  │      cpu: 1000m                                                          │ │    │   │
│  │  │  │                                                                          │ │    │   │
│  │  │  │  VolumeMounts:                                                           │ │    │   │
│  │  │  │    /data/openclaw → pvc/openclaw-data-user-123                           │ │    │   │
│  │  │  │    /etc/openclaw/config → configmap/user-123-config                      │ │    │   │
│  │  │  └─────────────────────────────────────────────────────────────────────────┘ │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │  Service        │  │  Ingress        │  │  PVC (NFS)      │  │  ConfigMap      │  │   │
│  │  │  (ClusterIP)    │  │  (HTTPS)        │  │  (数据持久化)    │  │  (配置管理)      │  │   │
│  │  │                 │  │                 │  │                 │  │                 │  │   │
│  │  │  Port: 18789    │  │  Host:          │  │  Size: 10Gi     │  │  openclaw.json  │  │   │
│  │  │  Target: Pod    │  │  user-123.ocr.  │  │  Mode: RWX      │  │  channels/      │  │   │
│  │  │                 │  │  openclaw.cloud │  │  (NFS)          │  │  credentials/   │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘  │   │
│  │                                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  [其他用户命名空间: user-456, user-789, ...]                                                  │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              基础设施层 (Infrastructure Layer)                               │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  K8s Cluster    │  │  NFS Storage    │  │  Redis Cluster  │  │  PostgreSQL             │ │
│  │  (K3s/EKS/ACK)  │  │  (数据持久化)    │  │  (缓存/会话)     │  │  (用户/实例元数据)       │ │
│  │                 │  │                 │  │                 │  │                         │ │
│  │ • Node Pool     │  │ • PV/PVC        │  │ • 用户会话       │  │ • 用户信息              │ │
│  │ • NetworkPolicy │  │ • Snapshot      │  │ • 限流计数       │  │ • 实例配置              │ │
│  │ • HPA/VPA       │  │ • Backup        │  │ • 消息队列       │  │ • 计费数据              │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、核心功能模块设计

### 3.1 用户管理模块

```typescript
// 用户数据模型
interface User {
  id: string;                    // UUID
  email: string;                 // 登录邮箱
  phone?: string;                // 手机号（渠道绑定用）
  name: string;                  // 显示名称
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  lastLoginAt: Date;
  
  // 配额限制
  quota: {
    maxChannels: number;         // 最大渠道数
    maxAgents: number;           // 最大 Agent 数
    storageGB: number;           // 存储配额
    monthlyRequests: number;     // 月请求配额
  };
}

// 用户服务接口
interface UserService {
  // 认证
  register(email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<AuthToken>;
  logout(token: string): Promise<void>;
  
  // 管理
  getUser(userId: string): Promise<User>;
  updateProfile(userId: string, updates: Partial<User>): Promise<User>;
  changeTier(userId: string, tier: Tier): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
  
  // 配额
  checkQuota(userId: string, resource: string): Promise<QuotaStatus>;
}
```

### 3.2 实例管理模块

```typescript
// OpenClaw 实例资源 (K8s CRD)
interface OpenClawInstance {
  apiVersion: 'openclaw.cloud/v1alpha1';
  kind: 'OpenClawInstance';
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    creationTimestamp: string;
    labels: {
      'openclaw.cloud/user-id': string;
      'openclaw.cloud/tier': string;
      'openclaw.cloud/region': string;
    };
  };
  spec: {
    userId: string;
    tier: 'free' | 'pro' | 'enterprise';
    region: string;
    version: string;              // OpenClaw 版本
    
    // 资源配置
    resources: {
      memory: string;             // 256Mi/512Mi/1Gi
      cpu: string;                // 250m/500m/1000m
      storage: string;            // 5Gi/10Gi/50Gi
    };
    
    // 网络配置
    network: {
      domain: string;             // user-123.ocr.openclaw.cloud
      tls: boolean;
      whitelistIPs?: string[];    // IP 白名单
    };
    
    // OpenClaw 配置
    config: {
      channels: ChannelConfig[];
      models: ModelConfig;
      agents: AgentConfig[];
      hooks?: HookConfig[];
      plugins?: PluginConfig[];
    };
    
    // 功能开关
    features: {
      browser: boolean;           // 浏览器自动化
      sandbox: boolean;           // Docker 沙箱
      canvas: boolean;            // Canvas 功能
      voice: boolean;             // 语音功能
    };
  };
  status: {
    phase: 'Pending' | 'Creating' | 'Running' | 'Stopping' | 'Stopped' | 'Error' | 'Deleting';
    gatewayUrl: string;           // wss://user-123.ocr.openclaw.cloud
    health: 'healthy' | 'unhealthy' | 'unknown';
    lastActivity: string;
    messageCount: number;
    storageUsed: string;
    conditions: InstanceCondition[];
  };
}

// 实例服务接口
interface InstanceService {
  // 生命周期
  createInstance(userId: string, spec: InstanceSpec): Promise<OpenClawInstance>;
  deleteInstance(instanceId: string): Promise<void>;
  startInstance(instanceId: string): Promise<void>;
  stopInstance(instanceId: string): Promise<void>;
  restartInstance(instanceId: string): Promise<void>;
  
  // 配置管理
  updateConfig(instanceId: string, config: OpenClawConfig): Promise<void>;
  addChannel(instanceId: string, channel: ChannelConfig): Promise<void>;
  removeChannel(instanceId: string, channelId: string): Promise<void>;
  
  // 查询
  getInstance(instanceId: string): Promise<OpenClawInstance>;
  listInstances(userId?: string): Promise<OpenClawInstance[]>;
  getInstanceStatus(instanceId: string): Promise<InstanceStatus>;
  
  // 运维
  getLogs(instanceId: string, options: LogOptions): Promise<LogStream>;
  execCommand(instanceId: string, command: string): Promise<ExecResult>;
  scaleResources(instanceId: string, resources: Resources): Promise<void>;
}
```

### 3.3 渠道管理模块

```typescript
// 渠道配置模型
interface ChannelConfig {
  id: string;
  type: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'signal' | 'imessage' | 
        'googlechat' | 'msteams' | 'matrix' | 'zalo' | 'line' | 'feishu' | 'webchat';
  accountId: string;
  enabled: boolean;
  
  // 安全配置
  security: {
    dmPolicy: 'pairing' | 'open' | 'blocked';
    allowFrom: string[];        // 白名单
    requireApproval: boolean;   // 是否需要审批
  };
  
  // 类型特定配置
  config: WhatsAppConfig | TelegramConfig | DiscordConfig | ...;
  
  // 状态
  status: {
    state: 'connecting' | 'connected' | 'disconnected' | 'error';
    lastError?: string;
    qrCode?: string;            // QR 码（用于登录）
  };
}

// 渠道服务接口
interface ChannelService {
  // 配置
  addChannel(instanceId: string, config: ChannelConfig): Promise<void>;
  updateChannel(instanceId: string, channelId: string, updates: Partial<ChannelConfig>): Promise<void>;
  removeChannel(instanceId: string, channelId: string): Promise<void>;
  
  // 连接管理
  connectChannel(instanceId: string, channelId: string): Promise<void>;
  disconnectChannel(instanceId: string, channelId: string): Promise<void>;
  reconnectChannel(instanceId: string, channelId: string): Promise<void>;
  
  // 特殊操作
  getQRCode(instanceId: string, channelId: string): Promise<QRCodeData>;  // WhatsApp/Telegram
  verifyPairing(instanceId: string, code: string): Promise<boolean>;
  
  // 查询
  listChannels(instanceId: string): Promise<ChannelConfig[]>;
  getChannelStatus(instanceId: string, channelId: string): Promise<ChannelStatus>;
}
```

### 3.4 AI 模型管理模块

```typescript
// 模型配置
interface ModelConfig {
  defaultProvider: string;
  defaultModel: string;
  
  providers: {
    [providerId: string]: {
      type: 'anthropic' | 'openai' | 'google' | 'bedrock' | 'ollama' | 'openrouter';
      enabled: boolean;
      
      // 密钥配置（平台托管或用户自有）
      auth: {
        mode: 'platform' | 'bring-your-own';
        apiKey?: string;          // BYOK 模式用户填写
        platformKeyId?: string;   // 平台托管密钥
      };
      
      // 模型列表
      models: string[];
      
      // 限流
      rateLimit: {
        requestsPerMinute: number;
        tokensPerMinute: number;
      };
    };
  };
  
  // 故障转移
  fallback: {
    enabled: boolean;
    providers: string[];          // 优先级列表
  };
}

// 模型服务接口
interface ModelService {
  // 配置
  configureProvider(instanceId: string, provider: string, config: ProviderConfig): Promise<void>;
  setDefaultModel(instanceId: string, model: string): Promise<void>;
  
  // 平台托管密钥管理（仅管理员）
  registerPlatformKey(provider: string, apiKey: string, quota: Quota): Promise<KeyRegistration>;
  rotatePlatformKey(keyId: string): Promise<void>;
  
  // 查询
  listAvailableModels(instanceId: string): Promise<ModelInfo[]>;
  getUsageStats(instanceId: string, period: DateRange): Promise<UsageStats>;
}
```

### 3.5 监控告警模块

```typescript
// 监控指标
interface Metrics {
  // 实例指标
  instance: {
    cpuUsage: number;             // CPU 使用率
    memoryUsage: number;          // 内存使用率
    storageUsage: number;         // 存储使用率
    messageCount: number;         // 消息数量
    requestLatency: number;       // 请求延迟
    errorRate: number;            // 错误率
  };
  
  // 渠道指标
  channels: {
    [channelId: string]: {
      connected: boolean;
      messageCount: number;
      errorCount: number;
      lastActivity: Date;
    };
  };
  
  // AI 指标
  ai: {
    requestCount: number;
    tokenUsage: number;
    costEstimate: number;
    latency: number;
  };
}

// 告警规则
interface AlertRule {
  id: string;
  name: string;
  condition: {
    metric: string;               // cpu/memory/storage/errorRate
    operator: '>' | '<' | '==' | '!=';
    threshold: number;
    duration: string;             // 持续时间，如 "5m"
  };
  actions: {
    notify: boolean;              // 发送通知
    autoRestart: boolean;         // 自动重启
    scaleUp: boolean;             // 自动扩容
  };
}

// 监控服务接口
interface MonitorService {
  // 指标收集
  collectMetrics(instanceId: string): Promise<Metrics>;
  getMetricsHistory(instanceId: string, metric: string, range: TimeRange): Promise<DataPoint[]>;
  
  // 日志
  getLogs(instanceId: string, options: LogQueryOptions): Promise<LogEntry[]>;
  tailLogs(instanceId: string): AsyncIterable<LogEntry>;
  
  // 告警
  createAlertRule(userId: string, rule: AlertRule): Promise<AlertRule>;
  listAlertRules(userId: string): Promise<AlertRule[]>;
  
  // 健康检查
  healthCheck(instanceId: string): Promise<HealthStatus>;
}
```

---

## 四、K8s 资源详细设计

### 4.1 CRD 定义

```yaml
# openclaw-instance-crd.yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: openclawinstances.openclaw.cloud
spec:
  group: openclaw.cloud
  names:
    kind: OpenClawInstance
    listKind: OpenClawInstanceList
    plural: openclawinstances
    singular: openclawinstance
    shortNames:
      - oci
      - instance
  scope: Namespaced
  versions:
    - name: v1alpha1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required:
                - userId
                - tier
              properties:
                userId:
                  type: string
                tier:
                  type: string
                  enum: ['free', 'pro', 'enterprise']
                region:
                  type: string
                version:
                  type: string
                  default: 'latest'
                resources:
                  type: object
                  properties:
                    memory:
                      type: string
                      default: '256Mi'
                    cpu:
                      type: string
                      default: '250m'
                    storage:
                      type: string
                      default: '5Gi'
                network:
                  type: object
                  properties:
                    domain:
                      type: string
                    tls:
                      type: boolean
                      default: true
                config:
                  type: object
                  properties:
                    channels:
                      type: array
                      items:
                        type: object
                    models:
                      type: object
                    agents:
                      type: array
                features:
                  type: object
                  properties:
                    browser:
                      type: boolean
                      default: false
                    sandbox:
                      type: boolean
                      default: false
                    canvas:
                      type: boolean
                      default: true
                    voice:
                      type: boolean
                      default: false
            status:
              type: object
              properties:
                phase:
                  type: string
                gatewayUrl:
                  type: string
                health:
                  type: string
                lastActivity:
                  type: string
                  format: date-time
                messageCount:
                  type: integer
                storageUsed:
                  type: string
                conditions:
                  type: array
                  items:
                    type: object
                    properties:
                      type:
                        type: string
                      status:
                        type: string
                      lastTransitionTime:
                        type: string
                      reason:
                        type: string
                      message:
                        type: string
      subresources:
        status: {}
```

### 4.2 Controller 实现架构

```typescript
// operator/controller.ts
import { Controller, Watch } from '@kubernetes/client-node';

class OpenClawInstanceController {
  private k8sClient: K8sClient;
  private instanceService: InstanceService;
  
  async start() {
    // Watch OpenClawInstance CR 变化
    const watch = new Watch(this.k8sClient.kubeConfig);
    
    await watch.watch(
      '/apis/openclaw.cloud/v1alpha1/openclawinstances',
      {},
      (type, apiObj) => this.handleEvent(type, apiObj),
      (err) => console.error('Watch error:', err)
    );
  }
  
  private async handleEvent(type: 'ADDED' | 'MODIFIED' | 'DELETED', instance: OpenClawInstance) {
    switch (type) {
      case 'ADDED':
        await this.createInstance(instance);
        break;
      case 'MODIFIED':
        await this.updateInstance(instance);
        break;
      case 'DELETED':
        await this.deleteInstance(instance);
        break;
    }
  }
  
  private async createInstance(instance: OpenClawInstance) {
    const { userId, spec } = instance;
    
    // 1. 创建命名空间
    await this.createNamespace(userId);
    
    // 2. 创建 PVC (NFS 存储)
    await this.createPVC(userId, spec.resources.storage);
    
    // 3. 生成 OpenClaw 配置
    const config = this.generateConfig(spec);
    await this.createConfigMap(userId, config);
    
    // 4. 创建密钥
    await this.createSecret(userId, {
      gatewayToken: generateToken(),
      modelKeys: spec.config.models
    });
    
    // 5. 创建 Deployment
    await this.createDeployment(instance);
    
    // 6. 创建 Service
    await this.createService(userId);
    
    // 7. 创建 Ingress
    await this.createIngress(userId, spec.network.domain);
    
    // 8. 更新状态
    await this.updateStatus(instance, {
      phase: 'Running',
      gatewayUrl: `wss://${spec.network.domain}`,
      health: 'healthy'
    });
  }
  
  private async createDeployment(instance: OpenClawInstance) {
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `openclaw-${instance.spec.userId}`,
        namespace: instance.spec.userId,
        labels: {
          'app': 'openclaw',
          'user-id': instance.spec.userId,
          'tier': instance.spec.tier
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'app': 'openclaw',
            'user-id': instance.spec.userId
          }
        },
        template: {
          metadata: {
            labels: {
              'app': 'openclaw',
              'user-id': instance.spec.userId
            }
          },
          spec: {
            containers: [{
              name: 'openclaw',
              image: `openclaw/gateway:${instance.spec.version || 'latest'}`,
              ports: [{
                containerPort: 18789,
                name: 'gateway'
              }],
              env: [
                { name: 'OPENCLAW_STATE_DIR', value: '/data/openclaw' },
                { name: 'OPENCLAW_CONFIG_PATH', value: '/data/openclaw/openclaw.json' },
                { name: 'OPENCLAW_GATEWAY_PORT', value: '18789' },
                { name: 'OPENCLAW_GATEWAY_TOKEN', valueFrom: { secretKeyRef: { name: 'openclaw-secrets', key: 'gatewayToken' } } },
                { name: 'OPENCLAW_NIX_MODE', value: '1' },
                { name: 'NODE_ENV', value: 'production' }
              ],
              resources: {
                requests: {
                  memory: instance.spec.resources.memory,
                  cpu: instance.spec.resources.cpu
                },
                limits: {
                  memory: this.getLimitMemory(instance.spec.resources.memory),
                  cpu: this.getLimitCPU(instance.spec.resources.cpu)
                }
              },
              volumeMounts: [
                { name: 'data', mountPath: '/data/openclaw' },
                { name: 'config', mountPath: '/etc/openclaw/config', readOnly: true }
              ],
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: 18789
                },
                initialDelaySeconds: 30,
                periodSeconds: 10
              },
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: 18789
                },
                initialDelaySeconds: 5,
                periodSeconds: 5
              }
            }],
            volumes: [
              { name: 'data', persistentVolumeClaim: { claimName: 'openclaw-data' } },
              { name: 'config', configMap: { name: 'openclaw-config' } }
            ]
          }
        }
      }
    };
    
    await this.k8sClient.createDeployment(deployment);
  }
}
```

### 4.3 NetworkPolicy (网络隔离)

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: openclaw-isolation
  namespace: user-123
spec:
  podSelector:
    matchLabels:
      app: openclaw
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # 只允许从 Ingress Controller 访问
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 18789
  egress:
    # 允许访问外部渠道 API
    - to: []
      ports:
        - protocol: TCP
          port: 443
    # 允许访问 DNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

---

## 五、Web 控制台设计

### 5.1 界面原型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  OpenClaw Cloud                                    [通知] [帮助] [用户头像 ▼] │
├────────────────┬────────────────────────────────────────────────────────────┤
│                │                                                            │
│  📊 仪表盘      │   ┌─────────────────────────────────────────────────────┐  │
│  ───────────── │   │  实例状态    [运行中 🟢]    [重启] [停止] [设置]      │  │
│                │   └─────────────────────────────────────────────────────┘  │
│  💬 渠道管理    │                                                            │
│  ───────────── │   ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  WhatsApp      │   │   WhatsApp      │  │   Telegram      │  │   + 添加    │ │
│  Telegram      │   │   ━━━━━━━━━━━   │  │   ━━━━━━━━━━━   │  │   新渠道    │ │
│  Discord       │   │                 │  │                 │  │            │ │
│  Slack         │   │  状态: 已连接    │  │  状态: 已连接    │  │            │ │
│                │   │  消息: 1,234     │  │  消息: 567      │  │            │ │
│  🤖 AI 设置    │   │                 │  │                 │  │            │ │
│  ───────────── │   │ [断开] [配置]   │  │ [断开] [配置]   │  │            │ │
│  模型配置      │   └─────────────────┘  └─────────────────┘  └────────────┘ │
│  Agent 管理    │                                                            │
│  技能管理      │   ┌─────────────────────────────────────────────────────┐  │
│                │   │  快速入门指南                                         │  │
│  📈 监控分析    │   │  1. 添加消息渠道 (WhatsApp/Telegram/Slack)           │  │
│  ───────────── │   │  2. 配置 AI 模型 (Claude/GPT/Gemini)                 │  │
│  实时监控      │   │  3. 开始对话！发送消息给你的 AI 助手                  │  │
│  日志查询      │   └─────────────────────────────────────────────────────┘  │
│  用量统计      │                                                            │
│                │                                                            │
│  ⚙️ 系统设置   │                                                            │
│  ───────────── │                                                            │
│  实例配置      │                                                            │
│  安全设置      │                                                            │
│  备份恢复      │                                                            │
│                │                                                            │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### 5.2 关键页面设计

#### 渠道配置流程

```
添加渠道向导
├── 选择渠道类型
│   ├── WhatsApp (QR 码登录)
│   ├── Telegram (Bot Token)
│   ├── Discord (Bot Token)
│   ├── Slack (App Token)
│   └── ...
│
├── 配置渠道参数
│   └── 根据类型显示不同表单
│
├── 安全配置
│   ├── DM 策略: [配对/开放/阻止]
│   ├── 白名单: [添加允许的用户]
│   └── 群组设置: [需要提及/工具权限]
│
└── 测试连接
    ├── 显示二维码 (WhatsApp)
    └── 验证 Bot Token (Telegram/Discord/Slack)
```

#### AI 模型配置

```
模型配置页面
├── 模型提供商
│   ├── Anthropic Claude
│   │   ├── 模式: [平台托管 / 自带密钥]
│   │   ├── 默认模型: [claude-3-opus/claude-3-sonnet]
│   │   └── 用量限制: [月token配额]
│   │
│   ├── OpenAI GPT
│   │   └── ...
│   │
│   └── Google Gemini
│       └── ...
│
├── Agent 配置
│   ├── 默认 Agent
│   ├── 自定义 Agents
│   └── 工具权限管理
│
└── 高级设置
    ├── 上下文窗口
    ├── 温度参数
    └── 系统提示词
```

---

## 六、API 设计

### 6.1 REST API

```yaml
# API 概览
basePath: /api/v1
authentication: Bearer Token (JWT)

# 用户管理
groups:
  - name: 认证
    endpoints:
      - POST   /auth/register          # 用户注册
      - POST   /auth/login             # 用户登录
      - POST   /auth/logout            # 用户登出
      - POST   /auth/refresh           # 刷新 Token
      - GET    /auth/me                # 获取当前用户

  - name: 实例管理
    endpoints:
      - GET    /instances              # 列出实例
      - POST   /instances              # 创建实例
      - GET    /instances/:id          # 获取实例详情
      - PATCH  /instances/:id          # 更新实例
      - DELETE /instances/:id          # 删除实例
      - POST   /instances/:id/start    # 启动实例
      - POST   /instances/:id/stop     # 停止实例
      - POST   /instances/:id/restart  # 重启实例
      - GET    /instances/:id/status   # 获取实例状态
      - GET    /instances/:id/logs     # 获取实例日志

  - name: 渠道管理
    endpoints:
      - GET    /instances/:id/channels              # 列出渠道
      - POST   /instances/:id/channels              # 添加渠道
      - GET    /instances/:id/channels/:channelId   # 获取渠道详情
      - PATCH  /instances/:id/channels/:channelId   # 更新渠道
      - DELETE /instances/:id/channels/:channelId   # 删除渠道
      - POST   /instances/:id/channels/:channelId/connect     # 连接渠道
      - POST   /instances/:id/channels/:channelId/disconnect  # 断开渠道
      - GET    /instances/:id/channels/:channelId/qrcode      # 获取 QR 码

  - name: 配置管理
    endpoints:
      - GET    /instances/:id/config               # 获取配置
      - PUT    /instances/:id/config               # 更新配置
      - GET    /instances/:id/config/agents        # 获取 Agents
      - POST   /instances/:id/config/agents        # 创建 Agent
      - GET    /instances/:id/config/models        # 获取模型配置
      - PUT    /instances/:id/config/models        # 更新模型配置

  - name: 监控
    endpoints:
      - GET    /instances/:id/metrics              # 获取指标
      - GET    /instances/:id/metrics/:metric      # 获取特定指标
      - GET    /instances/:id/logs                 # 查询日志
      - GET    /instances/:id/events               # 获取事件

# WebSocket API (实时通信)
websockets:
  - path: /ws/instances/:id
    description: 实例状态实时推送
    events:
      - instance.status.changed
      - channel.status.changed
      - message.received
      - alert.triggered
```

### 6.2 GraphQL Schema (可选)

```graphql
type Query {
  me: User!
  instances: [Instance!]!
  instance(id: ID!): Instance
  channels(instanceId: ID!): [Channel!]!
  metrics(instanceId: ID!, range: TimeRange!): Metrics!
}

type Mutation {
  createInstance(input: CreateInstanceInput!): Instance!
  updateInstance(id: ID!, input: UpdateInstanceInput!): Instance!
  deleteInstance(id: ID!): Boolean!
  
  addChannel(instanceId: ID!, input: ChannelInput!): Channel!
  removeChannel(instanceId: ID!, channelId: ID!): Boolean!
  connectChannel(instanceId: ID!, channelId: ID!): Channel!
  
  updateConfig(instanceId: ID!, input: ConfigInput!): Config!
}

type Subscription {
  instanceStatus(instanceId: ID!): InstanceStatus!
  channelStatus(instanceId: ID!, channelId: ID): ChannelStatus!
  newMessage(instanceId: ID!): Message!
}
```

---

## 七、部署方案

### 7.1 架构部署图

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    生产环境部署架构                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      Ingress 层                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Nginx Ingress Controller + Cert-Manager (自动 HTTPS)                                │   │
│  │                                                                                      │   │
│  │  *.openclaw.cloud → API Gateway Service                                              │   │
│  │  *.ocr.openclaw.cloud → User Instance Service (SNI 路由)                             │   │
│  │                                                                                      │   │
│  │  路由规则:                                                                           │   │
│  │  - api.openclaw.cloud → ocp-api-service:8080                                         │   │
│  │  - console.openclaw.cloud → ocp-console-service:80                                   │   │
│  │  - user-123.ocr.openclaw.cloud → user-123/openclaw-service:18789                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    平台服务层 (ocp-system ns)                                │
│                                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  API Gateway    │  │  Web Console    │  │  Operator       │  │  Metrics Server         │ │
│  │  (Go/Node.js)   │  │  (React/Vue)    │  │  (TypeScript)   │  │  (Prometheus/Grafana)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  PostgreSQL     │  │  Redis Cluster  │  │  NATS/JetStream │  │  MinIO (S3)             │ │
│  │  (用户数据)      │  │  (缓存/消息)     │  │  (事件流)       │  │  (备份/日志)            │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    用户实例层 (用户命名空间)                                  │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  命名空间: user-123, user-456, user-789, ...                                          │   │
│  │                                                                                      │   │
│  │  每个命名空间包含:                                                                    │   │
│  │  • Deployment/openclaw-gateway (1 replica)                                           │   │
│  │  • Service/openclaw-service                                                          │   │
│  │  • PVC/openclaw-data (NFS-backed)                                                    │   │
│  │  • ConfigMap/openclaw-config                                                         │   │
│  │  • Secret/openclaw-secrets                                                           │   │
│  │  • NetworkPolicy/openclaw-isolation                                                  │   │
│  │  • (可选) HPA/openclaw-autoscaler                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    基础设施层                                                │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  K8s Cluster (3+ nodes)                                                              │   │
│  │  • Node Pool: standard-4 (4C8G) for user instances                                   │   │
│  │  • Node Pool: highmem-8 (8C32G) for platform services                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  NFS Storage (ReadWriteMany)                                                         │   │
│  │  • Server: nfs.openclaw.internal                                                     │   │
│  │  • Export: /exports/openclaw-instances                                               │   │
│  │  • SubPath per user: /exports/openclaw-instances/user-123                            │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Helm Chart 结构

```
openclaw-cloud-platform/
├── Chart.yaml
├── values.yaml
├── values-production.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── crd/
│   │   └── openclaw-instance.yaml
│   ├── operator/
│   │   ├── deployment.yaml
│   │   ├── rbac.yaml
│   │   └── serviceaccount.yaml
│   ├── api/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml
│   ├── console/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml
│   ├── postgres/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── redis/
│   │   └── ...
│   └── monitoring/
│       ├── prometheus/
│       └── grafana/
└── charts/
    └── (subcharts)
```

---

## 八、运维方案

### 8.1 监控体系

```yaml
# 监控指标收集
monitoring:
  # 基础设施指标 (Prometheus)
  infrastructure:
    - node_cpu_usage
    - node_memory_usage
    - node_disk_io
    - nfs_io_latency
    
  # 平台指标
  platform:
    - ocp_api_requests_total
    - ocp_api_latency_seconds
    - ocp_instance_count
    - ocp_user_count
    - ocp_channel_count
    
  # 实例指标 (Sidecar 采集)
  instance:
    - openclaw_gateway_uptime
    - openclaw_messages_total
    - openclaw_active_sessions
    - openclaw_channel_connected
    - openclaw_ai_requests_total
    - openclaw_ai_tokens_consumed
    
  # 告警规则
  alerts:
    - alert: InstanceDown
      expr: up{job="openclaw-gateway"} == 0
      for: 2m
      
    - alert: HighMemoryUsage
      expr: container_memory_usage_bytes{container="openclaw"} / container_spec_memory_limit_bytes > 0.85
      for: 5m
      
    - alert: ChannelDisconnected
      expr: openclaw_channel_connected == 0
      for: 1m
```

### 8.2 备份策略

```yaml
backup:
  # 用户数据备份 (NFS)
  userData:
    schedule: "0 2 * * *"        # 每天凌晨 2 点
    retention: 30d               # 保留 30 天
    type: incremental
    target: s3://openclaw-backups/instances/
    
  # 数据库备份
  database:
    schedule: "0 */6 * * *"      # 每 6 小时
    retention: 7d
    type: full
    target: s3://openclaw-backups/database/
    
  # 配置备份
  config:
    schedule: "0 * * * *"        # 每小时
    retention: 24h
    type: snapshot
```

### 8.3 自动扩缩容

```yaml
# HPA 配置
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: openclaw-gateway-hpa
  namespace: user-123
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: openclaw-gateway
  minReplicas: 1
  maxReplicas: 3
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 600
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

---

## 九、安全设计

### 9.1 安全架构

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      安全分层                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Layer 1: 网络安全                                                                           │
│  • HTTPS/TLS 1.3 全站加密                                                                   │
│  • WAF (Web 应用防火墙)                                                                      │
│  • DDoS 防护                                                                                │
│  • IP 白名单 (企业版)                                                                        │
│                                                                                             │
│  Layer 2: 认证授权                                                                           │
│  • JWT Token (RS256)                                                                        │
│  • OAuth 2.0 / OIDC 集成                                                                     │
│  • MFA (多因素认证)                                                                          │
│  • RBAC (基于角色的访问控制)                                                                  │
│                                                                                             │
│  Layer 3: K8s 安全                                                                           │
│  • NetworkPolicy (命名空间隔离)                                                               │
│  • PodSecurityPolicy / OPA Gatekeeper                                                        │
│  • Secret 加密存储 (KMS)                                                                      │
│  • ServiceAccount 最小权限                                                                    │
│                                                                                             │
│  Layer 4: 应用安全                                                                           │
│  • Gateway Token 认证                                                                         │
│  • 渠道配对机制 (DM Policy)                                                                   │
│  • 沙箱执行 (Docker Sandbox)                                                                  │
│  • 输入验证 / 防注入                                                                          │
│                                                                                             │
│  Layer 5: 数据安全                                                                           │
│  • 数据加密 (静态 + 传输)                                                                       │
│  • 备份加密                                                                                  │
│  • 数据脱敏 (日志)                                                                            │
│  • GDPR / 数据主权合规                                                                         │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 密钥管理

```yaml
# 密钥分级
secrets:
  # Level 1: 平台级密钥 (仅管理员)
  platform:
    - nfs_server_credentials
    - database_encryption_key
    - jwt_signing_key
    
  # Level 2: 托管模型密钥 (按提供商)
  model_providers:
    anthropic:
      - key_id: ak-anthropic-001
        quota: 1000000  # tokens/month
      - key_id: ak-anthropic-002
        quota: 1000000
        
    openai:
      - key_id: ak-openai-001
        quota: 1000000
        
  # Level 3: 用户自有密钥
  user_managed:
    stored_encrypted: true
    encryption: AES-256-GCM
    key_derivation: PBKDF2
```

---

## 十、成本估算

### 10.1 资源需求估算

| 套餐 | 配置 | 资源/用户 | 支持用户/节点 | 月成本/用户 |
|------|------|----------|--------------|------------|
| **Free** | 256Mi / 250m / 2Gi | 0.25 Core, 256MB | 16/节点 | ¥0 (限 1 渠道) |
| **Pro** | 512Mi / 500m / 10Gi | 0.5 Core, 512MB | 8/节点 | ¥29 (5 渠道) |
| **Enterprise** | 1Gi / 1000m / 50Gi | 1 Core, 1GB | 4/节点 | ¥99 (无限) |

### 10.2 基础设施成本 (月度)

```
K8s 集群 (阿里云 ACK / AWS EKS)
├── 3 x Master 节点 (2C4G):     ¥ 600
├── 3 x Worker 节点 (8C16G):    ¥ 2,400
├── 负载均衡 (SLB/ALB):         ¥ 300
└── NAT 网关 / 网络:             ¥ 200
                                ─────────
合计:                           ¥ 3,500 / 月

存储 (NFS / EFS)
├── 基础容量 500GB:             ¥ 1,000
└── 备份存储 2TB:               ¥ 400
                                ─────────
合计:                           ¥ 1,400 / 月

数据库 & 缓存
├── PostgreSQL (2C4G):          ¥ 800
└── Redis (2G):                 ¥ 400
                                ─────────
合计:                           ¥ 1,200 / 月

===============================================
基础设施固定成本:                  ¥ 6,100 / 月
===============================================

盈亏平衡点 (Pro 套餐 ¥29):
  6,100 / 29 ≈ 211 付费用户
```

---

## 十一、实施路线图

### Phase 1: MVP (2个月)
- [ ] K8s Operator 开发
- [ ] 基础 API (实例 CRUD)
- [ ] Web 控制台 (基础版)
- [ ] 支持 WhatsApp/Telegram 渠道
- [ ] 托管 Claude 模型

### Phase 2: 核心功能 (2个月)
- [ ] 完整渠道支持 (15+ 渠道)
- [ ] 多模型支持 (Claude/GPT/Gemini)
- [ ] 监控告警系统
- [ ] 计费系统
- [ ] 自动扩缩容

### Phase 3: 企业级 (2个月)
- [ ] SSO/SAML 集成
- [ ] 审计日志
- [ ] 数据导出/迁移
- [ ] SLA 保障
- [ ] 私有化部署选项

---

## 十二、总结

这个设计方案为您提供了一个完整的 **OpenClaw 云管平台** 蓝图：

### 核心特点
1. **真正的多租户**: 每个用户独立 Pod + 独立存储，强隔离
2. **K8s 原生**: 基于 CRD + Operator，符合云原生标准
3. **可扩展**: 支持水平扩展，从数十到数万用户
4. **全功能**: 覆盖 OpenClaw 全部功能，包括所有渠道和 AI 模型

### 关键技术决策
| 决策 | 选择 | 理由 |
|------|------|------|
| 多租户模式 | 独立 Pod | OpenClaw 单体架构限制，但隔离性好 |
| 存储方案 | NFS + PVC | 支持 ReadWriteMany，便于备份 |
| 配置管理 | ConfigMap + Secret | K8s 原生，支持热更新 |
| 网络隔离 | NetworkPolicy | 命名空间级别隔离 |
| 编排方式 | Operator 模式 | 自动化生命周期管理 |

如果您需要，我可以进一步细化任何模块的设计，比如：
- Operator 详细代码实现
- Web 控制台前端架构
- 计费系统设计方案
- 具体的 K8s YAML 清单
