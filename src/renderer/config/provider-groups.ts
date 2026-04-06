import {
  CODING_PLAN_VENDOR_DEFAULTS,
  MODEL_API_VENDOR_DEFAULTS,
} from "../../shared/constants/vendor-defaults";
import type { ModelModeId } from "../../shared/types/model-config.types";

export interface ProviderDef {
  providerId: string;
  label: string;
  models?: { id: string; name: string; contextWindow?: number }[];
  apiKeyUrl?: string;
  sharesAuthWith?: string;
}

export interface ModelModeConfig {
  modeId: ModelModeId;
  modeName: string;
  description?: string;
  providers: ProviderDef[];
}

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

const MODEL_API_PROVIDERS: ProviderDef[] = MODEL_API_VENDOR_DEFAULTS.map(
  (vendor) => ({
    providerId: vendor.vendorId,
    label: vendor.label,
    models: vendor.models,
    apiKeyUrl: vendor.apiKeyUrl,
  })
);

const CODING_PLAN_PROVIDERS: ProviderDef[] = CODING_PLAN_VENDOR_DEFAULTS.map(
  (vendor) => ({
    providerId: vendor.vendorId,
    label: vendor.label,
    models: vendor.models,
    apiKeyUrl: vendor.apiKeyUrl,
  })
);

export const MODEL_MODE_CONFIGS: ModelModeConfig[] = [
  {
    modeId: "default",
    modeName: "默认大模型",
    description: "使用系统默认模型，无需配置",
    providers: [],
  },
  {
    modeId: "model-api",
    modeName: "自定义大模型—模型API",
    description: "使用自己的 API Key 直连模型厂商",
    providers: MODEL_API_PROVIDERS,
  },
  {
    modeId: "coding-plan",
    modeName: "自定义大模型—Coding Plan",
    description: "通过厂商 Coding Plan 套餐使用模型",
    providers: CODING_PLAN_PROVIDERS,
  },
];

export const PROVIDER_GROUP_DEFINITIONS: ProviderGroupDef[] = (() => {
  const apiMode = new Map(
    MODEL_API_PROVIDERS.map((provider) => [provider.providerId, provider])
  );
  const codingMode = new Map(
    CODING_PLAN_PROVIDERS.map((provider) => [provider.providerId, provider])
  );
  const allIds = new Set<string>([
    ...Array.from(apiMode.keys()),
    ...Array.from(codingMode.keys()),
  ]);

  return Array.from(allIds).map((vendorId) => {
    const apiProvider = apiMode.get(vendorId);
    const codingProvider = codingMode.get(vendorId);
    const seed = apiProvider ?? codingProvider!;
    const members: SubCategoryDef[] = [];

    if (apiProvider) {
      members.push({
        label: "模型 API",
        providerIds: [apiProvider.providerId],
      });
    }
    if (codingProvider) {
      members.push({
        label: "Coding Plan",
        providerIds: [codingProvider.providerId],
      });
    }

    return {
      groupId: vendorId,
      groupName: seed.label.replace(/（.*?）/g, "").replace(/\(.*?\)/g, "").trim(),
      icon: "",
      members,
    };
  });
})();

export function getApiKeyUrl(providerId: string): string | undefined {
  return (
    MODEL_API_PROVIDERS.find((provider) => provider.providerId === providerId)
      ?.apiKeyUrl ??
    CODING_PLAN_PROVIDERS.find((provider) => provider.providerId === providerId)
      ?.apiKeyUrl
  );
}

export function getProviderModels(providerId: string): {
  id: string;
  name: string;
  contextWindow?: number;
}[] {
  return (
    MODEL_API_PROVIDERS.find((provider) => provider.providerId === providerId)
      ?.models ??
    CODING_PLAN_PROVIDERS.find((provider) => provider.providerId === providerId)
      ?.models ??
    []
  );
}

export function buildProviderToGroupIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const group of PROVIDER_GROUP_DEFINITIONS) {
    for (const member of group.members) {
      for (const providerId of member.providerIds) {
        index.set(providerId, group.groupId);
      }
    }
  }
  return index;
}

export type { ModelModeId };
