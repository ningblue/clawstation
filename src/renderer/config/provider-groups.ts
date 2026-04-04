/**
 * 供应商分组配置 - 仅国内模型服务商
 *
 * 对齐 QClaw 大模型设置的两种自定义模式：
 * - 模型API：用户使用自己的 API Key 直连厂商
 * - Coding Plan：通过各厂商的 Coding Plan 套餐使用
 *
 * 层级: 模式(ModelAPI/CodingPlan) → 厂商 → 模型列表
 */

export interface ProviderDef {
  /** 厂商唯一 ID（对应 OpenClaw provider ID） */
  providerId: string;
  /** 厂商显示名称 */
  label: string;
  /** 可用模型列表（若为空则从 catalog 动态获取） */
  models?: { id: string; name: string; contextWindow?: number }[];
  /** API Key 获取链接 */
  apiKeyUrl?: string;
  /** 如果与另一个 provider 共享认证 */
  sharesAuthWith?: string;
}

export interface ModelModeConfig {
  /** 模式 ID */
  modeId: 'default' | 'model-api' | 'coding-plan';
  /** 模式显示名称 */
  modeName: string;
  /** 模式描述 */
  description?: string;
  /** 该模式下可用的厂商列表 */
  providers: ProviderDef[];
}

// ───────────────────────────────────────────────────────
// 模型API 模式 - 用户自己的 API Key
// ───────────────────────────────────────────────────────
const MODEL_API_PROVIDERS: ProviderDef[] = [
  {
    providerId: 'minimax',
    label: 'Minimax（国内）',
    apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
  },
  {
    providerId: 'moonshot',
    label: 'Moonshot AI（Kimi国内）',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    providerId: 'deepseek',
    label: '深度求索（DeepSeek）',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    providerId: 'zai',
    label: '智谱 AI（GLM国内）',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    providerId: 'bailian',
    label: '百炼（千问）',
    apiKeyUrl: 'https://bailian.console.aliyun.com/',
  },
  {
    providerId: 'volcengine',
    label: '火山引擎（豆包）',
    apiKeyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
  },
];

// ───────────────────────────────────────────────────────
// Coding Plan 模式 - 各厂商预付费套餐
// ───────────────────────────────────────────────────────
const CODING_PLAN_PROVIDERS: ProviderDef[] = [
  {
    providerId: 'bailian',
    label: '百炼 Coding Plan',
    apiKeyUrl: 'https://bailian.console.aliyun.com/',
  },
  {
    providerId: 'minimax',
    label: 'MiniMax（国内-Coding Plan）',
    apiKeyUrl: 'https://platform.minimaxi.com/',
  },
  {
    providerId: 'zai',
    label: '智谱 AI（GLM国内-Coding Plan）',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    providerId: 'volcengine-plan',
    label: '方舟（火山引擎）Coding Plan',
    apiKeyUrl: 'https://console.volcengine.com/ark/',
  },
  {
    providerId: 'kimi-coding',
    label: 'Kimi Coding Plan',
    apiKeyUrl: 'https://platform.moonshot.cn/',
  },
];

// ───────────────────────────────────────────────────────
// 导出三种模式配置
// ───────────────────────────────────────────────────────

export const MODEL_MODE_CONFIGS: ModelModeConfig[] = [
  {
    modeId: 'default',
    modeName: '默认大模型',
    description: '使用系统默认模型，无需配置',
    providers: [],
  },
  {
    modeId: 'model-api',
    modeName: '自定义大模型—模型API',
    description: '使用自己的 API Key 直连模型厂商',
    providers: MODEL_API_PROVIDERS,
  },
  {
    modeId: 'coding-plan',
    modeName: '自定义大模型—Coding Plan',
    description: '通过厂商 Coding Plan 套餐使用模型',
    providers: CODING_PLAN_PROVIDERS,
  },
];

/**
 * 根据 providerId 查找厂商获取 key 的 URL
 */
export function getApiKeyUrl(providerId: string): string | undefined {
  for (const mode of MODEL_MODE_CONFIGS) {
    const provider = mode.providers.find(p => p.providerId === providerId);
    if (provider?.apiKeyUrl) return provider.apiKeyUrl;
  }
  return undefined;
}

// ───────────────────────────────────────────────────────
// 兼容旧版三栏结构（供 useModels hook 使用）
// ───────────────────────────────────────────────────────

export interface SubCategoryDef {
  label: string;
  providerIds: string[];
  sharesAuthWith?: string;
  hint?: string;
}

export interface ProviderGroupDef {
  groupId: string;
  groupName: string;
  icon: string;
  hint?: string;
  members: SubCategoryDef[];
}

/** 从新配置生成旧版分组定义（兼容 useModels） */
export const PROVIDER_GROUP_DEFINITIONS: ProviderGroupDef[] = (() => {
  // 收集所有唯一的 providerId，按厂商分组
  const seen = new Map<string, { groupName: string; providerIds: string[] }>();

  for (const mode of MODEL_MODE_CONFIGS) {
    for (const provider of mode.providers) {
      if (!seen.has(provider.providerId)) {
        seen.set(provider.providerId, {
          groupName: provider.label,
          providerIds: [provider.providerId],
        });
      }
    }
  }

  return Array.from(seen.entries()).map(([id, info]) => ({
    groupId: id,
    groupName: info.groupName.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim(),
    icon: '',
    members: [{
      label: info.groupName,
      providerIds: info.providerIds,
    }],
  }));
})();

/**
 * 建立 providerId -> groupId 的快速查找表
 */
export function buildProviderToGroupIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const group of PROVIDER_GROUP_DEFINITIONS) {
    for (const member of group.members) {
      for (const pid of member.providerIds) {
        if (!index.has(pid)) {
          index.set(pid, group.groupId);
        }
      }
    }
  }
  return index;
}
