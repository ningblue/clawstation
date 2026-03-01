// src/backend/services/openclaw.service.ts
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { getOpenClawConfigManager, OpenClawConfigManager } from '../config/openclaw-config-manager';
import { modelCatalogService } from './model-catalog.service';

/**
 * OpenClaw 引擎状态接口
 */
export interface OpenClawStatus {
  isRunning: boolean;
  isHealthy: boolean;
  pid?: number;
  uptime?: number;
  version?: string;
  error?: string;
  port: number;
  bindAddress: string;
  agents?: Array<{ id: string; name?: string; default?: boolean }>;
  models?: Array<{ id: string; name: string }>;
}

/**
 * OpenClaw 服务配置接口
 */
export interface OpenClawServiceConfig {
  port: number;
  bindAddress: string;
  logLevel: string;
  maxRestarts: number;
  restartDelayMs: number;
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
  startupTimeoutMs: number;
}

/**
 * OpenClaw 查询请求接口
 */
export interface OpenClawQueryRequest {
  message: string;
  conversationId?: number;
  model?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * OpenClaw 查询响应接口
 */
export interface OpenClawQueryResponse {
  content: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * OpenClaw 进程事件
 */
export enum OpenClawProcessEvent {
  STARTED = 'started',
  STOPPED = 'stopped',
  ERROR = 'error',
  HEALTH_CHECK_FAILED = 'health_check_failed',
  RESTARTING = 'restarting',
  OUTPUT = 'output',
  STDERR = 'stderr'
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: OpenClawServiceConfig = {
  port: 18791, // 使用不同端口，避免与本地 OpenClaw (18790) 冲突
  bindAddress: '127.0.0.1',
  logLevel: 'info',
  maxRestarts: 3,
  restartDelayMs: 5000,
  healthCheckIntervalMs: 30000,
  healthCheckTimeoutMs: 5000,
  startupTimeoutMs: 30000
};

/**
 * OpenClaw 管理器类
 * 负责管理 OpenClaw AI 引擎的子进程生命周期
 */
export class OpenClawManager extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private readonly log = log.scope('OpenClawManager');
  private startTime: number = 0;
  private restartCount: number = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private config: OpenClawServiceConfig;
  private isShuttingDown: boolean = false;
  private openclawPath: string | null = null;
  private configManager: OpenClawConfigManager;

  constructor(config: Partial<OpenClawServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.configManager = getOpenClawConfigManager();
  }

  /**
   * 获取当前服务配置
   */
  getConfig(): OpenClawServiceConfig {
    return { ...this.config };
  }

  /**
   * 更新服务配置
   */
  updateConfig(config: Partial<OpenClawServiceConfig>): void {
    this.config = { ...this.config, ...config };
    this.log.info('OpenClaw service configuration updated:', this.config);
  }

  /**
   * 获取配置管理器
   */
  getConfigManager(): OpenClawConfigManager {
    return this.configManager;
  }

  /**
   * 初始化配置
   */
  async initializeConfig(): Promise<void> {
    this.log.info('Initializing OpenClaw configuration...');
    this.configManager.initializeConfig();

    // 同步配置管理器的端口设置
    const gatewayConfig = this.configManager.getGatewayConfig();
    if (gatewayConfig?.port) {
      this.config.port = gatewayConfig.port;
    }

    this.log.info('OpenClaw configuration initialized');
  }

  /**
   * 启动 OpenClaw 引擎
   */
  async start(): Promise<void> {
    if (this.childProcess) {
      this.log.warn('OpenClaw is already running');
      return;
    }

    this.isShuttingDown = false;

    try {
      // 解析 OpenClaw 路径
      this.openclawPath = await this.resolveOpenClawPath();
      this.log.info(`Using OpenClaw at: ${this.openclawPath}`);

      // 确保端口可用
      await this.ensurePortAvailable();

      // 启动进程
      await this.spawnProcess();

      // 等待服务就绪
      await this.waitForStartup();

      // 启动健康检查
      this.startHealthCheck();

      this.startTime = Date.now();
      this.restartCount = 0;

      // 确保 childProcess 已经在 spawnProcess 中被初始化且不为 null
      if (!this.childProcess) {
        throw new Error('OpenClaw process initialization failed');
      }

      // 使用类型断言确保 TypeScript 理解 childProcess 不为 null
      const childProcess = this.childProcess as ChildProcess;

      this.emit(OpenClawProcessEvent.STARTED, {
        pid: childProcess.pid,
        port: this.config.port,
        timestamp: new Date()
      });

      this.log.info(`OpenClaw started successfully on port ${this.config.port}`);
    } catch (error: any) {
      // 检查是否是跳过启动的特殊错误
      if (error?.message === 'SKIP_INTERNAL_OPENCLAW') {
        this.log.warn('External OpenClaw detected on same port, using external instance');
        // 标记为正在运行（使用外部实例）
        this.childProcess = {} as ChildProcess;
        this.startTime = Date.now();
        this.emit(OpenClawProcessEvent.STARTED, {
          pid: 0,
          port: this.config.port,
          timestamp: new Date(),
          external: true
        });
        return;
      }
      this.log.error('Failed to start OpenClaw:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * 停止 OpenClaw 引擎
   */
  stop(): void {
    if (!this.childProcess) {
      this.log.warn('OpenClaw is not running');
      return;
    }

    this.isShuttingDown = true;
    this.log.info('Stopping OpenClaw process...');

    // 停止健康检查
    this.stopHealthCheck();

    // 尝试优雅关闭
    this.gracefulShutdown();
  }

  /**
   * 强制停止 OpenClaw 引擎
   */
  forceStop(): void {
    if (!this.childProcess) {
      return;
    }

    this.isShuttingDown = true;
    this.log.info('Force stopping OpenClaw process...');

    this.stopHealthCheck();

    // 强制终止
    this.childProcess.kill('SIGKILL');
    this.cleanup();
  }

  /**
   * 重启 OpenClaw 引擎
   */
  async restart(): Promise<void> {
    this.log.info('Restarting OpenClaw engine...');
    this.stop();
    // 等待1秒确保进程完全终止
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.start();
    this.log.info('OpenClaw engine restarted successfully');
  }

  /**
   * 检查 OpenClaw 是否正在运行（内部或外部）
   */
  isRunning(): boolean {
    // 检查是否是外部实例标记
    if (this.childProcess && (this.childProcess as any).external) {
      return true;
    }
    return this.childProcess !== null && this.childProcess.exitCode === null;
  }

  /**
   * 获取 OpenClaw 引擎状态
   */
  async getStatus(): Promise<OpenClawStatus> {
    const isRunning = this.isRunning();

    // 获取 agents 列表
    const agentsConfig = this.configManager.getAgentsConfig();
    const agents = agentsConfig?.list?.map(agent => ({
      id: agent.id,
      name: agent.name,
      default: agent.default
    })) || [];

    if (!isRunning) {
      return {
        isRunning: false,
        isHealthy: false,
        port: this.config.port,
        bindAddress: this.config.bindAddress,
        error: 'OpenClaw engine is not running',
        agents
      };
    }

    try {
      const isHealthy = await this.performHealthCheck();
      let version: string | undefined;
      let models: Array<{ id: string; name: string }> = [];

      if (isHealthy) {
        try {
          const response = await fetch(
            `http://${this.config.bindAddress}:${this.config.port}/health`,
            { signal: AbortSignal.timeout(this.config.healthCheckTimeoutMs) }
          );
          const data = await response.json();
          version = data.version;
        } catch {
          // 忽略版本获取错误
        }

        // 尝试获取模型列表
        try {
          models = await this.getModels();
        } catch {
          // 忽略模型获取错误
        }
      }

      return {
        isRunning: true,
        isHealthy,
        pid: this.childProcess?.pid,
        uptime: this.startTime ? Date.now() - this.startTime : 0,
        version,
        port: this.config.port,
        bindAddress: this.config.bindAddress,
        error: isHealthy ? undefined : 'Health check failed',
        agents,
        models
      };
    } catch (error) {
      this.log.warn('Status check failed:', error);
      return {
        isRunning: true,
        isHealthy: false,
        pid: this.childProcess?.pid,
        uptime: this.startTime ? Date.now() - this.startTime : 0,
        port: this.config.port,
        bindAddress: this.config.bindAddress,
        error: 'Status check failed: ' + (error as Error).message,
        agents
      };
    }
  }

  /**
   * 发送查询到 OpenClaw 引擎
   */
  async sendQuery(request: OpenClawQueryRequest): Promise<OpenClawQueryResponse> {
    if (!this.isRunning()) {
      throw new Error('OpenClaw engine is not running');
    }

    const health = await this.performHealthCheck();
    if (!health) {
      throw new Error('OpenClaw engine is not healthy');
    }

    try {
      // 如果没有token，尝试从配置文件读取
      if (!this.gatewayToken) {
        await this.loadTokenFromConfig();
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 添加认证token
      if (this.gatewayToken) {
        headers['Authorization'] = `Bearer ${this.gatewayToken}`;
      }

      const response = await fetch(
        `http://${this.config.bindAddress}:${this.config.port}/v1/chat/completions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: request.model || 'default',
            messages: [
              { role: 'user', content: request.message }
            ],
            stream: request.stream ?? false,
            temperature: request.temperature,
            max_tokens: request.maxTokens
          }),
          signal: AbortSignal.timeout(60000) // 60秒超时
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenClaw request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        content,
        model: data.model,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };
    } catch (error) {
      this.log.error('Failed to send query to OpenClaw:', error);
      throw error;
    }
  }

  /**
   * 从配置管理器加载 token
   */
  private async loadTokenFromConfig(): Promise<void> {
    try {
      this.gatewayToken = this.configManager.getGatewayToken() || null;
    } catch (error) {
      this.log.warn('Failed to load token from config:', error);
    }
  }

  /**
   * 流式发送查询到 OpenClaw 引擎
   */
  async *sendQueryStream(request: OpenClawQueryRequest): AsyncGenerator<string, void, unknown> {
    if (!this.isRunning()) {
      throw new Error('OpenClaw engine is not running');
    }

    const health = await this.performHealthCheck();
    if (!health) {
      throw new Error('OpenClaw engine is not healthy');
    }

    try {
      // 如果没有token，尝试从配置文件读取
      if (!this.gatewayToken) {
        await this.loadTokenFromConfig();
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 添加认证token
      if (this.gatewayToken) {
        headers['Authorization'] = `Bearer ${this.gatewayToken}`;
      }

      const response = await fetch(
        `http://${this.config.bindAddress}:${this.config.port}/v1/chat/completions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: request.model || 'default',
            messages: [
              { role: 'user', content: request.message }
            ],
            stream: true,
            temperature: request.temperature,
            max_tokens: request.maxTokens
          }),
          signal: AbortSignal.timeout(120000) // 120秒超时
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenClaw request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      this.log.error('Failed to send streaming query to OpenClaw:', error);
      throw error;
    }
  }

  /**
   * 获取 OpenClaw 可用模型列表
   * 使用 ModelCatalogService 直接从文件系统读取，不依赖 HTTP API
   */
  async getModels(): Promise<Array<{ id: string; name: string; provider?: string }>> {
    try {
      const catalog = await modelCatalogService.loadModelCatalog();
      return catalog.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
      }));
    } catch (error) {
      this.log.error('Failed to get models from catalog:', error);
      return [];
    }
  }

  /**
   * 设置 API Key
   * 保存到 main agent（OpenClaw 实际使用的）和 default agent
   */
  setApiKey(provider: string, apiKey: string, agentId?: string): void {
    // 保存到 main agent（OpenClaw 实际使用的）
    this.configManager.setApiKey('main', provider, apiKey);
    // 也保存到 default agent（前端使用的）
    this.configManager.setApiKey('default', provider, apiKey);
    this.log.info(`API key set for provider: ${provider}, agents: main, default`);
  }

  /**
   * 获取 API Key
   */
  getApiKey(provider: string, agentId?: string): string | undefined {
    const targetAgentId = agentId || this.configManager.getDefaultAgent()?.id || 'default';
    return this.configManager.getApiKey(targetAgentId, provider);
  }

  /**
   * 检查是否配置了指定 provider 的 API Key
   */
  hasApiKey(provider: string, agentId?: string): boolean {
    const targetAgentId = agentId || this.configManager.getDefaultAgent()?.id || 'default';
    const apiKey = this.configManager.getApiKey(targetAgentId, provider);
    return !!apiKey && apiKey.length > 0;
  }

  /**
   * 获取所有已配置的 API Keys 信息（不包含敏感值）
   */
  getConfiguredProviders(agentId?: string): Array<{ provider: string; configured: boolean }> {
    const targetAgentId = agentId || this.configManager.getDefaultAgent()?.id || 'default';
    const authProfiles = this.configManager.loadAuthProfiles(targetAgentId);

    return authProfiles.profiles.map(p => ({
      provider: p.provider,
      configured: !!p.apiKey && p.apiKey.length > 0
    }));
  }

  /**
   * 获取所有可用的模型列表（从配置文件）
   */
  getModelsFromConfig(): Array<{ provider: string; id: string; name: string; contextWindow?: number; maxTokens?: number }> {
    return this.configManager.getModels();
  }

  /**
   * 获取所有提供商配置
   */
  getProviderConfigs(): Record<string, { baseUrl?: string; api?: string; models?: any[] }> {
    return this.configManager.getProviderConfigs();
  }

  /**
   * 获取 Auth Profiles 列表
   */
  getAuthProfilesFromConfig(agentId?: string): Array<{ provider: string; hasKey: boolean }> {
    const targetAgentId = agentId || this.configManager.getDefaultAgent()?.id || 'default';
    return this.configManager.getAuthProfiles(targetAgentId);
  }

  /**
   * 获取当前模型配置
   * 返回当前使用的服务商和模型信息
   */
  getCurrentModelConfig(): { provider: string; model: string; agentId: string } | null {
    const defaultAgent = this.configManager.getDefaultAgent();
    if (!defaultAgent || !defaultAgent.id) {
      return null;
    }

    const agentId: string = defaultAgent.id;
    let modelConfig = defaultAgent.model;

    // 如果model是字符串格式，直接使用
    if (typeof modelConfig === 'string') {
      const parts = modelConfig.split('/');
      if (parts.length >= 2 && parts[0]) {
        return {
          provider: parts[0],
          model: parts.slice(1).join('/'),
          agentId
        };
      }
    }

    // 如果是对象格式，使用primary
    if (modelConfig && typeof modelConfig === 'object' && modelConfig.primary) {
      const parts = modelConfig.primary.split('/');
      if (parts.length >= 2 && parts[0]) {
        return {
          provider: parts[0],
          model: parts.slice(1).join('/'),
          agentId
        };
      }
    }

    // 如果agent没有model配置，尝试使用agents.defaults
    const agentsConfig = this.configManager.getAgentsConfig();
    if (agentsConfig?.defaults?.model) {
      const defaultModel = agentsConfig.defaults.model;
      if (typeof defaultModel === 'string') {
        const parts = defaultModel.split('/');
        if (parts.length >= 2 && parts[0]) {
          return {
            provider: parts[0],
            model: parts.slice(1).join('/'),
            agentId
          };
        }
      }
    }

    return null;
  }

  /**
   * 验证配置是否完整（包括 API Keys）
   */
  validateConfiguration(): { valid: boolean; errors: string[]; missingApiKeys: string[] } {
    const result = this.configManager.validateConfig();
    const missingApiKeys: string[] = [];

    // 检查默认 agent 的 API key
    const defaultAgent = this.configManager.getDefaultAgent();
    if (defaultAgent) {
      const modelConfig = defaultAgent.model;
      if (typeof modelConfig === 'string') {
        const provider = modelConfig.split('/')[0];
        if (provider && !this.hasApiKey(provider)) {
          missingApiKeys.push(provider);
        }
      } else if (modelConfig?.primary) {
        const provider = modelConfig.primary.split('/')[0];
        if (provider && !this.hasApiKey(provider)) {
          missingApiKeys.push(provider);
        }
      }
    }

    return {
      valid: result.valid && missingApiKeys.length === 0,
      errors: result.errors,
      missingApiKeys
    };
  }

  /**
   * 删除 API Key
   */
  removeApiKey(provider: string, agentId?: string): boolean {
    const targetAgentId = agentId || this.configManager.getDefaultAgent()?.id || 'default';
    return this.configManager.removeAuthProfile(targetAgentId, provider);
  }

  /**
   * 解析 OpenClaw 路径
   */
  private async resolveOpenClawPath(): Promise<string> {
    const possiblePaths: string[] = [];

    // 1. 检查环境变量
    if (process.env.OPENCLAW_PATH) {
      possiblePaths.push(process.env.OPENCLAW_PATH);
    }

    // 2. 生产环境资源目录 - app.asar.unpacked - 使用 dist/index.js
    if (app.isPackaged) {
      const appPath = app.getAppPath();
      const unpackedPath = appPath.replace('app.asar', 'app.asar.unpacked');
      possiblePaths.push(
        path.join(unpackedPath, 'node_modules/openclaw/dist/index.js'),
        path.join(unpackedPath, 'node_modules/openclaw/dist/entry.js')
      );
      // 备用路径
      possiblePaths.push(
        path.join(process.resourcesPath, 'app.asar.unpacked/node_modules/openclaw/dist/index.js'),
        path.join(process.resourcesPath, 'app.asar.unpacked/node_modules/openclaw/dist/entry.js')
      );
    }

    // 3. 开发环境 lib 目录
    possiblePaths.push(
      path.join(__dirname, '../../../../lib/openclaw/dist/index.js'),
      path.join(__dirname, '../../../lib/openclaw/dist/index.js')
    );

    // 4. node_modules
    possiblePaths.push(
      path.join(__dirname, '../../../node_modules/openclaw/dist/index.js'),
      path.join(__dirname, '../../../../node_modules/openclaw/dist/index.js')
    );

    // 5. 全局安装
    possiblePaths.push(
      path.join(os.homedir(), '.npm-global', 'lib', 'node_modules', 'openclaw', 'dist', 'index.js'),
      '/usr/local/lib/node_modules/openclaw/dist/index.js',
      '/usr/lib/node_modules/openclaw/dist/index.js'
    );

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }

    // 尝试使用 which 命令查找
    try {
      const { execSync } = require('child_process');
      const result = execSync('which openclaw', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const whichPath = result.trim();
      if (whichPath && fs.existsSync(whichPath)) {
        return whichPath;
      }
    } catch {
      // 忽略错误
    }

    throw new Error(
      `OpenClaw executable not found. Searched paths:\n${possiblePaths.join('\n')}\n\n` +
      'Please install OpenClaw or set OPENCLAW_PATH environment variable.'
    );
  }

  /**
   * 确保端口可用
   */
  private async ensurePortAvailable(): Promise<void> {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const tester = net.createServer();

      tester.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // 端口被占用，可能是外部的 OpenClaw
          // 不再尝试强制杀死外部进程，直接跳过启动
          // 让用户自己管理外部 OpenClaw
          console.log(`Port ${this.config.port} is in use, likely external OpenClaw. Skipping internal launch.`);
          // 抛出一个特殊的错误，让 start 方法知道不要启动
          const skipError = new Error('SKIP_INTERNAL_OPENCLAW');
          (skipError as any).skipLaunch = true;
          reject(skipError);
        } else {
          reject(err);
        }
      });

      tester.once('listening', () => {
        tester.close(() => resolve());
      });

      tester.listen(this.config.port, this.config.bindAddress);
    });
  }

  /**
   * 确保配置文件存在
   * 使用配置管理器来管理配置
   */
  private async ensureConfigFile(): Promise<void> {
    // 使用配置管理器初始化配置
    this.configManager.loadConfig();

    // 确保默认 agent 存在
    const defaultAgent = this.configManager.getDefaultAgent();
    if (!defaultAgent) {
      this.configManager.addAgent({
        id: 'default',
        default: true,
        name: 'Default Agent',
        model: {
          primary: 'anthropic/claude-sonnet-4-6',
          fallbacks: ['openai/gpt-4o'],
        },
      });
    }

    // 确保默认 agent 目录存在
    this.configManager.ensureAgentDir('default');

    // 同步端口配置
    const gatewayConfig = this.configManager.getGatewayConfig();
    if (gatewayConfig?.port) {
      this.config.port = gatewayConfig.port;
    }

    // 加载 token
    this.gatewayToken = this.configManager.getGatewayToken() || null;

    this.log.info('OpenClaw configuration ensured via ConfigManager');
  }

  private gatewayToken: string | null = null;

  /**
   * 生成安全随机token
   */
  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'claw_';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * 获取网关认证token
   */
  getGatewayToken(): string | null {
    return this.gatewayToken;
  }

  /**
   * 启动子进程
   */
  private async spawnProcess(): Promise<void> {
    if (!this.openclawPath) {
      throw new Error('OpenClaw path not resolved');
    }

    // 确保配置文件存在
    await this.ensureConfigFile();

    // 确定工作目录 - 使用临时目录或用户数据目录，避免使用 asar 内部路径
    let cwd: string;
    if (app.isPackaged) {
      // 使用 app 支持目录作为工作目录（可写）
      cwd = path.join(app.getPath('userData'), 'openclaw-temp');
      // 确保目录存在
      if (!fs.existsSync(cwd)) {
        fs.mkdirSync(cwd, { recursive: true });
      }
    } else {
      cwd = path.dirname(this.openclawPath);
    }

    // 准备环境变量
    // 使用独立的 OPENCLAW_STATE_DIR 指向 ~/.clawstation/
    // 这样内置的 OpenClaw 不会与用户自己安装的 OpenClaw (使用 ~/.openclaw/) 冲突
    const stateDir = path.join(os.homedir(), '.clawstation');
    const env = {
      ...process.env,
      OPENCLAW_MODE: 'embedded',
      // 使用独立的状态目录，避免与用户自己的 OpenClaw 冲突
      OPENCLAW_STATE_DIR: stateDir,
      // 移除可能导致冲突的环境变量设置，改由 CLI 参数控制
      // OPENCLAW_GATEWAY_BIND: this.config.bindAddress,  // 改用 CLI 参数
      OPENCLAW_GATEWAY_PORT: String(this.config.port),
      OPENCLAW_LOG_LEVEL: this.config.logLevel,
      OPENCLAW_HIDE_BANNER: '1', // 隐藏启动 banner
      NODE_NO_WARNINGS: '1',
      // 设置token环境变量作为备选认证方式
      OPENCLAW_GATEWAY_TOKEN: this.gatewayToken || ''
    };

    // 确定启动参数 - OpenClaw 要求 --bind 使用正确的模式
    const args = ['gateway', 'run', '--bind', 'loopback', '--port', String(this.config.port), '--force'];

    // 使用系统 Node.js 启动（避免 Electron sandbox 问题）
    const nodePath = await this.findSystemNode();

    this.log.info(`Spawning OpenClaw with Node.js: ${nodePath}`);
    this.log.info(`Working directory: ${cwd}`);
    this.log.info(`Arguments: ${args.join(' ')}`);

    // 直接使用 openclaw 路径启动，不使用 launcher
    this.childProcess = spawn(nodePath, [this.openclawPath, ...args], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      detached: false
    });

    if (!this.childProcess.pid) {
      throw new Error('Failed to spawn OpenClaw process');
    }

    // 设置进程事件处理
    this.setupProcessHandlers();
  }

  /**
   * 查找系统 Node.js
   */
  private async findSystemNode(): Promise<string> {
    // 优先使用环境变量指定的 Node
    if (process.env.NODE_PATH && fs.existsSync(process.env.NODE_PATH)) {
      return process.env.NODE_PATH;
    }

    // 尝试常见路径
    const possiblePaths = [
      '/usr/local/bin/node',
      '/usr/bin/node',
      '/opt/homebrew/bin/node',
      path.join(os.homedir(), '.nvm', 'current', 'bin', 'node'),
      path.join(os.homedir(), '.local', 'share', 'fnm', 'node-versions', 'installing', 'installation', 'bin', 'node')
    ];

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }

    // 尝试使用 which 命令
    try {
      const { execSync } = require('child_process');
      const result = execSync('which node', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const whichPath = result.trim();
      if (whichPath && fs.existsSync(whichPath)) {
        return whichPath;
      }
    } catch {
      // 忽略错误
    }

    // 回退到 process.execPath（Electron 内置 Node）
    this.log.warn('System Node.js not found, falling back to Electron Node.js');
    return process.execPath;
  }

  /**
   * 设置进程事件处理
   */
  private setupProcessHandlers(): void {
    if (!this.childProcess) return;

    // 标准输出
    this.childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        this.log.info('[OpenClaw]', output);
        this.emit(OpenClawProcessEvent.OUTPUT, output);
      }
    });

    // 标准错误
    this.childProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        this.log.warn('[OpenClaw]', output);
        this.emit(OpenClawProcessEvent.STDERR, output);
      }
    });

    // 进程错误
    this.childProcess.on('error', (error) => {
      this.log.error('OpenClaw process error:', error);
      this.emit(OpenClawProcessEvent.ERROR, error);
    });

    // 进程退出
    this.childProcess.on('close', (code, signal) => {
      this.log.info(`OpenClaw process exited with code ${code}, signal ${signal}`);
      this.childProcess = null;

      if (!this.isShuttingDown) {
        this.emit(OpenClawProcessEvent.STOPPED, { code, signal, unexpected: true });
        this.handleUnexpectedExit(code);
      } else {
        this.emit(OpenClawProcessEvent.STOPPED, { code, signal, unexpected: false });
      }
    });

    this.log.info(`Started OpenClaw process with PID: ${this.childProcess.pid}`);
  }

  /**
   * 等待服务启动
   */
  private async waitForStartup(): Promise<void> {
    const startTime = Date.now();
    const timeout = this.config.startupTimeoutMs;

    while (Date.now() - startTime < timeout) {
      try {
        const isHealthy = await this.performHealthCheck();
        if (isHealthy) {
          return;
        }
      } catch {
        // 继续等待
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`OpenClaw failed to start within ${timeout}ms`);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.healthCheckTimeoutMs);

      const response = await fetch(
        `http://${this.config.bindAddress}:${this.config.port}/health`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 启动健康检查定时器
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      if (!this.isRunning()) {
        return;
      }

      const isHealthy = await this.performHealthCheck();
      if (!isHealthy) {
        this.log.warn('Health check failed');
        this.emit(OpenClawProcessEvent.HEALTH_CHECK_FAILED);

        if (!this.isShuttingDown) {
          this.handleUnexpectedExit(1);
        }
      }
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * 停止健康检查定时器
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * 处理意外退出
   */
  private handleUnexpectedExit(code: number | null): void {
    if (this.isShuttingDown) {
      return;
    }

    this.stopHealthCheck();

    if (this.restartCount < this.config.maxRestarts) {
      this.restartCount++;
      this.log.info(`Attempting to restart OpenClaw (attempt ${this.restartCount}/${this.config.maxRestarts})...`);

      this.emit(OpenClawProcessEvent.RESTARTING, {
        attempt: this.restartCount,
        maxAttempts: this.config.maxRestarts
      });

      setTimeout(() => {
        this.start().catch(error => {
          this.log.error('Failed to restart OpenClaw:', error);
        });
      }, this.config.restartDelayMs);
    } else {
      this.log.error(`OpenClaw has exited unexpectedly ${this.config.maxRestarts} times. Giving up.`);
      this.cleanup();
    }
  }

  /**
   * 优雅关闭
   */
  private gracefulShutdown(): void {
    if (!this.childProcess) return;

    // 首先尝试 SIGTERM
    this.childProcess.kill('SIGTERM');

    // 设置超时强制终止
    setTimeout(() => {
      if (this.childProcess && !this.childProcess.killed) {
        this.log.warn('OpenClaw did not terminate gracefully, forcing...');
        this.childProcess.kill('SIGKILL');
      }
    }, 10000);
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.stopHealthCheck();
    this.childProcess = null;
    this.startTime = 0;
  }
}

// 导出单例实例
let managerInstance: OpenClawManager | null = null;

/**
 * 获取 OpenClaw 管理器实例（单例）
 */
export function getOpenClawManager(config?: Partial<OpenClawServiceConfig>): OpenClawManager {
  if (!managerInstance) {
    managerInstance = new OpenClawManager(config);
  } else if (config) {
    managerInstance.updateConfig(config);
  }
  return managerInstance;
}

/**
 * 重置 OpenClaw 管理器实例（主要用于测试）
 */
export function resetOpenClawManager(): void {
  if (managerInstance) {
    managerInstance.removeAllListeners();
    if (managerInstance.isRunning()) {
      managerInstance.forceStop();
    }
  }
  managerInstance = null;
}
