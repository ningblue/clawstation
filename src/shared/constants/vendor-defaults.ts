import type {
  AppModelConfig,
  ModeConfig,
  ModelModeId,
  VendorConfig,
  VendorDefault,
  VendorModel,
} from "../types/model-config.types";

const modelApiVendors: VendorDefault[] = [
  {
    vendorId: "modelstudio",
    familyId: "modelstudio",
    label: "百炼（千问）",
    shortLabel: "百炼",
    icon: "BL",
    modeId: "model-api",
    openclawProviderId: "modelstudio",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyUrl: "https://bailian.console.aliyun.com/",
    authProfileId: "modelstudio",
    models: [
      { id: "qwen3.5-plus", name: "Qwen3.5 Plus" },
      { id: "qwen-max", name: "Qwen Max" },
      { id: "qwen-plus", name: "Qwen Plus" },
      { id: "qwen-turbo", name: "Qwen Turbo" },
      { id: "qwen3-coder-plus", name: "Qwen3 Coder Plus" },
      { id: "MiniMax-M2.5", name: "MiniMax M2.5" },
      { id: "kimi-k2.5", name: "Kimi K2.5" },
      { id: "glm-5", name: "GLM-5" },
    ],
  },
  {
    vendorId: "minimax",
    familyId: "minimax",
    label: "MiniMax",
    shortLabel: "MiniMax",
    icon: "MM",
    modeId: "model-api",
    openclawProviderId: "minimax",
    baseUrl: "https://api.minimax.chat/v1",
    api: "openai-completions",
    authHeader: true,
    apiKeyUrl:
      "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    authProfileId: "minimax",
    models: [
      { id: "MiniMax-M2.7", name: "MiniMax M2.7" },
      { id: "MiniMax-M2.5", name: "MiniMax M2.5" },
      { id: "MiniMax-M2.1", name: "MiniMax M2.1" },
      { id: "MiniMax-M2.1-Lightning", name: "MiniMax M2.1 Lightning" },
      { id: "MiniMax-M2", name: "MiniMax M2" },
    ],
  },
  {
    vendorId: "moonshot",
    familyId: "moonshot",
    label: "Moonshot AI",
    shortLabel: "Moonshot",
    icon: "Ki",
    modeId: "model-api",
    openclawProviderId: "moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    authProfileId: "moonshot",
    models: [
      { id: "kimi-k2-thinking", name: "Kimi K2 Thinking" },
      { id: "kimi-k2-thinking-turbo", name: "Kimi K2 Thinking Turbo" },
      { id: "kimi-k2.5", name: "Kimi K2.5" },
      { id: "moonshot-v1-128k", name: "Moonshot V1 128K" },
    ],
  },
  {
    vendorId: "deepseek",
    familyId: "deepseek",
    label: "DeepSeek",
    shortLabel: "DeepSeek",
    icon: "DS",
    modeId: "model-api",
    openclawProviderId: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    authProfileId: "deepseek",
    models: [
      { id: "deepseek-chat", name: "DeepSeek Chat" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
    ],
  },
  {
    vendorId: "zai",
    familyId: "zai",
    label: "Z.AI",
    shortLabel: "Z.AI",
    icon: "Z",
    modeId: "model-api",
    openclawProviderId: "zai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    api: "openai-completions",
    apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    authProfileId: "zai",
    models: [
      { id: "glm-5-turbo", name: "GLM-5-Turbo" },
      { id: "glm-5", name: "GLM-5" },
      { id: "glm-4.7", name: "GLM-4.7" },
      { id: "glm-4.6", name: "GLM-4.6" },
      { id: "glm-4.5-air", name: "GLM-4.5-Air" },
      { id: "glm-4.5", name: "GLM-4.5" },
    ],
  },
  {
    vendorId: "volcengine",
    familyId: "volcengine",
    label: "火山引擎",
    shortLabel: "火山",
    icon: "VC",
    modeId: "model-api",
    openclawProviderId: "volcengine",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKeyUrl:
      "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    authProfileId: "volcengine",
    models: [
      { id: "doubao-seed-code-preview-251028", name: "Doubao Seed Code Preview" },
      { id: "doubao-seed-1-8-251228", name: "Doubao Seed 1.8" },
      { id: "kimi-k2-5-260127", name: "Kimi K2.5" },
      { id: "glm-4-7-251222", name: "GLM 4.7" },
      { id: "deepseek-v3-2-251201", name: "DeepSeek V3.2" },
    ],
  },
];

const codingPlanVendors: VendorDefault[] = [
  {
    vendorId: "tencent-token",
    familyId: "tencent",
    label: "腾讯云Token Plan",
    shortLabel: "腾讯云",
    icon: "TX",
    modeId: "coding-plan",
    openclawProviderId: "tencent-token",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    apiKeyUrl: "https://console.cloud.tencent.com/cam/capi",
    authProfileId: "tencent-token",
    models: [
      { id: "hunyuan-t1", name: "Hunyuan T1", contextWindow: 256000 },
      { id: "hunyuan-turbo", name: "Hunyuan Turbo", contextWindow: 256000 },
    ],
  },
  {
    vendorId: "tencent-coding",
    familyId: "tencent",
    label: "腾讯云 Coding Plan",
    shortLabel: "腾讯云",
    icon: "TX",
    modeId: "coding-plan",
    openclawProviderId: "tencent-coding",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    apiKeyUrl: "https://console.cloud.tencent.com/cam/capi",
    authProfileId: "tencent-coding",
    models: [
      { id: "hunyuan-code", name: "Hunyuan Code", contextWindow: 256000 },
      {
        id: "hunyuan-turbo-code",
        name: "Hunyuan Turbo Code",
        contextWindow: 256000,
      },
    ],
  },
  {
    vendorId: "modelstudio-plan",
    familyId: "modelstudio",
    label: "百炼 Coding Plan",
    shortLabel: "百炼",
    icon: "BL",
    modeId: "coding-plan",
    openclawProviderId: "modelstudio-plan",
    baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
    apiKeyUrl: "https://bailian.console.aliyun.com/",
    authProfileId: "modelstudio-plan",
    models: [
      { id: "qwen3.5-plus", name: "Qwen3.5-Plus", contextWindow: 1000000 },
      {
        id: "qwen3-coder-plus",
        name: "Qwen3-Coder-Plus",
        contextWindow: 1000000,
      },
      { id: "qwen3-max-2026-01-23", name: "Qwen3-Max", contextWindow: 262144 },
      { id: "kimi-k2.5", name: "Kimi-K2.5", contextWindow: 262144 },
      { id: "glm-5", name: "GLM-5", contextWindow: 202752 },
      { id: "MiniMax-M2.5", name: "MiniMax-M2.5", contextWindow: 1000000 },
      { id: "glm-4.7", name: "GLM-4.7", contextWindow: 202752 },
    ],
  },
  {
    vendorId: "minimax-plan",
    familyId: "minimax",
    label: "MiniMax（国内-Coding Plan）",
    shortLabel: "MiniMax",
    icon: "MM",
    modeId: "coding-plan",
    openclawProviderId: "minimax-plan",
    baseUrl: "https://api.minimax.chat/v1",
    api: "openai-completions",
    authHeader: true,
    apiKeyUrl:
      "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    authProfileId: "minimax-plan",
    models: [
      { id: "MiniMax-M2.7", name: "MiniMax M2.7", contextWindow: 256000 },
      { id: "MiniMax-M2.5", name: "MiniMax M2.5", contextWindow: 196608 },
      {
        id: "MiniMax-M2.5-Highspeed",
        name: "MiniMax M2.5 Highspeed",
        contextWindow: 196608,
      },
      {
        id: "MiniMax-M2.5-Lightning",
        name: "MiniMax M2.5 Lightning",
        contextWindow: 196608,
      },
      { id: "MiniMax-M2.1", name: "MiniMax M2.1", contextWindow: 256000 },
      {
        id: "MiniMax-M2.1-Lightning",
        name: "MiniMax M2.1 Lightning",
        contextWindow: 256000,
      },
      { id: "MiniMax-M2", name: "MiniMax M2", contextWindow: 256000 },
    ],
  },
  {
    vendorId: "zai-coding",
    familyId: "zai",
    label: "智谱 AI（GLM国内-Coding Plan）",
    shortLabel: "智谱",
    icon: "Z",
    modeId: "coding-plan",
    openclawProviderId: "zai-coding",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    api: "openai-completions",
    apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    authProfileId: "zai-coding",
    models: [
      { id: "glm-5-turbo", name: "GLM-5-Turbo", contextWindow: 204800 },
      { id: "glm-5", name: "GLM-5", contextWindow: 204800 },
      { id: "glm-4.7", name: "GLM-4.7", contextWindow: 204800 },
      { id: "glm-4.6", name: "GLM-4.6", contextWindow: 204800 },
      { id: "glm-4.5-air", name: "GLM-4.5-Air", contextWindow: 204800 },
      { id: "glm-4.5", name: "GLM-4.5", contextWindow: 204800 },
    ],
  },
  {
    vendorId: "volcengine-plan",
    familyId: "volcengine",
    label: "方舟（火山引擎）Coding Plan",
    shortLabel: "方舟",
    icon: "VC",
    modeId: "coding-plan",
    openclawProviderId: "volcengine-plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKeyUrl: "https://console.volcengine.com/ark/",
    authProfileId: "volcengine-plan",
    models: [
      {
        id: "doubao-seed-2-code",
        name: "Doubao Seed 2.0 Code",
        contextWindow: 256000,
      },
      {
        id: "doubao-seed-2-pro",
        name: "Doubao Seed 2.0 Pro",
        contextWindow: 256000,
      },
      { id: "ark-code-latest", name: "ARK Code Latest", contextWindow: 256000 },
      { id: "doubao-seed-code", name: "Doubao Seed Code", contextWindow: 256000 },
      { id: "glm-4.7", name: "GLM-4.7", contextWindow: 200000 },
      { id: "deepseek-v3.2", name: "DeepSeek V3.2", contextWindow: 256000 },
      {
        id: "kimi-k2-thinking",
        name: "Kimi K2 Thinking",
        contextWindow: 256000,
      },
      { id: "kimi-k2.5", name: "Kimi K2.5", contextWindow: 256000 },
    ],
  },
  {
    vendorId: "kimi-coding",
    familyId: "moonshot",
    label: "Kimi Coding Plan",
    shortLabel: "Kimi",
    icon: "Ki",
    modeId: "coding-plan",
    openclawProviderId: "kimi-coding",
    baseUrl: "https://api.kimi.com/coding/v1",
    api: "anthropic-messages",
    apiKeyUrl: "https://platform.moonshot.cn/",
    authProfileId: "kimi-coding",
    models: [{ id: "kimi-k2.5", name: "Kimi-K2.5", contextWindow: 262144 }],
  },
];

export const VENDOR_DEFAULTS: VendorDefault[] = [
  ...modelApiVendors,
  ...codingPlanVendors,
];

export const ALL_VENDOR_DEFAULTS = VENDOR_DEFAULTS;
export const MODEL_API_VENDOR_DEFAULTS = modelApiVendors;
export const CODING_PLAN_VENDOR_DEFAULTS = codingPlanVendors;

export const VENDOR_DEFAULTS_BY_ID = new Map(
  VENDOR_DEFAULTS.map((vendor) => [vendor.vendorId, vendor]),
);

export const VENDOR_DEFAULTS_BY_OPENCLAW_PROVIDER_ID = new Map(
  VENDOR_DEFAULTS.map((vendor) => [vendor.openclawProviderId, vendor]),
);

export const MANAGED_OPENCLAW_PROVIDER_IDS = VENDOR_DEFAULTS.map(
  (vendor) => vendor.openclawProviderId,
);

export function cloneModels(models: VendorModel[]): VendorModel[] {
  return models.map((model) => ({ ...model }));
}

export function cloneVendorConfig(
  vendor: VendorDefault,
  apiKeyConfigured = false,
): VendorConfig {
  return {
    vendorId: vendor.vendorId,
    label: vendor.label,
    icon: vendor.icon,
    openclawProviderId: vendor.openclawProviderId,
    baseUrl: vendor.baseUrl,
    api: vendor.api,
    authHeader: vendor.authHeader,
    apiKeyUrl: vendor.apiKeyUrl,
    authProfileId: vendor.authProfileId,
    apiKeyConfigured,
    models: cloneModels(vendor.models),
  };
}

export function getVendorsForMode(modeId: Exclude<ModelModeId, "default">): VendorDefault[] {
  return VENDOR_DEFAULTS.filter((vendor) => vendor.modeId === modeId);
}

export function getVendorDefault(vendorId: string): VendorDefault | undefined {
  return VENDOR_DEFAULTS_BY_ID.get(vendorId);
}

export function getVendorByOpenClawProviderId(
  providerId: string,
): VendorDefault | undefined {
  return VENDOR_DEFAULTS_BY_OPENCLAW_PROVIDER_ID.get(providerId);
}

export function findVendorDefaultByOpenClawProvider(
  modeId: Exclude<ModelModeId, "default">,
  providerId: string,
): VendorDefault | undefined {
  return VENDOR_DEFAULTS.find(
    (vendor) =>
      vendor.modeId === modeId && vendor.openclawProviderId === providerId,
  );
}

export function createDefaultModeConfig(
  modeId: Exclude<ModelModeId, "default">,
): ModeConfig {
  return {
    selectedModel: null,
    vendors: getVendorsForMode(modeId).map((vendor) => cloneVendorConfig(vendor)),
  };
}

export function createDefaultAppModelConfig(
  activeMode: Exclude<ModelModeId, "default"> = "model-api",
): AppModelConfig {
  return {
    version: 1,
    activeMode,
    modes: {
      default: { enabled: false },
      "model-api": createDefaultModeConfig("model-api"),
      "coding-plan": createDefaultModeConfig("coding-plan"),
    },
  };
}

export function getVendorModeId(
  vendorId: string,
): Exclude<ModelModeId, "default"> | null {
  const vendor = getVendorDefault(vendorId);
  return vendor?.modeId ?? null;
}

export function getProviderLabel(providerId: string): string {
  return getVendorDefault(providerId)?.label || providerId;
}

export function getProviderIcon(providerId: string): string {
  return getVendorDefault(providerId)?.icon || "AI";
}

export function getApiKeyUrl(providerId: string): string | undefined {
  return getVendorDefault(providerId)?.apiKeyUrl;
}

export function getProviderModels(providerId: string): VendorModel[] {
  return cloneModels(getVendorDefault(providerId)?.models ?? []);
}
