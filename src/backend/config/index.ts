// src/backend/config/index.ts
/**
 * OpenClaw 配置管理模块统一导出
 */

export {
  OpenClawConfigManager,
  getOpenClawConfigManager,
  resetOpenClawConfigManager,
  DEFAULT_CONFIG,
} from './openclaw-config-manager';

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
  AuthProfile,
  AuthProfilesConfig,
} from './openclaw-config-manager';
