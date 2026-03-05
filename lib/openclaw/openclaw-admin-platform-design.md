# OpenClaw 运维管理平台 (OAMP) 设计方案

## 一、平台定位

**OpenClaw Admin Management Platform (OAMP)** 是一个面向运维团队和企业管理员的多租户资源管理平台，用于：

- 管理租户生命周期（创建、配置、监控、销毁）
- 管理底层 K8s 资源池和配额
- 快速部署和配置 OpenClaw 实例
- 系统级监控、告警和容量规划
- 计费和成本管理

---

## 二、用户角色模型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              角色权限体系                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │  超级管理员      │  平台所有者，拥有所有权限                               │
│  │  (Super Admin)  │  • 系统配置、资源池管理                                 │
│  │                 │  • 管理员账号管理                                        │
│  │                 │  • 全局监控和告警配置                                    │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│  ┌────────┴────────┐                                                        │
│  │    运维管理员    │  日常运维操作                                           │
│  │    (Ops Admin)  │  • 租户管理、部署实例                                   │
│  │                 │  • 资源模板配置                                          │
│  │                 │  • 监控告警处理                                          │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│  ┌────────┴────────┐                                                        │
│  │    财务管理员    │  计费和成本管理                                         │
│  │    (Billing)    │  • 套餐定价、账单管理                                    │
│  │                 │  • 成本分析、用量报表                                    │
│  └─────────────────┘                                                        │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │    租户管理员    │  仅管理自己的租户（外部客户）                           │
│  │  (Tenant Admin) │  • 查看自己的实例状态                                    │
│  │                 │  • 查看用量和账单                                        │
│  │                 │  • 提交工单                                              │
│  └─────────────────┘                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    管理员控制台 (Web UI)                                      │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │  仪表盘     │  租户管理   │  资源管理   │  部署管理   │  监控告警   │  系统设置       │  │
│  │  Dashboard  │  Tenants    │  Resources  │  Deploy     │  Monitor    │  Settings       │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    平台 API 层 (Platform API)                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  • 认证授权 (RBAC)          • 租户管理 API          • 资源管理 API                     │   │
│  │  • 部署编排 API             • 监控查询 API          • 计费管理 API                     │   │
│  │  • Webhook 回调             • 事件通知 API                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    核心服务层 (Core Services)                                 │
│                                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  租户中心       │  │  资源调度器     │  │  部署引擎       │  │  监控中心               │ │
│  │  Tenant Center  │  │  Scheduler      │  │  Deploy Engine  │  │  Monitor Center         │ │
│  │                 │  │                 │  │                 │  │                         │ │
│  │ • 租户CRUD      │  │ • 节点选择      │  │ • 模板渲染      │  │ • 指标收集              │ │
│  │ • 配额管理      │  │ • 资源分配      │  │ • 一键部署      │  │ • 日志聚合              │ │
│  │ • 生命周期      │  │ • 负载均衡      │  │ • 配置下发      │  │ • 告警管理              │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  模板管理       │  │  成本分析       │  │  事件总线       │  │  工作流引擎             │ │
│  │  Template Mgr   │  │  Cost Analyzer  │  │  Event Bus      │  │  Workflow Engine        │ │
│  │                 │  │                 │  │                 │  │                         │ │
│  │ • 套餐定义      │  │ • 用量统计      │  │ • 事件发布      │  │ • 审批流程              │ │
│  │ • 版本管理      │  │ • 成本分摊      │  │ • 订阅通知      │  │ • 自动扩缩容            │ │
│  │ • 参数校验      │  │ • 预测分析      │  │ • 审计日志      │  │ • 定时任务              │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    K8s 控制层 (K8s Control)                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         OpenClaw Operator (自定义控制器)                             │   │
│  │                                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │   │
│  │  │  Tenant CRD     │  │  Instance CRD   │  │  Template CRD   │  │  Quota CRD      │ │   │
│  │  │  租户资源        │  │  实例资源        │  │  模板资源        │  │  配额资源        │ │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘ │   │
│  │                                                                                      │   │
│  │  Controller 职责:                                                                    │   │
│  │  1. Watch CRD 变化 → 协调 K8s 原生资源                                               │   │
│  │  2. 管理 Namespace、Deployment、Service、PVC、ConfigMap、Secret                     │   │
│  │  3. 资源配额 enforcement                                                             │   │
│  │  4. 健康检查和故障恢复                                                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    K8s 资源池 (Resource Pool)                                 │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         资源池管理                                                    │   │
│  │                                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │   │
│  │  │  计算池         │  │  存储池         │  │  网络池         │  │  GPU池          │ │   │
│  │  │  Compute Pool   │  │  Storage Pool   │  │  Network Pool   │  │  GPU Pool       │ │   │
│  │  │                 │  │                 │  │                 │  │ (可选)          │ │   │
│  │  │ • 节点组 1      │  │ • NFS 集群      │  │ • 负载均衡      │  │ • 推理加速      │ │   │
│  │  │ • 节点组 2      │  │ • 对象存储      │  │ •  Ingress      │  │ • 模型微调      │ │   │
│  │  │ • 自动伸缩组    │  │ • 备份存储      │  │ •  网络策略     │  │                 │ │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘ │   │
│  │                                                                                      │   │
│  │  资源池标签:                                                                          │   │
│  │  • openclaw.cloud/pool: standard|highmem|gpu                                         │   │
│  │  • openclaw.cloud/zone: cn-north-1|cn-south-1                                        │   │
│  │  • openclaw.cloud/tenant: shared|dedicated                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    租户实例层 (Tenant Instances)                              │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  租户 A (tenant-a)                            租户 B (tenant-b)                      │   │
│  │  ┌─────────────────────────────────────┐      ┌─────────────────────────────────────┐│   │
│  │  │  OpenClaw Instance (基础版)          │      │  OpenClaw Instance (高级版)          ││   │
│  │  │  • 2C / 4G / 10G                    │      │  • 4C / 8G / 50G                    ││   │
│  │  │  • 3 个渠道                          │      │  • 10 个渠道                         ││   │
│  │  │  • 托管 Claude API                  │      │  • 自带 API Key                     ││   │
│  │  │                                     │      │                                     ││   │
│  │  │  Namespace: tenant-a                │      │  Namespace: tenant-b                ││   │
│  │  │  └── Pod/openclaw-gateway           │      │  └── Pod/openclaw-gateway           ││   │
│  │  │  └── PVC/openclaw-data (10G)        │      │  └── PVC/openclaw-data (50G)        ││   │
│  │  │  └── ConfigMap/openclaw-config      │      │  └── ConfigMap/openclaw-config      ││   │
│  │  │  └── Secret/openclaw-secrets        │      │  └── Secret/openclaw-secrets        ││   │
│  │  └─────────────────────────────────────┘      └─────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 四、核心功能模块

### 4.1 仪表盘 (Dashboard)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  OpenClaw 运维管理平台                                    [管理员] [通知] [设置] [退出]       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  全局概览                            [时间范围: 今日 ▼]   [刷新]                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   租户总数   │  │   运行实例   │  │   总消息数   │  │   活跃渠道   │  │   系统健康度     │  │
│  │             │  │             │  │             │  │             │  │                 │  │
│  │   1,234     │  │    987      │  │  1.2M       │  │   3,456     │  │    98.5% 🟢     │  │
│  │   +12 本月   │  │   +5 今日   │  │  +89K 今日   │  │   +23 今日   │  │   2 个告警      │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  ┌─────────────────────┐  │
│  │      资源池使用率            │  │      租户增长趋势           │  │   待处理事项        │  │
│  │                             │  │                             │  │                     │  │
│  │  CPU:    ████████░░ 78%     │  │  [增长曲线图]                │  │ ⚠️ 3 个实例异常     │  │
│  │  内存:   ██████░░░░ 65%     │  │                             │  │ 📋 5 个部署任务     │  │
│  │  存储:   █████░░░░░ 52%     │  │  本月新增: 45 租户          │  │ 🔔 2 个配额超限     │  │
│  │  网络:   ████░░░░░░ 40%     │  │  流失: 3 租户               │  │ 💰 8 个账单待审核   │  │
│  │                             │  │  净增长: +42                │  │                     │  │
│  │  [容量规划建议] →           │  │                             │  │ [查看详情] →        │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  └─────────────────────┘  │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  实时活动流                                                                          │   │
│  │  ─────────────────────────────────────────────────────────────────────────────────  │   │
│  │  10:23:45  [创建] 租户 tenant-456 创建成功，套餐: 基础版                              │   │
│  │  10:23:12  [部署] 租户 tenant-456 实例部署完成，URL: https://t456.ocr.openclaw.cloud │   │
│  │  10:22:08  [告警] 租户 tenant-123 内存使用超过 85%，已自动扩容                        │   │
│  │  10:21:33  [渠道] 租户 tenant-789 WhatsApp 渠道连接成功                               │   │
│  │  10:20:15  [删除] 租户 tenant-111 实例已销毁，数据已归档                              │   │
│  │                                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 租户管理

```typescript
// 租户数据模型
interface Tenant {
  // 基础信息
  id: string;                    // 租户唯一标识 (tenant-xxx)
  name: string;                  // 租户名称
  code: string;                  // 租户编码 (用于URL子域名)
  status: 'active' | 'suspended' | 'terminated';
  tier: 'basic' | 'standard' | 'premium' | 'enterprise' | 'custom';
  
  // 联系信息
  contact: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  
  // 资源配置 (关联模板或自定义)
  resourceProfile: {
    templateId?: string;         // 使用的模板ID
    customResources?: CustomResources;
  };
  
  // 配额限制
  quota: {
    maxChannels: number;         // 最大渠道数
    maxAgents: number;           // 最大 Agent 数
    maxStorageGB: number;        // 最大存储
    maxMonthlyRequests: number;  // 月请求配额
    maxUsers?: number;           // 最大子用户数 (企业版)
  };
  
  // 部署信息
  deployment: {
    namespace: string;           // K8s 命名空间
    instanceId: string;          // 实例ID
    gatewayUrl: string;          // Gateway 访问地址
    region: string;              // 部署区域
    nodePool: string;            // 所属节点池
    createdAt: Date;
    lastActivityAt: Date;
  };
  
  // 计费信息
  billing: {
    model: 'prepaid' | 'postpaid';  // 预付/后付
    cycle: 'monthly' | 'yearly';
    price: number;               // 单价
    currency: string;
    nextBillingDate: Date;
  };
  
  // 元数据
  metadata: {
    source: string;              // 来源: admin/web/api
    tags: string[];              // 标签
    notes?: string;              // 备注
  };
}

// 租户服务接口
interface TenantService {
  // CRUD
  createTenant(spec: TenantSpec): Promise<Tenant>;
  getTenant(tenantId: string): Promise<Tenant>;
  updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant>;
  deleteTenant(tenantId: string, options: DeleteOptions): Promise<void>;
  listTenants(filters?: TenantFilters): Promise<PaginatedList<Tenant>>;
  
  // 生命周期
  suspendTenant(tenantId: string, reason: string): Promise<void>;
  activateTenant(tenantId: string): Promise<void>;
  terminateTenant(tenantId: string, options: TerminateOptions): Promise<void>;
  
  // 配额管理
  updateQuota(tenantId: string, quota: Partial<Quota>): Promise<void>;
  checkQuota(tenantId: string, resource: string): Promise<QuotaStatus>;
  
  // 批量操作
  batchCreateTenants(specs: TenantSpec[]): Promise<BatchResult<Tenant>>;
  batchUpdateStatus(tenantIds: string[], status: TenantStatus): Promise<BatchResult<void>>;
}
```

**租户管理界面原型：**

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  租户管理                                        [+ 新建租户] [批量操作 ▼] [导出] [刷新]      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  筛选: [全部状态 ▼] [全部套餐 ▼] [全部区域 ▼]     搜索: [🔍 输入租户名称或ID...]       │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  ☑  │ 租户ID      │ 名称        │ 套餐   │ 状态   │ 渠道 │ 资源使用  │ 创建时间   │ 操作 │   │
│  ├─────┼─────────────┼─────────────┼────────┼────────┼──────┼───────────┼────────────┼──────┤   │
│  │  ☐  │ tenant-001  │ 客户A公司   │ 高级版 │ 🟢 运行 │ 5/10 │ 45%       │ 2025-01-15 │ [⋮] │   │
│  │  ☐  │ tenant-002  │ 客户B科技   │ 基础版 │ 🟢 运行 │ 2/3  │ 62%       │ 2025-02-01 │ [⋮] │   │
│  │  ☐  │ tenant-003  │ 客户C集团   │ 企业版 │ 🟡 告警 │ 8/∞  │ 89% ⚠️    │ 2024-12-10 │ [⋮] │   │
│  │  ☐  │ tenant-004  │ 客户D工作室 │ 基础版 │ 🔴 停止 │ 0/3  │ 0%        │ 2025-02-20 │ [⋮] │   │
│  │  ☐  │ tenant-005  │ 客户E电商   │ 标准版 │ 🟢 运行 │ 4/5  │ 34%       │ 2025-01-28 │ [⋮] │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  共 123 个租户                      [< 1 2 3 4 5 ... 13 >]    每页 20 ▼              │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

操作菜单 [⋮]:
├── 查看详情
├── 编辑租户
├── 资源调整
├── 部署实例
├── 重启实例
├── 查看日志
├── 渠道管理
├── 配额管理
├── 费用账单
├── ─────────
├── 暂停租户
└── 删除租户
```

### 4.3 资源模板管理

```typescript
// 资源模板定义
interface ResourceTemplate {
  id: string;
  name: string;                  // 模板名称: 基础版、标准版、高级版、企业版
  description: string;
  category: 'preset' | 'custom';
  
  // 资源规格
  resources: {
    compute: {
      cpu: string;               // 如 "2" (2核)
      memory: string;            // 如 "4Gi"
      gpu?: string;              // 可选
    };
    storage: {
      size: string;              // 如 "10Gi"
      class: string;             // StorageClass
      backupEnabled: boolean;
    };
    network: {
      bandwidth?: string;        // 带宽限制
      staticIP: boolean;
    };
  };
  
  // 功能特性
  features: {
    maxChannels: number;
    maxAgents: number;
    maxWorkspaces: number;
    allowedChannelTypes: ChannelType[];
    allowedModels: string[];
    sandboxEnabled: boolean;
    browserEnabled: boolean;
    canvasEnabled: boolean;
    voiceEnabled: boolean;
    apiAccess: boolean;
    webhookAccess: boolean;
  };
  
  // K8s 配置
  k8sConfig: {
    replicas: number;            // Pod 副本数
    priorityClass: string;       // 优先级
    nodeSelector?: Record<string, string>;
    tolerations?: Toleration[];
    affinity?: Affinity;
    resources: ResourceRequirements;
  };
  
  // 默认配置
  defaults: {
    openclawConfig: Partial<OpenClawConfig>;
    envVars: Record<string, string>;
  };
  
  // 定价
  pricing: {
    monthlyPrice: number;
    yearlyPrice: number;
    currency: string;
    billingModel: 'per_instance' | 'per_usage';
  };
  
  // 状态
  status: 'active' | 'deprecated' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

// 预置模板示例
const PRESET_TEMPLATES: ResourceTemplate[] = [
  {
    id: 'basic',
    name: '基础版',
    description: '适合个人用户或小型团队',
    resources: {
      compute: { cpu: '500m', memory: '512Mi' },
      storage: { size: '5Gi', class: 'nfs-standard', backupEnabled: false },
    },
    features: {
      maxChannels: 3,
      maxAgents: 2,
      maxWorkspaces: 1,
      allowedChannelTypes: ['whatsapp', 'telegram', 'webchat'],
      allowedModels: ['claude-3-haiku', 'gpt-3.5-turbo'],
      sandboxEnabled: false,
      browserEnabled: false,
      canvasEnabled: true,
      voiceEnabled: false,
      apiAccess: false,
      webhookAccess: false,
    },
    k8sConfig: {
      replicas: 1,
      priorityClass: 'low',
      resources: {
        requests: { cpu: '250m', memory: '256Mi' },
        limits: { cpu: '500m', memory: '512Mi' },
      },
    },
    pricing: { monthlyPrice: 29, yearlyPrice: 290, currency: 'CNY', billingModel: 'per_instance' },
  },
  {
    id: 'standard',
    name: '标准版',
    description: '适合中小型企业',
    resources: {
      compute: { cpu: '2', memory: '4Gi' },
      storage: { size: '20Gi', class: 'nfs-standard', backupEnabled: true },
    },
    features: {
      maxChannels: 10,
      maxAgents: 5,
      maxWorkspaces: 3,
      allowedChannelTypes: ['whatsapp', 'telegram', 'discord', 'slack', 'webchat', 'email'],
      allowedModels: ['claude-3-sonnet', 'gpt-4', 'gemini-pro'],
      sandboxEnabled: true,
      browserEnabled: true,
      canvasEnabled: true,
      voiceEnabled: false,
      apiAccess: true,
      webhookAccess: true,
    },
    k8sConfig: {
      replicas: 1,
      priorityClass: 'medium',
      resources: {
        requests: { cpu: '1', memory: '2Gi' },
        limits: { cpu: '2', memory: '4Gi' },
      },
    },
    pricing: { monthlyPrice: 99, yearlyPrice: 990, currency: 'CNY', billingModel: 'per_instance' },
  },
  {
    id: 'premium',
    name: '高级版',
    description: '适合大型企业和高并发场景',
    resources: {
      compute: { cpu: '4', memory: '8Gi' },
      storage: { size: '50Gi', class: 'nfs-fast', backupEnabled: true },
    },
    features: {
      maxChannels: 50,
      maxAgents: 20,
      maxWorkspaces: 10,
      allowedChannelTypes: ['*'],  // 全部渠道
      allowedModels: ['*'],  // 全部模型
      sandboxEnabled: true,
      browserEnabled: true,
      canvasEnabled: true,
      voiceEnabled: true,
      apiAccess: true,
      webhookAccess: true,
    },
    k8sConfig: {
      replicas: 1,
      priorityClass: 'high',
      resources: {
        requests: { cpu: '2', memory: '4Gi' },
        limits: { cpu: '4', memory: '8Gi' },
      },
    },
    pricing: { monthlyPrice: 299, yearlyPrice: 2990, currency: 'CNY', billingModel: 'per_instance' },
  },
  {
    id: 'enterprise',
    name: '企业版',
    description: '完全定制化，专属资源',
    resources: {
      compute: { cpu: '8', memory: '16Gi' },
      storage: { size: '200Gi', class: 'ssd-premium', backupEnabled: true },
    },
    features: {
      maxChannels: Infinity,
      maxAgents: Infinity,
      maxWorkspaces: Infinity,
      allowedChannelTypes: ['*'],
      allowedModels: ['*'],
      sandboxEnabled: true,
      browserEnabled: true,
      canvasEnabled: true,
      voiceEnabled: true,
      apiAccess: true,
      webhookAccess: true,
    },
    k8sConfig: {
      replicas: 2,  // 高可用
      priorityClass: 'critical',
      nodeSelector: { 'openclaw.cloud/dedicated': 'true' },
      resources: {
        requests: { cpu: '4', memory: '8Gi' },
        limits: { cpu: '8', memory: '16Gi' },
      },
    },
    pricing: { monthlyPrice: 0, yearlyPrice: 0, currency: 'CNY', billingModel: 'per_usage' },
  },
];

// 模板管理服务
interface TemplateService {
  createTemplate(template: ResourceTemplate): Promise<ResourceTemplate>;
  updateTemplate(templateId: string, updates: Partial<ResourceTemplate>): Promise<ResourceTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
  getTemplate(templateId: string): Promise<ResourceTemplate>;
  listTemplates(filters?: TemplateFilters): Promise<ResourceTemplate[]>;
  
  // 模板应用
  applyTemplate(tenantId: string, templateId: string, overrides?: Partial<ResourceTemplate>): Promise<void>;
  previewTemplate(templateId: string): Promise<TemplatePreview>;
  
  // 版本管理
  createTemplateVersion(templateId: string, changes: Partial<ResourceTemplate>): Promise<TemplateVersion>;
  rollbackTemplateVersion(templateId: string, version: number): Promise<void>;
}
```

**模板管理界面：**

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  资源模板                                        [+ 新建模板] [克隆] [导入] [导出]           │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  预设模板                                    状态: 全部 ●                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────┐  │
│  │    🟢 基础版        │  │    🟢 标准版        │  │    🟢 高级版        │  │   🟢 企业版   │  │
│  │                    │  │                    │  │                    │  │              │  │
│  │  500m CPU          │  │  2 CPU             │  │  4 CPU             │  │  8 CPU       │  │
│  │  512Mi 内存        │  │  4Gi 内存          │  │  8Gi 内存          │  │  16Gi 内存   │  │
│  │  5Gi 存储          │  │  20Gi 存储         │  │  50Gi 存储         │  │  200Gi 存储  │  │
│  │                    │  │                    │  │                    │  │              │  │
│  │  3 个渠道          │  │  10 个渠道         │  │  50 个渠道         │  │  无限渠道    │  │
│  │  2 个 Agent        │  │  5 个 Agent        │  │  20 个 Agent       │  │  无限 Agent  │  │
│  │                    │  │                    │  │                    │  │              │  │
│  │  ¥29/月            │  │  ¥99/月            │  │  ¥299/月           │  │  定制报价    │  │
│  │                    │  │                    │  │                    │  │              │  │
│  │  [编辑] [预览]     │  │  [编辑] [预览]     │  │  [编辑] [预览]     │  │  [编辑]      │  │
│  │  [应用: 45租户]    │  │  [应用: 67租户]    │  │  [应用: 23租户]    │  │  [应用: 5租户]│  │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘  └──────────────┘  │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  自定义模板                                                                          │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────┤   │
│  │  ID          │ 名称           │ CPU │ 内存 │ 存储 │ 渠道 │ 套餐数 │ 状态   │ 操作   │   │
│  ├──────────────┼────────────────┼─────┼──────┼──────┼──────┼────────┼────────┼────────┤   │
│  │ custom-001   │ 大客户定制A     │ 16  │ 32Gi │ 500G │ 100  │ 2      │ 活跃   │ [编辑] │   │
│  │ custom-002   │ 教育版          │ 1   │ 2Gi  │ 10G  │ 5    │ 15     │ 活跃   │ [编辑] │   │
│  │ custom-003   │ 测试版          │ 250m│ 256Mi│ 2G   │ 1    │ 0      │ 草稿   │ [编辑] │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 快速部署功能

```typescript
// 部署请求
interface DeployRequest {
  tenantId?: string;             // 现有租户（重新部署）
  tenantSpec?: TenantSpec;       // 新租户规格
  templateId: string;            // 资源模板
  
  // 部署配置
  deploymentConfig: {
    region: string;              // 部署区域
    nodePool?: string;           // 指定节点池
    version?: string;            // OpenClaw 版本
    domainPrefix?: string;       // 自定义域名前缀
  };
  
  // 初始配置
  initialConfig?: {
    channels?: ChannelConfig[];  // 预设渠道
    models?: ModelConfig;        // 模型配置
    adminEmail?: string;         // 管理员邮箱
  };
  
  // 选项
  options: {
    autoStart: boolean;          // 部署后自动启动
    sendNotification: boolean;   // 发送通知邮件
    dryRun?: boolean;            // 试运行（不实际部署）
  };
}

// 部署任务
interface DeployTask {
  id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  stage: string;                 // 当前阶段
  progress: number;              // 进度 0-100
  
  stages: DeployStage[];
  
  result?: {
    tenantId: string;
    instanceId: string;
    gatewayUrl: string;
    namespace: string;
    accessToken: string;
  };
  
  error?: {
    code: string;
    message: string;
    stage: string;
    details: any;
  };
  
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface DeployStage {
  name: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// 部署服务
interface DeployService {
  // 部署操作
  deploy(request: DeployRequest): Promise<DeployTask>;
  redeploy(tenantId: string, options: RedeployOptions): Promise<DeployTask>;
  undeploy(tenantId: string, options: UndeployOptions): Promise<DeployTask>;
  
  // 任务管理
  getTask(taskId: string): Promise<DeployTask>;
  listTasks(filters?: TaskFilters): Promise<DeployTask[]>;
  cancelTask(taskId: string): Promise<void>;
  
  // 预检
  preflight(tenantId: string): Promise<PreflightResult>;
  validateTemplate(templateId: string): Promise<ValidationResult>;
}
```

**快速部署界面：**

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  快速部署向导                                                                        [退出]   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  步骤 1: 选择部署模式                    步骤 2: 选择模板           步骤 3: 配置参数         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                                             │
│  ○ 新建租户                                    [标准版 ●]                                 │
│  ● 为现有租户部署                              ┌─────────────────────────────────────┐     │
│                                                │                                     │     │
│  选择租户:                                     │  2 CPU / 4Gi 内存 / 20Gi 存储       │     │
│  ┌─────────────────────────────────────────┐   │                                     │     │
│  │ 🔍 搜索租户...                          │   │  特性:                              │     │
│  │ ─────────────────────────────────────── │   │  • 10 个渠道                        │     │
│  │   tenant-123 客户A公司     标准版       │   │  • 5 个 Agent                       │     │
│  │   tenant-124 客户B科技     基础版       │   │  • 沙箱支持                         │     │
│  │   tenant-125 客户C集团     企业版       │   │  • 浏览器自动化                     │     │
│  │   tenant-126 客户D工作室   未部署       │   │                                     │     │
│  └─────────────────────────────────────────┘   │  价格: ¥99/月                       │     │
│                                                │                                     │     │
│                                                │  [查看详情] [更换模板]              │     │
│                                                └─────────────────────────────────────┘     │
│                                                                                             │
│  部署区域: [华东-上海 ●] [华北-北京 ○] [华南-深圳 ○]                                       │
│                                                                                             │
│  OpenClaw 版本: [v2026.2.23 (稳定版) ●] [v2026.3.1 (测试版) ○]                            │
│                                                                                             │
│  高级选项: [展开 ▼]                                                                         │
│                                                                                             │
│  ☑ 部署后自动启动实例                                                                       │
│  ☑ 发送部署通知邮件给租户管理员                                                             │
│                                                                                             │
│  预检结果: 🟢 资源充足，可以部署                                                            │
│                                                                                             │
│                                [ 上一步 ]           [ 开始部署 ]                            │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**部署进度界面：**

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  部署进度                                                                      [查看日志]   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  租户: tenant-126 (客户D工作室)                                                             │
│  模板: 标准版                                                                               │
│  任务ID: deploy-20250227-001                                                                │
│                                                                                             │
│  总体进度: ████████████████████████████████████░░░░  85%                                    │
│                                                                                             │
│  部署阶段:                                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                                             │
│  ✅ 1. 资源检查          (2s)    - 节点资源充足，配额检查通过                               │
│  ✅ 2. 创建命名空间      (1s)    - Namespace tenant-126 创建成功                          │
│  ✅ 3. 创建存储卷        (5s)    - PVC openclaw-data (20Gi) 已绑定                        │
│  ✅ 4. 生成配置          (1s)    - ConfigMap 和 Secret 已创建                             │
│  ✅ 5. 部署应用          (8s)    - Deployment 创建成功，Pod 启动中                        │
│  🔄 6. 健康检查          (进行中) - 等待 Gateway 就绪...                                    │
│  ⏳ 7. 配置域名          (待执行)                                                           │
│  ⏳ 8. 发送通知          (待执行)                                                           │
│                                                                                             │
│  实时日志:                                                                                  │
│  ────────────────────────────────────────────────────────────────────────────────────────  │
│  [10:23:45] Pod openclaw-gateway-xxx 状态: ContainerCreating                              │
│  [10:23:48] Pod openclaw-gateway-xxx 状态: Running                                        │
│  [10:23:50] 开始健康检查: http://10.0.1.23:18789/health                                   │
│  [10:23:52] 健康检查通过，Gateway 运行正常                                                │
│  [10:23:53] 配置 Ingress: tenant-126.ocr.openclaw.cloud                                   │
│  ...                                                                                        │
│                                                                                             │
│  预计剩余时间: ~30 秒                                                                       │
│                                                                                             │
│                                           [ 取消部署 ]                                      │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 资源池管理

```typescript
// 资源池定义
interface ResourcePool {
  id: string;
  name: string;
  type: 'compute' | 'storage' | 'network' | 'gpu';
  
  // 节点组
  nodeGroups: NodeGroup[];
  
  // 容量
  capacity: {
    total: ResourceMetrics;
    used: ResourceMetrics;
    available: ResourceMetrics;
    reserved: ResourceMetrics;
  };
  
  // 自动伸缩
  autoscaling?: {
    enabled: boolean;
    minNodes: number;
    maxNodes: number;
    metrics: AutoscalingMetric[];
  };
  
  // 标签和污点
  labels: Record<string, string>;
  taints?: Taint[];
  
  status: 'active' | 'maintenance' | 'degraded' | 'offline';
}

interface NodeGroup {
  name: string;
  instanceType: string;          // 实例规格
  nodeCount: number;
  nodes: NodeInfo[];
  
  // 资源规格
  resources: {
    cpu: string;
    memory: string;
    ephemeralStorage: string;
  };
  
  // 成本
  costPerHour: number;
}

// 资源管理服务
interface ResourcePoolService {
  // 资源池管理
  createPool(spec: PoolSpec): Promise<ResourcePool>;
  updatePool(poolId: string, updates: Partial<ResourcePool>): Promise<ResourcePool>;
  deletePool(poolId: string): Promise<void>;
  listPools(): Promise<ResourcePool[]>;
  
  // 容量规划
  getCapacityReport(): Promise<CapacityReport>;
  predictCapacity(days: number): Promise<CapacityPrediction>;
  suggestScaling(): Promise<ScalingSuggestion[]>;
  
  // 调度
  selectNodeForTenant(tenantId: string, requirements: ResourceRequirements): Promise<NodeSelection>;
  migrateTenant(tenantId: string, targetPool: string): Promise<MigrateTask>;
  
  // 成本
  calculateCost(tenantId: string): Promise<CostBreakdown>;
  optimizeResources(): Promise<OptimizationSuggestion[]>;
}
```

**资源池管理界面：**

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  资源池管理                                      [+ 添加节点] [自动伸缩配置] [容量规划]      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  计算资源池                            总体使用率: CPU 68% | 内存 72% | 存储 45%      │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────┐  │
│  │  🟢 标准节点池      │  │  🟢 大内存节点池    │  │  🟡 GPU 节点池      │  │  🔴 备用节点池 │  │
│  │  standard-pool     │  │  highmem-pool      │  │  gpu-pool          │  │  spare-pool  │  │
│  │                    │  │                    │  │                    │  │              │  │
│  │  节点: 8           │  │  节点: 4           │  │  节点: 2           │  │  节点: 0     │  │
│  │  规格: 4C8G        │  │  规格: 8C32G       │  │  规格: 8C32G+T4    │  │  规格: -     │  │
│  │                    │  │                    │  │                    │  │              │  │
│  │  CPU:  ████████░░  │  │  CPU:  ██████░░░░  │  │  CPU:  ████░░░░░░  │  │  CPU:  -     │  │
│  │  内存: ███████░░░  │  │  内存: ████████░░  │  │  内存: █████░░░░░  │  │  内存: -     │  │
│  │                    │  │                    │  │                    │  │              │  │
│  │  租户: 32          │  │  租户: 12          │  │  租户: 3           │  │  租户: 0     │  │
│  │  Pod: 156          │  │  Pod: 48           │  │  Pod: 6            │  │  Pod: 0      │  │
│  │                    │  │                    │  │                    │  │              │  │
│  │  自动伸缩: 开      │  │  自动伸缩: 关      │  │  自动伸缩: 关      │  │  自动伸缩: 关 │  │
│  │  3-20 节点         │  │  4-10 节点         │  │  2-4 节点          │  │  0-5 节点    │  │
│  │                    │  │                    │  │                    │  │              │  │
│  │  [管理] [扩容]     │  │  [管理] [扩容]     │  │  [管理] [扩容]     │  │  [管理]      │  │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘  └──────────────┘  │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  存储资源池                                                                          │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────┤   │
│  │  名称         │ 类型   │ 总容量  │ 已用   │ 可用   │ 性能   │ 备份策略 │ 状态   │   │   │
│  ├───────────────┼────────┼─────────┼────────┼────────┼────────┼──────────┼────────┼───┤   │
│  │ nfs-standard  │ NFS    │ 10 TB   │ 4.2 TB │ 5.8 TB │ 标准   │ 每日增量 │ 正常   │[管理]│  │
│  │ nfs-fast      │ NFS    │ 5 TB    │ 2.1 TB │ 2.9 TB │ 高性能 │ 每日增量 │ 正常   │[管理]│  │
│  │ s3-backup     │ 对象   │ 50 TB   │ 12 TB  │ 38 TB  │ -      │ 长期归档 │ 正常   │[管理]│  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ 容量预警                                                                         │   │
│  │  • 标准节点池 CPU 使用率超过 80%，建议扩容或优化调度                                 │   │
│  │  • 预计 15 天后存储池 nfs-standard 将达到 80% 容量                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 监控告警系统

```typescript
// 告警规则
interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  
  // 触发条件
  condition: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    duration: string;            // 持续时间，如 "5m"
    
    // 高级条件
    aggregation?: 'avg' | 'sum' | 'max' | 'min' | 'count';
    groupBy?: string[];
  };
  
  // 作用范围
  scope: {
    type: 'global' | 'pool' | 'tenant' | 'instance';
    targets?: string[];          // 具体的租户ID或资源池ID
  };
  
  // 通知配置
  notifications: {
    channels: ('email' | 'sms' | 'webhook' | 'slack' | 'dingtalk')[];
    recipients?: string[];
    webhookUrl?: string;
    
    // 抑制规则
    suppression?: {
      enabled: boolean;
      interval: string;          // 抑制间隔
    };
  };
  
  // 自动处理
  autoAction?: {
    enabled: boolean;
    action: 'scale_up' | 'scale_down' | 'restart' | 'notify_only';
    parameters?: Record<string, any>;
  };
  
  status: 'enabled' | 'disabled';
}

// 告警事件
interface AlertEvent {
  id: string;
  ruleId: string;
  severity: string;
  status: 'firing' | 'resolved' | 'acknowledged';
  
  // 触发信息
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  
  // 上下文
  context: {
    tenantId?: string;
    instanceId?: string;
    poolId?: string;
    metricValue: number;
    threshold: number;
    message: string;
  };
  
  // 处理记录
  actions: AlertAction[];
}

// 监控服务
interface MonitorService {
  // 告警规则管理
  createAlertRule(rule: AlertRule): Promise<AlertRule>;
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule>;
  deleteAlertRule(ruleId: string): Promise<void>;
  listAlertRules(): Promise<AlertRule[]>;
  
  // 告警事件
  listAlertEvents(filters?: AlertFilters): Promise<PaginatedList<AlertEvent>>;
  acknowledgeAlert(eventId: string, userId: string): Promise<void>;
  resolveAlert(eventId: string): Promise<void>;
  
  // 查询
  queryMetrics(query: MetricQuery): Promise<MetricResult>;
  getDashboard(dashboardId: string): Promise<Dashboard>;
  
  // 日志
  queryLogs(query: LogQuery): Promise<LogResult>;
  tailLogs(query: LogQuery): AsyncIterable<LogEntry>;
}
```

**告警管理界面：**

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  监控告警                                        [告警规则] [通知配置] [历史记录]            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  活跃告警 (3)                              [全部确认] [导出] [自动刷新: 开]           │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────┤   │
│  │  级别  │ 告警名称           │ 目标              │ 触发时间  │ 持续时间 │ 状态   │ 操作 │   │
│  ├────────┼────────────────────┼───────────────────┼───────────┼──────────┼────────┼──────┤   │
│  │ 🔴 P0  │ 实例内存不足        │ tenant-003/web    │ 10:23:45  │ 15分钟   │ 未确认 │ [确认][查看]│   │
│  │        │ 使用率 92% > 85%   │                   │           │          │        │      │   │
│  ├────────┼────────────────────┼───────────────────┼───────────┼──────────┼────────┼──────┤   │
│  │ 🟡 P1  │ 渠道连接断开        │ tenant-007/wa     │ 10:15:22  │ 23分钟   │ 已确认 │ [查看][处理]│   │
│  │        │ WhatsApp 连接失败   │                   │           │          │ 管理员A │      │   │
│  ├────────┼────────────────────┼───────────────────┼───────────┼──────────┼────────┼──────┤   │
│  │ 🟡 P1  │ 存储池容量预警      │ nfs-standard      │ 09:45:00  │ 1小时    │ 已确认 │ [查看][处理]│   │
│  │        │ 使用率 78% > 75%   │                   │           │          │ 管理员B │      │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  告警规则 (12)                                         [+ 新建规则] [批量操作]        │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────┤   │
│  │  名称                │ 条件                     │ 范围    │ 通知    │ 状态   │ 操作   │   │
│  ├──────────────────────┼──────────────────────────┼─────────┼─────────┼────────┼────────┤   │
│  │ 实例内存不足          │ 内存 > 85% 持续 5m       │ 全部租户 │ 邮件+钉钉│ ✅ 启用│ [编辑] │   │
│  │ 实例 CPU 过高         │ CPU > 80% 持续 10m       │ 全部租户 │ 邮件    │ ✅ 启用│ [编辑] │   │
│  │ 渠道连接断开          │ connected == 0           │ 全部租户 │ 邮件+短信│ ✅ 启用│ [编辑] │   │
│  │ 存储池容量不足        │ 使用率 > 75%             │ 全局    │ 邮件+钉钉│ ✅ 启用│ [编辑] │   │
│  │ 节点宕机              │ node_ready == 0          │ 全局    │ 电话+短信│ ✅ 启用│ [编辑] │   │
│  │ 部署失败              │ deploy_status == failed  │ 全部租户 │ 邮件    │ ✅ 启用│ [编辑] │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  监控仪表盘                                                                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │   │
│  │  │ 资源使用率   │  │ 租户活跃度   │  │ 渠道状态    │  │ 部署成功率趋势               │ │   │
│  │  │ [曲线图]    │  │ [热力图]    │  │ [饼图]      │  │ [柱状图]                    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 五、系统配置

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  系统设置                                                                                   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────┬─────────────────────────────────────────────────────────────────────┐ │
│  │  基础配置        │                                                                     │ │
│  │  ────────────── │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │                 │  │  平台信息                                                    │   │ │
│  │  基础配置    ●   │  │  • 平台名称: OpenClaw Cloud                                  │   │ │
│  │  安全设置        │  │  • 平台域名: *.ocr.openclaw.cloud                            │   │ │
│  │  资源池配置      │  │  • 管理员邮箱: admin@openclaw.cloud                          │   │ │
│  │  模型提供商      │  │  • 技术支持: support@openclaw.cloud                          │   │ │
│  │  通知渠道        │  │                                                             │   │ │
│  │  计费设置        │  └─────────────────────────────────────────────────────────────┘   │ │
│  │  备份恢复        │                                                                     │ │
│  │  日志审计        │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  许可证          │  │  默认部署配置                                                │   │ │
│  │                 │  │  • 默认区域: 华东-上海                                        │   │ │
│  │                 │  │  • 默认节点池: standard-pool                                 │   │ │
│  │                 │  │  • 默认版本: v2026.2.23                                      │   │ │
│  │                 │  │  • 自动备份: 启用 (每日 02:00)                               │   │ │
│  │                 │  │  • 域名后缀: .ocr.openclaw.cloud                             │   │ │
│  │                 │  └─────────────────────────────────────────────────────────────┘   │ │
│  │                 │                                                                     │ │
│  │                 │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │                 │  │  配额默认值                                                  │   │ │
│  │                 │  │  • 每租户最大实例数: 1                                       │   │ │
│  │                 │  │  • 每租户最大渠道数: 50 (企业版)                             │   │ │
│  │                 │  │  • 全局租户数限制: 10000                                     │   │ │
│  │                 │  │  • 默认 Token 有效期: 90 天                                  │   │ │
│  │                 │  └─────────────────────────────────────────────────────────────┘   │ │
│  │                 │                                                                     │ │
│  └─────────────────┴─────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、API 设计

### 6.1 核心 API 列表

```yaml
# 管理员 API
basePath: /api/v1/admin
authentication: Bearer Token (Admin JWT)

# 租户管理
groups:
  - name: 租户管理
    endpoints:
      - POST   /tenants                    # 创建租户
      - GET    /tenants                    # 列出租户
      - GET    /tenants/:id                # 获取租户详情
      - PATCH  /tenants/:id                # 更新租户
      - DELETE /tenants/:id                # 删除租户
      - POST   /tenants/:id/suspend        # 暂停租户
      - POST   /tenants/:id/activate       # 激活租户
      - POST   /tenants/:id/quota          # 修改配额
      
  - name: 部署管理
    endpoints:
      - POST   /deployments                # 创建部署任务
      - GET    /deployments                # 列出部署任务
      - GET    /deployments/:id            # 获取部署详情
      - POST   /deployments/:id/cancel     # 取消部署
      - GET    /deployments/:id/logs       # 获取部署日志
      - POST   /tenants/:id/redeploy       # 重新部署
      - POST   /tenants/:id/undeploy       # 卸载部署
      
  - name: 资源模板
    endpoints:
      - POST   /templates                  # 创建模板
      - GET    /templates                  # 列出模板
      - GET    /templates/:id              # 获取模板详情
      - PATCH  /templates/:id              # 更新模板
      - DELETE /templates/:id              # 删除模板
      - POST   /templates/:id/apply        # 应用模板到租户
      
  - name: 资源池
    endpoints:
      - GET    /pools                      # 列出资源池
      - GET    /pools/:id                  # 获取资源池详情
      - POST   /pools/:id/scale            # 扩容/缩容
      - GET    /pools/capacity             # 容量报告
      - POST   /pools/optimize             # 资源优化建议
      
  - name: 监控告警
    endpoints:
      - GET    /metrics                    # 查询指标
      - GET    /metrics/query              # PromQL 查询
      - POST   /alert-rules                # 创建告警规则
      - GET    /alert-rules                # 列出告警规则
      - GET    /alert-events               # 列出告警事件
      - POST   /alert-events/:id/ack       # 确认告警
      - GET    /logs                       # 查询日志
      
  - name: 系统管理
    endpoints:
      - GET    /system/status              # 系统状态
      - GET    /system/config              # 获取配置
      - PATCH  /system/config              # 更新配置
      - GET    /system/audit-logs          # 审计日志
      - POST   /system/maintenance         # 进入维护模式
      - POST   /system/backup              # 触发备份
```

---

## 七、部署架构

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    运维管理平台部署架构                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  Ingress/Nginx                                                                              │
│  • oamp.openclaw.cloud → 运维平台控制台                                                    │
│  • oamp-api.openclaw.cloud → 平台 API                                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  Namespace: openclaw-platform                                                               │
│                                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  OAMP Console   │  │  OAMP API       │  │  OAMP Operator  │  │  OAMP Worker            │ │
│  │  (Web UI)       │  │  (REST API)     │  │  (Controller)   │  │  (Async Tasks)          │ │
│  │                 │  │                 │  │                 │  │                         │ │
│  │  React/Vue      │  │  Node.js/Go     │  │  TypeScript     │  │  Deployment jobs        │ │
│  │  Nginx          │  │  Express/Gin    │  │  K8s SDK        │  │  Metric collection      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  PostgreSQL     │  │  Redis          │  │  Prometheus     │  │  Loki/Grafana           │ │
│  │  (平台数据)      │  │  (缓存/队列)     │  │  (指标存储)      │  │  (日志/可视化)          │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼ (控制)
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  K8s Cluster (被管理集群)                                                                    │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  租户命名空间 (动态创建)                                                               │   │
│  │  tenant-001, tenant-002, tenant-003, ...                                            │   │
│  │                                                                                      │   │
│  │  每个命名空间:                                                                        │   │
│  │  • Deployment/openclaw-gateway                                                       │   │
│  │  • Service/openclaw-service                                                         │   │
│  │  • PVC/openclaw-data (NFS)                                                          │   │
│  │  • ConfigMap/openclaw-config                                                        │   │
│  │  • Secret/openclaw-secrets                                                          │   │
│  │  • NetworkPolicy/openclaw-isolation                                                 │   │
│  │  • (可选) HPA/openclaw-autoscaler                                                   │   │
│  │  • (可选) ResourceQuota/tenant-quota                                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  系统命名空间                                                                         │   │
│  │  • openclaw-system: Operator, Webhook                                               │   │
│  │  • openclaw-monitoring: Prometheus, Grafana, AlertManager                           │   │
│  │  • openclaw-ingress: Ingress Controller                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  基础设施                                                                                   │
│  • NFS Server (存储)                                                                        │
│  • Load Balancer (负载均衡)                                                                  │
│  • Object Storage (备份)                                                                     │
│  • External DNS (域名解析)                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 八、总结

这个设计方案提供了一个**面向运维团队**的 OpenClaw 管理平台，核心特性：

### 关键能力
1. **租户全生命周期管理** - 创建、部署、监控、销毁
2. **资源模板化** - 预置基础版/标准版/高级版/企业版套餐
3. **一键快速部署** - 向导式部署，实时进度跟踪
4. **资源池管理** - 节点池管理、容量规划、自动伸缩
5. **监控告警** - 多维度监控、智能告警、自动恢复
6. **成本管控** - 资源成本追踪、优化建议

### 与之前的区别
| 维度 | 原设计 (SaaS) | 新设计 (PaaS/运维) |
|------|---------------|-------------------|
| **用户** | 终端用户 | 运维管理员 |
| **功能** | 自用配置 | 管理多租户 |
| **视角** | 单租户视角 | 平台全局视角 |
| **核心** | 消息渠道、AI 配置 | 资源调度、部署编排 |
| **计费** | 用户付费 | 内部成本分摊 |

### 技术栈建议
- **前端**: React/Vue + Ant Design Pro
- **后端**: Node.js (NestJS) 或 Go (Gin)
- **Operator**: TypeScript + @kubernetes/client-node
- **数据库**: PostgreSQL + Redis
- **监控**: Prometheus + Grafana + Loki
- **工作流**: Temporal 或自研队列

需要我详细展开哪个模块？比如 Operator 代码、部署流程、或者监控告警的具体实现？