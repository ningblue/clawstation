import type {
  AppModelConfig,
  AppModelCurrentSelection,
  ModelModeId,
  VendorConfig,
  VendorModel,
} from "../../shared/types/model-config.types";

/**
 * 模型选择器类型定义
 */

// 服务商配置
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl?: string;
  auth?: "api-key" | "oauth" | "aws-sdk";
  enabled?: boolean;
  icon?: string;
  description?: string;
}

// 模型配置
export interface ModelConfig {
  id: string;
  provider: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  capabilities?: {
    vision?: boolean;
    tools?: boolean;
    reasoning?: boolean;
  };
}

// 用户模型选择状态
export interface UserModelSelection {
  provider: string;
  model: string;
  modeId?: Exclude<ModelModeId, "default">;
  lastUsed?: string;
}

// 服务商模型组
export interface ProviderModelGroup {
  provider: string;
  providerName: string;
  icon?: string;
  modeId?: Exclude<ModelModeId, "default">;
  models: ModelConfig[];
  hasApiKey: boolean;
}

// 供应商分组（三栏层级选择器用）
export interface SubCategory {
  /** 子分类唯一标识（groupId/index，用于 UI 选中状态） */
  id: string;
  modeId: Exclude<ModelModeId, "default">;
  /** 实际 OpenClaw provider ID（用于模型匹配和 API Key 操作） */
  providerId: string;
  /** 子分类显示名(如"通用"、"编程计划") */
  label: string;
  /** 此子分类下的模型列表 */
  models: ModelConfig[];
  /** 此子分类是否已配置 API Key */
  hasApiKey: boolean;
}

export interface ProviderGroup {
  /** 分组唯一标识 */
  groupId: string;
  /** 分组显示名称 */
  groupName: string;
  /** 图标缩写 */
  icon: string;
  /** 子分类列表 */
  subCategories: SubCategory[];
  /** 任一子分类已配置 */
  hasAnyApiKey: boolean;
  /** 是否有多个子分类（用于决定是否显示中栏） */
  hasMultipleSubCategories: boolean;
}

// 模型选择器状态
export interface ModelSelectorState {
  models: ModelConfig[];
  providers: ProviderConfig[];
  authProfiles: Array<{ provider: string; hasKey: boolean }>;
  currentSelection: UserModelSelection | null;
  loading: boolean;
  error: string | null;
}

export type {
  AppModelConfig,
  AppModelCurrentSelection,
  ModelModeId,
  VendorConfig,
  VendorModel,
};

// API响应类型
export interface ModelsListResponse {
  success: boolean;
  models?: ModelConfig[];
  error?: string;
}

export interface ProvidersListResponse {
  success: boolean;
  providers?: Record<
    string,
    { baseUrl?: string; api?: string; models?: any[] }
  >;
  error?: string;
}

export interface AuthProfilesResponse {
  success: boolean;
  profiles?: Array<{ provider: string; hasKey: boolean }>;
  error?: string;
}
