/**
 * 模型选择器类型定义
 */

// 服务商配置
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl?: string;
  auth?: 'api-key' | 'oauth' | 'aws-sdk';
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
  lastUsed?: string;
}

// 服务商模型组
export interface ProviderModelGroup {
  provider: string;
  providerName: string;
  models: ModelConfig[];
  hasApiKey: boolean;
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

// API响应类型
export interface ModelsListResponse {
  success: boolean;
  models?: ModelConfig[];
  error?: string;
}

export interface ProvidersListResponse {
  success: boolean;
  providers?: Record<string, { baseUrl?: string; api?: string; models?: any[] }>;
  error?: string;
}

export interface AuthProfilesResponse {
  success: boolean;
  profiles?: Array<{ provider: string; hasKey: boolean }>;
  error?: string;
}
