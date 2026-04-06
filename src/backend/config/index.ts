// src/backend/config/index.ts
/**
 * OpenClaw 配置管理模块统一导出
 */

export {
  AppModelConfigManager,
} from "./app-model-config";

export {
  OpenClawConfigManager,
  getOpenClawConfigManager,
  resetOpenClawConfigManager,
  DEFAULT_CONFIG,
} from "./openclaw-config-manager";

export type {
  OpenClawConfig,
  AgentConfig,
  AgentsConfig,
  AgentModelConfig,
  GatewayConfig,
  GatewayAuthConfig,
  GatewayHttpConfig,
  GatewayHttpEndpointsConfig,
  GatewayControlUiConfig,
  ModelsConfig,
  ModelProviderConfig,
  AuthProfileCredential,
  AuthProfileStore,
} from "./openclaw-config-manager";
