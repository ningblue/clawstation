// src/backend/config/openclaw-config-manager.ts
/**
 * OpenClaw 配置管理模块
 * 负责管理 OpenClaw 的完整配置，包括 agents、models、gateway 等
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import log from "electron-log";
import { OPENCLAW_PORT, OPENCLAW_BIND_ADDRESS } from "../../shared/constants";

/**
 * Agent 模型配置
 */
export type AgentModelConfig =
  | string
  | {
      /** Primary model (provider/model). */
      primary?: string;
      /** Per-agent model fallbacks (provider/model). */
      fallbacks?: string[];
    };

/**
 * Agent 配置
 */
export interface AgentConfig {
  id: string;
  default?: boolean;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: AgentModelConfig;
  /** Optional allowlist of skills for this agent (omit = all skills; empty = none). */
  skills?: string[];
  /** Human-like delay between block replies for this agent. */
  humanDelay?: {
    minMs?: number;
    maxMs?: number;
  };
  /** Optional per-agent heartbeat overrides. */
  heartbeat?: {
    enabled?: boolean;
    intervalMinutes?: number;
  };
  identity?: {
    name?: string;
    avatar?: string;
  };
}

/**
 * Agents 配置
 */
export interface AgentsConfig {
  defaults?: {
    model?: AgentModelConfig;
    skills?: string[];
    heartbeat?: {
      enabled?: boolean;
      intervalMinutes?: number;
    };
  };
  list?: AgentConfig[];
}

/**
 * Gateway HTTP 端点配置
 */
export interface GatewayHttpEndpointsConfig {
  chatCompletions?: {
    enabled?: boolean;
  };
  responses?: {
    enabled?: boolean;
    maxBodyBytes?: number;
    maxUrlParts?: number;
  };
}

/**
 * Gateway HTTP 配置
 */
export interface GatewayHttpConfig {
  endpoints?: GatewayHttpEndpointsConfig;
}

/**
 * Gateway 认证配置
 */
export interface GatewayAuthConfig {
  mode?: "none" | "token" | "password" | "trusted-proxy";
  token?: string;
  password?: string;
  allowTailscale?: boolean;
}

/**
 * Gateway 控制 UI 配置
 */
export interface GatewayControlUiConfig {
  enabled?: boolean;
  basePath?: string;
  allowedOrigins?: string[];
}

/**
 * Gateway 配置
 */
export interface GatewayConfig {
  mode?: "local" | "remote";
  port?: number;
  bind?: "auto" | "lan" | "loopback" | "custom" | "tailnet";
  customBindHost?: string;
  auth?: GatewayAuthConfig;
  http?: GatewayHttpConfig;
  controlUi?: GatewayControlUiConfig;
}

/**
 * 模型提供商配置
 */
export interface ModelProviderConfig {
  baseUrl: string;
  apiKey?: string;
  auth?: "api-key" | "aws-sdk" | "oauth" | "token";
  models: Array<{
    id: string;
    name: string;
    contextWindow: number;
    maxTokens: number;
  }>;
}

/**
 * 模型配置
 */
export interface ModelsConfig {
  mode?: "merge" | "replace";
  providers?: Record<string, ModelProviderConfig>;
}

/**
 * Auth Profile Reference (OpenClaw 原生格式)
 * 用于 openclaw.json 中的 auth.profiles 部分
 */
export interface AuthProfileReference {
  provider: string;
  mode: "api_key" | "oauth" | "token";
}

export interface AuthConfig {
  profiles?: Record<string, AuthProfileReference>;
}

/**
 * OpenClaw 完整配置
 */
export interface OpenClawConfig {
  meta?: {
    lastTouchedVersion?: string;
    lastTouchedAt?: string;
  };
  gateway?: GatewayConfig;
  auth?: AuthConfig;
  agents?: AgentsConfig;
  models?: ModelsConfig;
  tools?: {
    web?: {
      search?: {
        enabled?: boolean;
        provider?: string;
        apiKey?: string;
        maxResults?: number;
        timeoutSeconds?: number;
        cacheTtlMinutes?: number;
      };
      fetch?: {
        enabled?: boolean;
        maxChars?: number;
      };
    };
  };
}

/**
 * Auth Profile Credential (OpenClaw 原生格式)
 * 与 ~/.openclaw/agents/{agent}/agent/auth-profiles.json 格式兼容
 */
export interface AuthProfileCredential {
  type: "api_key" | "oauth" | "token";
  provider: string;
  key?: string; // api_key 或 oauth 类型使用 (存储 access token)
  baseUrl?: string;
  refreshToken?: string; // oauth 类型使用
  expiresAt?: number; // oauth 类型使用 (unix timestamp)
}

/**
 * Auth Profiles Store (OpenClaw 原生格式)
 * 格式: { version: 1, profiles: { "provider:default": { type, provider, key } } }
 */
export interface AuthProfileStore {
  version?: number;
  profiles: Record<string, AuthProfileCredential>;
  usageStats?: Record<string, { lastUsed?: number; errorCount?: number }>;
}

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
  GATEWAY_PORT: OPENCLAW_PORT,
  BIND_ADDRESS: OPENCLAW_BIND_ADDRESS,
  DEFAULT_AGENT_ID: "default",
  DEFAULT_MODEL: "anthropic/claude-sonnet-4-6",
  DEFAULT_PROVIDER: "anthropic",
  TOKEN_PREFIX: "claw_",
  TOKEN_LENGTH: 32,
} as const;

/**
 * OpenClaw 配置管理器
 */
export class OpenClawConfigManager {
  private readonly log = log.scope("OpenClawConfigManager");
  private readonly configDir: string;
  private readonly configPath: string;
  private config: OpenClawConfig = {};

  constructor(configDir?: string) {
    this.configDir = configDir || path.join(os.homedir(), ".clawstation");
    this.configPath = path.join(this.configDir, "openclaw.json");
    this.log.info(`Config manager initialized with path: ${this.configPath}`);
  }

  /**
   * 获取配置目录路径
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 确保配置目录存在
   */
  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
      this.log.info(`Created config directory: ${this.configDir}`);
    }
  }

  /**
   * 生成安全随机 token
   */
  private generateSecureToken(): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = DEFAULT_CONFIG.TOKEN_PREFIX;
    for (let i = 0; i < DEFAULT_CONFIG.TOKEN_LENGTH; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * 获取当前时间戳（ISO 格式）
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 加载配置
   */
  loadConfig(): OpenClawConfig {
    this.ensureConfigDir();

    if (!fs.existsSync(this.configPath)) {
      this.log.info("Config file not found, creating default config");
      this.config = this.createDefaultConfig();
      this.saveConfig();
      return this.config;
    }

    try {
      const content = fs.readFileSync(this.configPath, "utf8");
      this.config = JSON.parse(content);
      this.log.info("Config loaded successfully");
      return this.config;
    } catch (error) {
      this.log.error("Failed to load config:", error);
      this.config = this.createDefaultConfig();
      this.saveConfig();
      return this.config;
    }
  }

  /**
   * 保存配置
   */
  saveConfig(): void {
    this.ensureConfigDir();

    // 更新元数据
    this.config.meta = {
      ...this.config.meta,
      lastTouchedAt: this.getTimestamp(),
      lastTouchedVersion: "1.0.0",
    };

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      this.log.info("Config saved successfully");
    } catch (error) {
      this.log.error("Failed to save config:", error);
      throw error;
    }
  }

  /**
   * 创建默认配置
   */
  createDefaultConfig(): OpenClawConfig {
    const token = this.generateSecureToken();

    return {
      meta: {
        lastTouchedAt: this.getTimestamp(),
        lastTouchedVersion: "1.0.0",
      },
      gateway: {
        mode: "local",
        port: DEFAULT_CONFIG.GATEWAY_PORT,
        bind: "loopback",
        auth: {
          mode: "token",
          token: token,
        },
        http: {
          endpoints: {
            chatCompletions: {
              enabled: true,
            },
          },
        },
        controlUi: {
          enabled: true,
        },
      },
      agents: {
        defaults: {
          model: DEFAULT_CONFIG.DEFAULT_MODEL,
        },
        list: [
          {
            id: DEFAULT_CONFIG.DEFAULT_AGENT_ID,
            default: true,
            name: "Default Agent",
            model: {
              primary: DEFAULT_CONFIG.DEFAULT_MODEL,
              fallbacks: ["openai/gpt-4o", "google/gemini-pro"],
            },
          },
        ],
      },
      models: {
        mode: "merge",
        providers: {
          anthropic: {
            baseUrl: "https://api.anthropic.com",
            auth: "api-key",
            models: [
              {
                id: "claude-sonnet-4-6",
                name: "Claude Sonnet 4.6",
                contextWindow: 200000,
                maxTokens: 8192,
              },
            ],
          },
          openai: {
            baseUrl: "https://api.openai.com",
            auth: "api-key",
            models: [
              {
                id: "gpt-4o",
                name: "GPT-4o",
                contextWindow: 128000,
                maxTokens: 4096,
              },
            ],
          },
        },
      },
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): OpenClawConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<OpenClawConfig>): void {
    // 深度合并 tools 配置
    const mergedTools = this.deepMerge(this.config.tools, updates.tools);

    this.config = {
      ...this.config,
      ...updates,
      gateway: {
        ...this.config.gateway,
        ...updates.gateway,
      },
      agents: {
        ...this.config.agents,
        ...updates.agents,
      },
      models: {
        ...this.config.models,
        ...updates.models,
      },
      tools: mergedTools,
    };
    this.saveConfig();
  }

  /**
   * 深度合并对象
   */
  private deepMerge(target: any, source: any): any {
    if (!source) return target;
    if (!target) return source;

    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * 获取 Gateway 配置
   */
  getGatewayConfig(): GatewayConfig | undefined {
    return this.config.gateway;
  }

  /**
   * 更新 Gateway 配置
   */
  updateGatewayConfig(config: Partial<GatewayConfig>): void {
    this.config.gateway = {
      ...this.config.gateway,
      ...config,
    };
    this.saveConfig();
  }

  /**
   * 获取 Agents 配置
   */
  getAgentsConfig(): AgentsConfig | undefined {
    return this.config.agents;
  }

  /**
   * 获取默认 Agent
   */
  getDefaultAgent(): AgentConfig | undefined {
    return this.config.agents?.list?.find((agent) => agent.default);
  }

  /**
   * 添加 Agent
   */
  addAgent(agent: AgentConfig): void {
    if (!this.config.agents) {
      this.config.agents = {};
    }
    if (!this.config.agents.list) {
      this.config.agents.list = [];
    }

    // 检查是否已存在
    const existingIndex = this.config.agents.list.findIndex(
      (a) => a.id === agent.id
    );
    if (existingIndex >= 0) {
      this.config.agents.list[existingIndex] = agent;
      this.log.info(`Updated agent: ${agent.id}`);
    } else {
      this.config.agents.list.push(agent);
      this.log.info(`Added agent: ${agent.id}`);
    }

    this.saveConfig();
  }

  /**
   * 删除 Agent
   */
  removeAgent(agentId: string): boolean {
    if (!this.config.agents?.list) {
      return false;
    }

    const initialLength = this.config.agents.list.length;
    this.config.agents.list = this.config.agents.list.filter(
      (a) => a.id !== agentId
    );

    if (this.config.agents.list.length < initialLength) {
      this.log.info(`Removed agent: ${agentId}`);
      this.saveConfig();
      return true;
    }

    return false;
  }

  /**
   * 获取指定 Agent
   */
  getAgent(agentId: string): AgentConfig | undefined {
    return this.config.agents?.list?.find((a) => a.id === agentId);
  }

  /**
   * 更新 Agent 配置
   */
  updateAgent(agentId: string, updates: Partial<AgentConfig>): boolean {
    const agent = this.getAgent(agentId);
    if (!agent) {
      return false;
    }

    Object.assign(agent, updates);
    this.saveConfig();
    this.log.info(`Updated agent: ${agentId}`);
    return true;
  }

  /**
   * 设置默认 Agent
   */
  setDefaultAgent(agentId: string): boolean {
    if (!this.config.agents?.list) {
      return false;
    }

    // 清除其他 agent 的 default 标记
    this.config.agents.list.forEach((agent) => {
      agent.default = agent.id === agentId;
    });

    this.saveConfig();
    this.log.info(`Set default agent: ${agentId}`);
    return true;
  }

  /**
   * 设置默认模型（同时更新 agents.defaults.model 和默认 agent 的模型）
   */
  setDefaultModel(model: AgentModelConfig): void {
    if (!this.config.agents) {
      this.config.agents = {};
    }

    // 更新 agents.defaults.model（OpenClaw 引擎优先使用这个）
    this.config.agents.defaults = {
      ...this.config.agents.defaults,
      model,
    };

    // 同时更新默认 agent 的模型配置
    const defaultAgent = this.getDefaultAgent();
    if (defaultAgent) {
      defaultAgent.model = model;
      this.addAgent(defaultAgent);
    }

    this.saveConfig();
    this.log.info(`Set default model:`, model);
  }

  /**
   * 获取 Gateway Token
   */
  getGatewayToken(): string | undefined {
    return this.config.gateway?.auth?.token;
  }

  /**
   * 重新生成 Gateway Token
   */
  regenerateGatewayToken(): string {
    const newToken = this.generateSecureToken();
    if (!this.config.gateway) {
      this.config.gateway = {};
    }
    if (!this.config.gateway.auth) {
      this.config.gateway.auth = { mode: "token" };
    }
    this.config.gateway.auth.token = newToken;
    this.saveConfig();
    this.log.info("Gateway token regenerated");
    return newToken;
  }

  /**
   * 获取 Agent 目录路径
   */
  getAgentDir(agentId: string): string {
    return path.join(this.configDir, "agents", agentId, "agent");
  }

  /**
   * 确保 Agent 目录存在
   */
  ensureAgentDir(agentId: string): string {
    const agentDir = this.getAgentDir(agentId);
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
      this.log.info(`Created agent directory: ${agentDir}`);
    }
    return agentDir;
  }

  /**
   * 获取 Auth Profiles 路径
   */
  getAuthProfilesPath(agentId: string): string {
    return path.join(this.getAgentDir(agentId), "auth-profiles.json");
  }

  /**
   * 加载 Auth Profiles (OpenClaw 原生格式)
   */
  loadAuthProfiles(agentId: string): AuthProfileStore {
    const authPath = this.getAuthProfilesPath(agentId);

    if (!fs.existsSync(authPath)) {
      this.log.info(
        `Auth profiles not found for agent ${agentId}, creating empty config`
      );
      return { version: 1, profiles: {} };
    }

    try {
      const content = fs.readFileSync(authPath, "utf8");
      const parsed = JSON.parse(content);

      // 兼容旧格式: { profiles: [] } -> { version: 1, profiles: {} }
      if (Array.isArray(parsed.profiles)) {
        const newProfiles: Record<string, AuthProfileCredential> = {};
        for (const p of parsed.profiles) {
          if (p.provider) {
            newProfiles[`${p.provider}:default`] = {
              type: "api_key",
              provider: p.provider,
              key: p.apiKey,
            };
          }
        }
        this.log.info(
          `Migrated auth profiles for agent ${agentId} to new format`
        );
        return { version: 1, profiles: newProfiles };
      }

      return parsed as AuthProfileStore;
    } catch (error) {
      this.log.error(
        `Failed to load auth profiles for agent ${agentId}:`,
        error
      );
      return { version: 1, profiles: {} };
    }
  }

  /**
   * 保存 Auth Profiles (OpenClaw 原生格式)
   */
  saveAuthProfiles(agentId: string, authConfig: AuthProfileStore): void {
    this.ensureAgentDir(agentId);
    const authPath = this.getAuthProfilesPath(agentId);

    try {
      fs.writeFileSync(authPath, JSON.stringify(authConfig, null, 2));
      this.log.info(`Auth profiles saved for agent: ${agentId}`);
    } catch (error) {
      this.log.error(
        `Failed to save auth profiles for agent ${agentId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * 添加或更新 Auth Profile (OpenClaw 原生格式)
   */
  setAuthProfile(
    agentId: string,
    provider: string,
    credential: AuthProfileCredential
  ): void {
    const authConfig = this.loadAuthProfiles(agentId);

    // OpenClaw 格式: profiles["provider:default"] = { type, provider, key }
    const profileId = `${provider}:default`;
    authConfig.profiles[profileId] = credential;

    this.saveAuthProfiles(agentId, authConfig);
    this.log.info(
      `Set auth profile for agent ${agentId}, provider: ${provider}`
    );
  }

  /**
   * 获取指定 Provider 的 Auth Profile (OpenClaw 原生格式)
   */
  getAuthProfile(
    agentId: string,
    provider: string
  ): AuthProfileCredential | undefined {
    const authConfig = this.loadAuthProfiles(agentId);
    const profileId = `${provider}:default`;
    return authConfig.profiles[profileId];
  }

  /**
   * 删除 Auth Profile (OpenClaw 原生格式)
   */
  removeAuthProfile(agentId: string, provider: string): boolean {
    const authConfig = this.loadAuthProfiles(agentId);
    const profileId = `${provider}:default`;

    if (profileId in authConfig.profiles) {
      delete authConfig.profiles[profileId];
      this.saveAuthProfiles(agentId, authConfig);
      this.log.info(
        `Removed auth profile for agent ${agentId}, provider: ${provider}`
      );
      return true;
    }

    return false;
  }

  /**
   * 检查是否存在 Auth Profile
   */
  hasAuthProfile(agentId: string, provider: string): boolean {
    const authConfig = this.loadAuthProfiles(agentId);
    const profileId = `${provider}:default`;
    return profileId in authConfig.profiles;
  }

  /**
   * 设置 API Key (OpenClaw 原生格式)
   * 同时更新:
   * 1. auth-profiles.json - 存储 API Key
   * 2. openclaw.json auth.profiles - 定义 profile 映射
   * 3. openclaw.json models.providers - 定义 provider 配置
   */
  setApiKey(
    agentId: string,
    provider: string,
    apiKey: string,
    endpoint?: string
  ): void {
    // 1. 更新 auth-profiles.json
    this.setAuthProfile(agentId, provider, {
      type: "api_key",
      provider,
      key: apiKey,
    });

    // 2. 更新 openclaw.json auth.profiles
    if (!this.config.auth) {
      this.config.auth = { profiles: {} };
    }
    if (!this.config.auth.profiles) {
      this.config.auth.profiles = {};
    }
    this.config.auth.profiles[`${provider}:default`] = {
      provider,
      mode: "api_key",
    };

    // 3. 更新 openclaw.json models.providers
    if (!this.config.models) {
      this.config.models = { mode: "merge", providers: {} };
    }
    if (!this.config.models.providers) {
      this.config.models.providers = {};
    }

    // 根据 provider 设置默认的 baseUrl 和模型
    const providerConfig = this.getDefaultProviderConfig(provider, endpoint);
    this.config.models.providers[provider] = providerConfig;

    this.saveConfig();
    this.log.info(
      `Set API key for provider: ${provider}, endpoint: ${
        endpoint || "default"
      }`
    );
  }

  /**
   * 获取 Provider 默认配置
   */
  private getDefaultProviderConfig(
    provider: string,
    endpoint?: string
  ): ModelProviderConfig {
    const configs: Record<string, (endpoint?: string) => ModelProviderConfig> =
      {
        zai: (ep) => ({
          baseUrl:
            ep === "coding-cn"
              ? "https://open.bigmodel.cn/api/coding/paas/v4"
              : ep === "coding-global"
              ? "https://api.z.ai/coding/paas/v4"
              : ep === "cn"
              ? "https://open.bigmodel.cn/api/paas/v4"
              : ep === "global"
              ? "https://api.z.ai/v4"
              : "https://open.bigmodel.cn/api/coding/paas/v4", // 默认 coding-cn
          auth: "api-key",
          models: [
            {
              id: "glm-5",
              name: "GLM-5",
              contextWindow: 204800,
              maxTokens: 131072,
            },
            {
              id: "glm-4.7",
              name: "GLM-4.7",
              contextWindow: 204800,
              maxTokens: 131072,
            },
            {
              id: "glm-4.7-flash",
              name: "GLM-4.7 Flash",
              contextWindow: 204800,
              maxTokens: 131072,
            },
            {
              id: "glm-4.7-flashx",
              name: "GLM-4.7 FlashX",
              contextWindow: 204800,
              maxTokens: 131072,
            },
          ],
        }),
        anthropic: () => ({
          baseUrl: "https://api.anthropic.com",
          auth: "api-key",
          models: [
            {
              id: "claude-sonnet-4-6",
              name: "Claude Sonnet 4.6",
              contextWindow: 200000,
              maxTokens: 8192,
            },
          ],
        }),
        openai: () => ({
          baseUrl: "https://api.openai.com",
          auth: "api-key",
          models: [
            {
              id: "gpt-4o",
              name: "GPT-4o",
              contextWindow: 128000,
              maxTokens: 4096,
            },
          ],
        }),
        // MiniMax (国内 API Key 方式)
        minimax: () => ({
          baseUrl: "https://api.minimax.chat/v1",
          api: "openai-completions",
          authHeader: true,
          models: [
            { id: "MiniMax-VL-01", name: "MiniMax VL 01", contextWindow: 200000, maxTokens: 8192, input: ["text", "image"] },
            { id: "MiniMax-M2.5", name: "MiniMax M2.5", contextWindow: 200000, maxTokens: 8192, input: ["text"] },
            { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 Highspeed", contextWindow: 200000, maxTokens: 8192, input: ["text"] },
          ],
        }),
        "minimax-portal": () => ({
          baseUrl: "https://api.minimax.io/anthropic",
          api: "anthropic-messages",
          authHeader: true,
          models: [
            { id: "MiniMax-VL-01", name: "MiniMax VL 01", contextWindow: 200000, maxTokens: 8192, input: ["text", "image"] },
            { id: "MiniMax-M2.5", name: "MiniMax M2.5", contextWindow: 200000, maxTokens: 8192, input: ["text"] },
            { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 Highspeed", contextWindow: 200000, maxTokens: 8192, input: ["text"] },
          ],
        }),
        "minimax-cn": () => ({
          baseUrl: "https://api.minimaxi.com/v1",
          api: "openai-completions",
          authHeader: true,
          models: [
            { id: "MiniMax-VL-01", name: "MiniMax VL 01 (CN)", contextWindow: 200000, maxTokens: 8192, input: ["text", "image"] },
            { id: "MiniMax-M2.5", name: "MiniMax M2.5 (CN)", contextWindow: 200000, maxTokens: 8192, input: ["text"] },
            { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 Highspeed (CN)", contextWindow: 200000, maxTokens: 8192, input: ["text"] },
          ],
        }),
        // Moonshot / Kimi
        moonshot: () => ({
          baseUrl: "https://api.moonshot.cn/v1",
          auth: "api-key",
          models: [
            { id: "kimi-k2.5", name: "Kimi K2.5", contextWindow: 256000, maxTokens: 8192 },
          ],
        }),
        "kimi-coding": () => ({
          baseUrl: "https://api.kimi.com/coding/",
          auth: "api-key",
          models: [
            { id: "k2p5", name: "Kimi for Coding", contextWindow: 262144, maxTokens: 32768 },
          ],
        }),
        // Volcano Engine
        volcengine: () => ({
          baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
          auth: "api-key",
          models: [
            { id: "doubao-pro", name: "Doubao Pro", contextWindow: 128000, maxTokens: 8192 },
          ],
        }),
        "volcengine-plan": () => ({
          baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
          auth: "api-key",
          models: [
            { id: "doubao-pro", name: "Doubao Pro", contextWindow: 128000, maxTokens: 8192 },
          ],
        }),
        // BytePlus
        byteplus: () => ({
          baseUrl: "https://ark.byteplus.com/api/v3",
          auth: "api-key",
          models: [
            { id: "doubao-pro", name: "Doubao Pro", contextWindow: 128000, maxTokens: 8192 },
          ],
        }),
        "byteplus-plan": () => ({
          baseUrl: "https://ark.byteplus.com/api/v3",
          auth: "api-key",
          models: [
            { id: "doubao-pro", name: "Doubao Pro", contextWindow: 128000, maxTokens: 8192 },
          ],
        }),
        // Qwen
        qwen: () => ({
          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          auth: "api-key",
          models: [
            { id: "qwen-max", name: "Qwen Max", contextWindow: 128000, maxTokens: 8192 },
          ],
        }),
        "qwen-portal": () => ({
          baseUrl: "https://portal.qwen.ai/v1",
          auth: "api-key",
          models: [
            { id: "coder-model", name: "Qwen Coder", contextWindow: 128000, maxTokens: 8192 },
          ],
        }),
        // Bailian Coding Plan (阿里云 Coding Plan) - 使用 bailian 作为 provider 名称
        "bailian": () => ({
          baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
          api: "openai-completions",
          auth: "api-key",
          models: [
            { id: "qwen3.5-plus", name: "Qwen 3.5 Plus", contextWindow: 1000000, maxTokens: 65536 },
            { id: "qwen3-max-2026-01-23", name: "Qwen 3 Max", contextWindow: 262144, maxTokens: 65536 },
            { id: "qwen3-coder-next", name: "Qwen 3 Coder Next", contextWindow: 262144, maxTokens: 65536 },
            { id: "qwen3-coder-plus", name: "Qwen 3 Coder Plus", contextWindow: 1000000, maxTokens: 65536 },
            { id: "MiniMax-M2.5", name: "MiniMax M2.5", contextWindow: 196608, maxTokens: 32768 },
            { id: "glm-5", name: "GLM 5", contextWindow: 202752, maxTokens: 16384 },
            { id: "glm-4.7", name: "GLM 4.7", contextWindow: 202752, maxTokens: 16384 },
            { id: "kimi-k2.5", name: "Kimi K2.5", contextWindow: 262144, maxTokens: 32768 },
          ],
        }),
      };

    const configFn = configs[provider];
    if (configFn) {
      return configFn(endpoint);
    }

    // 默认配置 - 提供一个有效的 baseUrl 避免验证失败
    return {
      baseUrl: "https://api.example.com",
      auth: "api-key",
      models: [],
    };
  }

  /**
   * 获取 API Key (OpenClaw 原生格式)
   */
  getApiKey(agentId: string, provider: string): string | undefined {
    return this.getAuthProfile(agentId, provider)?.key;
  }

  /**
   * 获取所有配置的模型
   */
  getModels(): Array<{
    provider: string;
    id: string;
    name: string;
    contextWindow?: number;
    maxTokens?: number;
  }> {
    const models: Array<{
      provider: string;
      id: string;
      name: string;
      contextWindow?: number;
      maxTokens?: number;
    }> = [];
    const providers = this.config.models?.providers;

    if (providers) {
      for (const [providerName, providerConfig] of Object.entries(providers)) {
        if (providerConfig.models) {
          for (const model of providerConfig.models) {
            models.push({
              provider: providerName,
              id: model.id,
              name: model.name || model.id,
              contextWindow: model.contextWindow,
              maxTokens: model.maxTokens,
            });
          }
        }
      }
    }

    return models;
  }

  /**
   * 获取所有提供商配置
   */
  getProviderConfigs(): Record<
    string,
    { baseUrl?: string; api?: string; models?: any[] }
  > {
    return this.config.models?.providers || {};
  }

  /**
   * 获取已配置的（已有 API Key）提供商列表
   */
  getConfiguredProviders(agentId: string): string[] {
    const authConfig = this.loadAuthProfiles(agentId);
    return Object.values(authConfig.profiles).map((p) => p.provider);
  }

  /**
   * 获取 Auth Profiles 列表
   */
  getAuthProfiles(
    agentId: string
  ): Array<{ provider: string; hasKey: boolean }> {
    const authConfig = this.loadAuthProfiles(agentId);
    return Object.values(authConfig.profiles).map((p) => ({
      provider: p.provider,
      hasKey: !!p.key,
    }));
  }

  /**
   * 验证配置是否完整
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查 Gateway 配置
    if (!this.config.gateway) {
      errors.push("Missing gateway configuration");
    } else {
      if (!this.config.gateway.port) {
        errors.push("Missing gateway port");
      }
      if (
        !this.config.gateway.auth?.token &&
        this.config.gateway.auth?.mode === "token"
      ) {
        errors.push("Missing gateway auth token");
      }
    }

    // 检查 Agents 配置
    if (!this.config.agents?.list || this.config.agents.list.length === 0) {
      errors.push("No agents configured");
    } else {
      const defaultAgent = this.config.agents.list.find((a) => a.default);
      if (!defaultAgent) {
        errors.push("No default agent configured");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 初始化完整配置（包括默认 agent 和 auth profiles）
   */
  initializeConfig(): void {
    this.log.info("Initializing OpenClaw configuration...");

    // 加载或创建主配置
    this.loadConfig();

    // 确保默认 agent 存在
    const defaultAgent = this.getDefaultAgent();
    if (!defaultAgent) {
      this.addAgent({
        id: DEFAULT_CONFIG.DEFAULT_AGENT_ID,
        default: true,
        name: "Default Agent",
        model: {
          primary: DEFAULT_CONFIG.DEFAULT_MODEL,
          fallbacks: ["openai/gpt-4o"],
        },
      });
    }

    // 确保默认 agent 目录存在
    const agentDir = this.ensureAgentDir(DEFAULT_CONFIG.DEFAULT_AGENT_ID);

    // 确保 auth-profiles.json 存在 (OpenClaw 原生格式)
    if (
      !fs.existsSync(this.getAuthProfilesPath(DEFAULT_CONFIG.DEFAULT_AGENT_ID))
    ) {
      this.saveAuthProfiles(DEFAULT_CONFIG.DEFAULT_AGENT_ID, {
        version: 1,
        profiles: {},
      });
    }

    // 确保 system.md 存在
    const systemMdPath = path.join(agentDir, "system.md");
    if (!fs.existsSync(systemMdPath)) {
      const defaultSystemPrompt = `# Default Agent System Prompt

You are a helpful AI assistant running within XClaw.
Your primary goal is to assist the user with their tasks effectively and safely.

## Capabilities
- You can answer questions and help with various tasks.
- You have access to a set of tools to perform actions.

## Guidelines
- Be concise and clear in your responses.
- If you are unsure about something, admit it.
- Always prioritize user safety and privacy.
`;
      fs.writeFileSync(systemMdPath, defaultSystemPrompt);
      this.log.info(`Created default system prompt at ${systemMdPath}`);
    }

    // 确保 models.json 存在
    const modelsJsonPath = path.join(agentDir, "models.json");
    if (!fs.existsSync(modelsJsonPath)) {
      const defaultModels = {
        models: [
          {
            id: DEFAULT_CONFIG.DEFAULT_MODEL,
            provider: "anthropic",
            enabled: true,
          },
        ],
      };
      fs.writeFileSync(modelsJsonPath, JSON.stringify(defaultModels, null, 2));
      this.log.info(`Created default models config at ${modelsJsonPath}`);
    }

    this.log.info("OpenClaw configuration initialized");
  }

  /**
   * 导出配置（用于备份）
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 导入配置
   */
  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      this.config = importedConfig;
      this.saveConfig();
      this.log.info("Config imported successfully");
    } catch (error) {
      this.log.error("Failed to import config:", error);
      throw new Error("Invalid config JSON");
    }
  }
}

// 导出单例实例
let configManagerInstance: OpenClawConfigManager | null = null;

/**
 * 获取配置管理器实例（单例）
 */
export function getOpenClawConfigManager(
  configDir?: string
): OpenClawConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new OpenClawConfigManager(configDir);
  }
  return configManagerInstance;
}

/**
 * 重置配置管理器实例（主要用于测试）
 */
export function resetOpenClawConfigManager(): void {
  configManagerInstance = null;
}

export default OpenClawConfigManager;
