// src/backend/services/openclaw.service.ts
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { app } from "electron";
import * as fs from "fs";
import * as os from "os";
import log from "electron-log";
import { EventEmitter } from "events";
import {
  getOpenClawConfigManager,
  OpenClawConfigManager,
} from "../config/openclaw-config-manager";
import { modelCatalogService } from "./model-catalog.service";
import { MessageService } from "./message.service";
import {
  OPENCLAW_PORT,
  OPENCLAW_BIND_ADDRESS,
  OPENCLAW_PROCESS_NAME,
} from "../../shared/constants";

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
  STARTED = "started",
  STOPPED = "stopped",
  ERROR = "error",
  HEALTH_CHECK_FAILED = "health_check_failed",
  RESTARTING = "restarting",
  OUTPUT = "output",
  STDERR = "stderr",
  READY = "ready", // OpenClaw 通过 stdout 报告已就绪
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: OpenClawServiceConfig = {
  port: OPENCLAW_PORT, // 使用不同端口，避免与本地 OpenClaw (18790) 冲突
  bindAddress: OPENCLAW_BIND_ADDRESS,
  logLevel: "info",
  maxRestarts: 3,
  restartDelayMs: 5000,
  healthCheckIntervalMs: 30000,
  healthCheckTimeoutMs: 5000,
  startupTimeoutMs: 60000, // 增加到 60 秒，打包后的环境启动较慢
};

/**
 * OpenClaw 管理器类
 * 负责管理 OpenClaw AI 引擎的子进程生命周期
 */
export class OpenClawManager extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private readonly log = log.scope("OpenClawManager");
  private startTime: number = 0;
  private restartCount: number = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private config: OpenClawServiceConfig;
  private isShuttingDown: boolean = false;
  private openclawPath: string | null = null;
  private configManager: OpenClawConfigManager;
  private isExternal: boolean = false;
  private lastError: string | null = null;
  private isReady: boolean = false; // 标记 OpenClaw 是否已就绪

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
    this.log.info("OpenClaw service configuration updated:", this.config);
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
    this.log.info("Initializing OpenClaw configuration...");
    this.configManager.initializeConfig();

    // 同步配置管理器的端口设置
    const gatewayConfig = this.configManager.getGatewayConfig();
    if (gatewayConfig?.port) {
      this.config.port = gatewayConfig.port;
    }

    this.log.info("OpenClaw configuration initialized");
  }

  /**
   * 启动 OpenClaw 引擎
   */
  async start(): Promise<void> {
    if (this.childProcess) {
      this.log.warn("OpenClaw is already running");
      return;
    }

    this.isShuttingDown = false;

    try {
      // 1. 确保配置文件存在（这将创建 .clawstation 目录）
      // 即使启动失败，配置目录也应该存在，以便保存日志等
      await this.ensureConfigFile();

      // 2. 解析 OpenClaw 路径
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
      this.lastError = null;

      // 确保 childProcess 已经在 spawnProcess 中被初始化且不为 null
      if (!this.childProcess) {
        throw new Error("OpenClaw process initialization failed");
      }

      // 使用类型断言确保 TypeScript 理解 childProcess 不为 null
      const childProcess = this.childProcess as ChildProcess;

      this.emit(OpenClawProcessEvent.STARTED, {
        pid: childProcess.pid,
        port: this.config.port,
        timestamp: new Date(),
      });

      this.log.info(
        `OpenClaw started successfully on port ${this.config.port}`
      );
    } catch (error: any) {
      // 检查是否是跳过启动的特殊错误
      if (error?.message === "SKIP_INTERNAL_OPENCLAW") {
        this.log.warn(
          "External OpenClaw detected on same port, using external instance"
        );
        // 标记为外部实例，不尝试杀死进程
        this.isExternal = true;
        this.startTime = Date.now();
        this.lastError = null;
        this.emit(OpenClawProcessEvent.STARTED, {
          pid: 0,
          port: this.config.port,
          timestamp: new Date(),
          external: true,
        });
        return;
      }
      this.lastError = (error as Error)?.message || String(error);
      this.log.error("Failed to start OpenClaw:", error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * 停止 OpenClaw 引擎
   */
  stop(): void {
    // 如果是外部实例，不尝试杀死进程
    if (this.isExternal) {
      this.log.info("Using external OpenClaw instance, skipping stop");
      this.cleanup();
      return;
    }

    if (!this.childProcess) {
      this.log.warn("OpenClaw is not running");
      return;
    }

    this.isShuttingDown = true;
    this.log.info("Stopping OpenClaw process...");

    // 停止健康检查
    this.stopHealthCheck();

    // 尝试优雅关闭
    this.gracefulShutdown();
  }

  /**
   * 强制停止 OpenClaw 引擎
   */
  forceStop(): void {
    // 如果是外部实例，不尝试杀死进程
    if (this.isExternal) {
      this.log.info("Using external OpenClaw instance, skipping force stop");
      this.cleanup();
      return;
    }

    if (!this.childProcess) {
      return;
    }

    this.isShuttingDown = true;
    this.log.info("Force stopping OpenClaw process...");

    this.stopHealthCheck();

    // 强制终止
    this.childProcess.kill("SIGKILL");
    this.cleanup();
  }

  /**
   * 重启 OpenClaw 引擎
   */
  async restart(): Promise<void> {
    this.log.info("Restarting OpenClaw engine...");
    this.stop();
    // 等待1秒确保进程完全终止
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.start();
    this.log.info("OpenClaw engine restarted successfully");
  }

  /**
   * 检查 OpenClaw 是否正在运行（内部或外部）
   */
  isRunning(): boolean {
    if (this.isExternal) {
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
    const agents =
      agentsConfig?.list?.map((agent) => ({
        id: agent.id,
        name: agent.name,
        default: agent.default,
      })) || [];

    if (!isRunning) {
      return {
        isRunning: false,
        isHealthy: false,
        port: this.config.port,
        bindAddress: this.config.bindAddress,
        error: this.lastError || "OpenClaw engine is not running",

        agents,
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
        error: isHealthy ? undefined : "Health check failed",
        agents,
        models,
      };
    } catch (error) {
      this.log.warn("Status check failed:", error);
      return {
        isRunning: true,
        isHealthy: false,
        pid: this.childProcess?.pid,
        uptime: this.startTime ? Date.now() - this.startTime : 0,
        port: this.config.port,
        bindAddress: this.config.bindAddress,
        error: "Status check failed: " + (error as Error).message,
        agents,
      };
    }
  }

  /**
   * 获取进程信息
   */
  getProcessInfo(): {
    processName: string;
    pid: number | null;
    port: number;
    isExternal: boolean;
    isRunning: boolean;
    uptime: number;
  } {
    return {
      processName: OPENCLAW_PROCESS_NAME,
      pid: this.childProcess?.pid || null,
      port: this.config.port,
      isExternal: this.isExternal,
      isRunning: this.isRunning(),
      uptime: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * 强制清理所有 OpenClaw 相关进程
   */
  /**
   * 获取占用指定端口的进程信息
   * @returns {Promise<{pid: string, cmd: string} | null>}
   */
  private async getPortOccupier(): Promise<{ pid: string; cmd: string } | null> {
    const { execSync } = require("child_process");

    try {
      if (process.platform === "win32") {
        // Windows: 使用 netstat 和 tasklist
        const netstatOutput = execSync(
          `netstat -ano -p tcp | findstr :${this.config.port}`,
          { encoding: "utf-8" }
        );
        const lines = netstatOutput.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          const match = line.match(/\s+(\d+)\s*$/);
          if (match) {
            const pid = match[1];
            try {
              const tasklistOutput = execSync(
                `tasklist /FI "PID eq ${pid}" /FO CSV /NH`,
                { encoding: "utf-8" }
              );
              const cmdMatch = tasklistOutput.match(/^"([^"]+)"/);
              if (cmdMatch) {
                return { pid, cmd: cmdMatch[1] };
              }
            } catch {
              // 忽略
            }
          }
        }
      } else {
        // macOS/Linux: 使用 lsof
        const output = execSync(
          `lsof -i:${this.config.port} -sTCP:LISTEN 2>/dev/null`,
          { encoding: "utf-8" }
        );
        const lines = output.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const cmd = parts[0];
            const pid = parts[1];
            if (cmd && pid && !isNaN(parseInt(pid))) {
              return { pid, cmd };
            }
          }
        }
      }
    } catch {
      // 忽略错误
    }
    return null;
  }

  async forceCleanup(): Promise<{
    success: boolean;
    killed: number;
    error?: string;
  }> {
    this.log.info("Force cleaning up clawstation-engine processes...");
    let killed = 0;

    try {
      // 1. 停止健康检查
      this.stopHealthCheck();

      // 2. 尝试优雅关闭当前进程
      if (this.childProcess && !this.isExternal) {
        this.childProcess.kill("SIGTERM");
        // 等待 2 秒
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 如果还在运行，强制杀死
        if (this.isRunning()) {
          this.childProcess.kill("SIGKILL");
        }
        this.cleanup();
        killed++;
      }

      // 3. 使用系统命令查找并杀死所有 clawstation-engine 进程
      try {
        const { execSync } = require("child_process");

        // macOS/Linux: 查找并杀死进程名包含 clawstation-engine 的进程
        if (process.platform === "darwin" || process.platform === "linux") {
          try {
            // 查找所有 clawstation-engine 进程
            const output = execSync(
              `ps aux | grep "${OPENCLAW_PROCESS_NAME}" | grep -v grep`,
              { encoding: "utf-8" }
            );
            const lines = output.trim().split("\n").filter(Boolean);

            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[1];
              const cmd = parts[10] || parts[9] || parts[8]; // 命令列
              if (pid && cmd && cmd.includes(OPENCLAW_PROCESS_NAME)) {
                try {
                  execSync(`kill -9 ${pid} 2>/dev/null`);
                  killed++;
                  this.log.info(`Killed ${OPENCLAW_PROCESS_NAME} process ${pid}`);
                } catch {
                  // 忽略单个进程杀死错误
                }
              }
            }
          } catch {
            // 可能没有找到进程
          }
        }
      } catch (error) {
        this.log.warn("Error during system process cleanup:", error);
      }

      // 4. 释放端口（Windows/macOS/Linux）
      try {
        const { execSync } = require("child_process");

        if (process.platform === "win32") {
          try {
            const output = execSync(
              `netstat -ano -p tcp | findstr :${this.config.port}`,
              {
                encoding: "utf-8",
              }
            );
            const lines = output.trim().split("\n").filter(Boolean);

            for (const line of lines) {
              const pidMatch = line.match(/\s(\d+)\s*$/);
              if (pidMatch) {
                const pid = pidMatch[1];
                // 获取进程名
                try {
                  const tasklistOutput = execSync(
                    `tasklist /FI "PID eq ${pid}" /FO CSV /NH`,
                    { encoding: "utf-8" }
                  );
                  const cmdMatch = tasklistOutput.match(/^"([^"]+)"/);
                  if (cmdMatch && cmdMatch[1].includes(OPENCLAW_PROCESS_NAME)) {
                    execSync(`taskkill /F /T /PID ${pid}`);
                    killed++;
                    this.log.info(`Killed ${OPENCLAW_PROCESS_NAME} process ${pid}`);
                  }
                } catch {
                  // 忽略
                }
              }
            }
          } catch {
            // 忽略
          }
        } else {
          // macOS/Linux: 只查找并杀死 clawstation-engine 进程
          try {
            // 获取占用端口的进程信息
            const output = execSync(
              `lsof -i:${this.config.port} -sTCP:LISTEN 2>/dev/null`,
              { encoding: "utf-8" }
            );
            const lines = output.trim().split("\n").filter(Boolean);
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 2) {
                const cmd = parts[0];
                const pid = parts[1];
                // 只杀死进程名包含 OPENCLAW_PROCESS_NAME 的进程
                if (cmd && pid && cmd.includes(OPENCLAW_PROCESS_NAME)) {
                  try {
                    execSync(`kill -9 ${pid} 2>/dev/null`);
                    killed++;
                    this.log.info(`Killed ${cmd} process ${pid}`);
                  } catch {
                    // 忽略
                  }
                }
              }
            }
          } catch {
            // lsof 失败时忽略
          }
        }
      } catch {
        // 忽略端口清理错误
      }

      // 5. 重置状态
      this.childProcess = null;
      this.startTime = 0;
      this.isExternal = false;
      this.isShuttingDown = false;
      this.gatewayToken = null;

      this.log.info(`Force cleanup completed. Killed ${killed} processes.`);
      return { success: true, killed };
    } catch (error) {
      this.log.error("Force cleanup failed:", error);
      return {
        success: false,
        killed,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 修复 AI 引擎（强制清理并重启）
   */
  async repair(): Promise<{ success: boolean; message: string }> {
    this.log.info("Starting AI engine repair...");

    try {
      // 1. 强制清理
      const cleanupResult = await this.forceCleanup();
      if (!cleanupResult.success) {
        this.log.warn("Cleanup had issues, continuing with restart...");
      }

      // 2. 等待端口释放
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 3. 重新启动
      try {
        await this.start();
        this.log.info("AI engine repair completed successfully");
        return {
          success: true,
          message: `已清理 ${cleanupResult.killed} 个进程，AI 引擎已重启`,
        };
      } catch (startError) {
        return {
          success: false,
          message: `清理完成，但重启失败: ${(startError as Error).message}`,
        };
      }
    } catch (error) {
      this.log.error("Repair failed:", error);
      return {
        success: false,
        message: `修复失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 发送查询到 OpenClaw 引擎
   */
  async sendQuery(
    request: OpenClawQueryRequest
  ): Promise<OpenClawQueryResponse> {
    if (!this.isRunning()) {
      throw new Error("OpenClaw engine is not running");
    }

    const health = await this.performHealthCheck();
    if (!health) {
      throw new Error("OpenClaw engine is not healthy");
    }

    try {
      // 如果没有token，尝试从配置文件读取
      if (!this.gatewayToken) {
        await this.loadTokenFromConfig();
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // 添加认证token
      if (this.gatewayToken) {
        headers["Authorization"] = `Bearer ${this.gatewayToken}`;
      }

      // 构建消息列表，包含对话历史
      const messages = await this.buildMessages(request);

      const response = await fetch(
        `http://${this.config.bindAddress}:${this.config.port}/v1/chat/completions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: request.model || "default",
            messages,
            stream: request.stream ?? false,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
          }),
          signal: AbortSignal.timeout(600000), // 600秒（10分钟）超时，与 OpenClaw 默认超时一致
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenClaw request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      return {
        content,
        model: data.model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      this.log.error("Failed to send query to OpenClaw:", error);
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
      this.log.warn("Failed to load token from config:", error);
    }
  }

  /**
   * 构建消息列表，包含对话历史
   */
  private async buildMessages(
    request: OpenClawQueryRequest
  ): Promise<Array<{ role: string; content: string }>> {
    const messages: Array<{ role: string; content: string }> = [];

    // 如果有 conversationId，加载历史消息
    if (request.conversationId) {
      try {
        const history = await MessageService.getMessagesByConversationId(
          request.conversationId
        );

        // 将历史消息转换为 OpenAI 格式
        for (const msg of history) {
          // 跳过 system 消息（虽然当前模型不支持，但保持兼容性）
          if ((msg.role as string) === "system") continue;

          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }

        this.log.info(
          `Loaded ${history.length} messages from conversation ${request.conversationId}`
        );
      } catch (error) {
        this.log.warn(`Failed to load conversation history: ${error}`);
      }
    }

    // 添加当前用户消息
    messages.push({
      role: "user",
      content: request.message,
    });

    return messages;
  }

  /**
   * 流式发送查询到 OpenClaw 引擎
   */
  async *sendQueryStream(
    request: OpenClawQueryRequest
  ): AsyncGenerator<
    { type: "content" | "tool_call"; data: string },
    void,
    unknown
  > {
    if (!this.isRunning()) {
      throw new Error("OpenClaw engine is not running");
    }

    const health = await this.performHealthCheck();
    if (!health) {
      throw new Error("OpenClaw engine is not healthy");
    }

    try {
      // 如果没有token，尝试从配置文件读取
      if (!this.gatewayToken) {
        await this.loadTokenFromConfig();
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // 添加认证token
      if (this.gatewayToken) {
        headers["Authorization"] = `Bearer ${this.gatewayToken}`;
      }

      // 构建消息列表，包含对话历史
      const messages = await this.buildMessages(request);

      const response = await fetch(
        `http://${this.config.bindAddress}:${this.config.port}/v1/chat/completions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: request.model || "default",
            messages,
            stream: true,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
          }),
          signal: AbortSignal.timeout(600000), // 600秒（10分钟）超时，与 OpenClaw 默认超时一致
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenClaw request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              // 处理普通文本内容
              const content = delta?.content;
              if (content) {
                yield { type: "content", data: content };
              }

              // 处理工具调用
              const toolCalls = delta?.tool_calls;
              if (toolCalls && Array.isArray(toolCalls)) {
                for (const toolCall of toolCalls) {
                  if (toolCall.function?.name) {
                    yield {
                      type: "tool_call",
                      data: JSON.stringify({
                        type: "tool_call",
                        name: toolCall.function.name,
                        arguments: toolCall.function.arguments || {},
                      }),
                    };
                  }
                }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      this.log.error("Failed to send streaming query to OpenClaw:", error);
      throw error;
    }
  }

  /**
   * 获取 OpenClaw 可用模型列表
   * 使用 ModelCatalogService 直接从文件系统读取，不依赖 HTTP API
   */
  async getModels(): Promise<
    Array<{ id: string; name: string; provider?: string }>
  > {
    try {
      const catalog = await modelCatalogService.loadModelCatalog();
      return catalog.map((model) => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
      }));
    } catch (error) {
      this.log.error("Failed to get models from catalog:", error);
      return [];
    }
  }

  /**
   * 设置 API Key
   * 保存到 main agent（OpenClaw 实际使用的）和 default agent
   */
  setApiKey(
    provider: string,
    apiKey: string,
    agentId?: string,
    endpoint?: string
  ): void {
    // 保存到 main agent（OpenClaw 实际使用的）
    this.configManager.setApiKey("main", provider, apiKey, endpoint);
    // 也保存到 default agent（前端使用的）
    this.configManager.setApiKey("default", provider, apiKey, endpoint);
    this.log.info(
      `API key set for provider: ${provider}, endpoint: ${
        endpoint || "default"
      }, agents: main, default`
    );
  }

  /**
   * 获取 API Key
   */
  getApiKey(provider: string, agentId?: string): string | undefined {
    const targetAgentId =
      agentId || this.configManager.getDefaultAgent()?.id || "default";
    return this.configManager.getApiKey(targetAgentId, provider);
  }

  /**
   * 检查是否配置了指定 provider 的 API Key
   */
  hasApiKey(provider: string, agentId?: string): boolean {
    const targetAgentId =
      agentId || this.configManager.getDefaultAgent()?.id || "default";
    const apiKey = this.configManager.getApiKey(targetAgentId, provider);
    return !!apiKey && apiKey.length > 0;
  }

  /**
   * 获取所有已配置的 API Keys 信息（不包含敏感值）
   */
  getConfiguredProviders(
    agentId?: string
  ): Array<{ provider: string; configured: boolean }> {
    const targetAgentId =
      agentId || this.configManager.getDefaultAgent()?.id || "default";
    const authProfiles = this.configManager.loadAuthProfiles(targetAgentId);

    return Object.values(authProfiles.profiles).map((p) => ({
      provider: p.provider,
      configured: !!p.key && p.key.length > 0,
    }));
  }

  /**
   * 获取所有可用的模型列表（从配置文件）
   */
  getModelsFromConfig(): Array<{
    provider: string;
    id: string;
    name: string;
    contextWindow?: number;
    maxTokens?: number;
  }> {
    return this.configManager.getModels();
  }

  /**
   * 获取所有提供商配置
   */
  getProviderConfigs(): Record<
    string,
    { baseUrl?: string; api?: string; models?: any[] }
  > {
    return this.configManager.getProviderConfigs();
  }

  /**
   * 获取 Auth Profiles 列表
   */
  getAuthProfilesFromConfig(
    agentId?: string
  ): Array<{ provider: string; hasKey: boolean }> {
    const targetAgentId =
      agentId || this.configManager.getDefaultAgent()?.id || "default";
    return this.configManager.getAuthProfiles(targetAgentId);
  }

  /**
   * 获取当前模型配置
   * 返回当前使用的服务商和模型信息
   */
  getCurrentModelConfig(): {
    provider: string;
    model: string;
    agentId: string;
  } | null {
    const defaultAgent = this.configManager.getDefaultAgent();
    if (!defaultAgent || !defaultAgent.id) {
      return null;
    }

    const agentId: string = defaultAgent.id;
    let modelConfig = defaultAgent.model;

    // 如果model是字符串格式，直接使用
    if (typeof modelConfig === "string") {
      const parts = modelConfig.split("/");
      if (parts.length >= 2 && parts[0]) {
        return {
          provider: parts[0],
          model: parts.slice(1).join("/"),
          agentId,
        };
      }
    }

    // 如果是对象格式，使用primary
    if (modelConfig && typeof modelConfig === "object" && modelConfig.primary) {
      const parts = modelConfig.primary.split("/");
      if (parts.length >= 2 && parts[0]) {
        return {
          provider: parts[0],
          model: parts.slice(1).join("/"),
          agentId,
        };
      }
    }

    // 如果agent没有model配置，尝试使用agents.defaults
    const agentsConfig = this.configManager.getAgentsConfig();
    if (agentsConfig?.defaults?.model) {
      const defaultModel = agentsConfig.defaults.model;
      if (typeof defaultModel === "string") {
        const parts = defaultModel.split("/");
        if (parts.length >= 2 && parts[0]) {
          return {
            provider: parts[0],
            model: parts.slice(1).join("/"),
            agentId,
          };
        }
      }
    }

    return null;
  }

  /**
   * 验证配置是否完整（包括 API Keys）
   */
  validateConfiguration(): {
    valid: boolean;
    errors: string[];
    missingApiKeys: string[];
  } {
    const result = this.configManager.validateConfig();
    const missingApiKeys: string[] = [];

    // 检查默认 agent 的 API key
    const defaultAgent = this.configManager.getDefaultAgent();
    if (defaultAgent) {
      const modelConfig = defaultAgent.model;
      if (typeof modelConfig === "string") {
        const provider = modelConfig.split("/")[0];
        if (provider && !this.hasApiKey(provider)) {
          missingApiKeys.push(provider);
        }
      } else if (modelConfig?.primary) {
        const provider = modelConfig.primary.split("/")[0];
        if (provider && !this.hasApiKey(provider)) {
          missingApiKeys.push(provider);
        }
      }
    }

    return {
      valid: result.valid && missingApiKeys.length === 0,
      errors: result.errors,
      missingApiKeys,
    };
  }

  /**
   * 删除 API Key
   */
  removeApiKey(provider: string, agentId?: string): boolean {
    const targetAgentId =
      agentId || this.configManager.getDefaultAgent()?.id || "default";
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

    // 2. 生产环境资源目录 - app.asar.unpacked
    // 优先使用 wrapper.js (设置进程名)
    if (app.isPackaged) {
      const appPath = app.getAppPath();
      const unpackedPath = appPath.replace("app.asar", "app.asar.unpacked");

      // wrapper.js 优先
      possiblePaths.push(
        path.join(process.resourcesPath, "openclaw/wrapper.js"),
        path.join(unpackedPath, "lib/openclaw/wrapper.js")
      );

      // lib/openclaw 目录（从 git 提交）- 优先 entry.js
      possiblePaths.push(
        path.join(unpackedPath, "lib/openclaw/dist/entry.js"),
        path.join(unpackedPath, "lib/openclaw/dist/index.js")
      );
      // 备用路径 - 优先 entry.js
      possiblePaths.push(
        path.join(
          process.resourcesPath,
          "app.asar.unpacked/lib/openclaw/dist/entry.js"
        ),
        path.join(
          process.resourcesPath,
          "app.asar.unpacked/lib/openclaw/dist/index.js"
        )
      );
      // node_modules 备用（如果作为 npm 依赖安装）- 优先 entry.js
      possiblePaths.push(
        path.join(unpackedPath, "node_modules/openclaw/dist/entry.js"),
        path.join(unpackedPath, "node_modules/openclaw/dist/index.js")
      );
      possiblePaths.push(
        path.join(
          process.resourcesPath,
          "app.asar.unpacked/node_modules/openclaw/dist/entry.js"
        ),
        path.join(
          process.resourcesPath,
          "app.asar.unpacked/node_modules/openclaw/dist/index.js"
        )
      );
    }

    // 3. 开发环境 lib 目录 - 优先使用 wrapper.js
    possiblePaths.push(
      path.join(__dirname, "../../../../resources/openclaw/wrapper.js"),
      path.join(__dirname, "../../../resources/openclaw/wrapper.js"),
      path.join(process.cwd(), "resources/openclaw/wrapper.js"),
      path.join(__dirname, "../../../../lib/openclaw/dist/entry.js"),
      path.join(__dirname, "../../../lib/openclaw/dist/entry.js"),
      path.join(__dirname, "../../../../lib/openclaw/dist/index.js"),
      path.join(__dirname, "../../../lib/openclaw/dist/index.js")
    );

    // 4. 相对于项目根目录（开发环境）- 优先使用 entry.js
    possiblePaths.push(
      path.join(process.cwd(), "lib/openclaw/dist/entry.js"),
      path.join(process.cwd(), "lib/openclaw/dist/index.js")
    );

    // 5. node_modules - 优先使用 entry.js
    possiblePaths.push(
      path.join(__dirname, "../../../node_modules/openclaw/dist/entry.js"),
      path.join(__dirname, "../../../../node_modules/openclaw/dist/entry.js"),
      path.join(__dirname, "../../../node_modules/openclaw/dist/index.js"),
      path.join(__dirname, "../../../../node_modules/openclaw/dist/index.js")
    );

    // 6. 全局安装 - 优先使用 entry.js
    possiblePaths.push(
      path.join(
        os.homedir(),
        ".npm-global",
        "lib",
        "node_modules",
        "openclaw",
        "dist",
        "entry.js"
      ),
      "/usr/local/lib/node_modules/openclaw/dist/entry.js",
      "/usr/lib/node_modules/openclaw/dist/entry.js",
      path.join(
        os.homedir(),
        ".npm-global",
        "lib",
        "node_modules",
        "openclaw",
        "dist",
        "index.js"
      ),
      "/usr/local/lib/node_modules/openclaw/dist/index.js",
      "/usr/lib/node_modules/openclaw/dist/index.js"
    );

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }

    // 尝试使用 which 命令查找
    try {
      const { execSync } = require("child_process");
      const result = execSync("which openclaw", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const whichPath = result.trim();
      if (whichPath && fs.existsSync(whichPath)) {
        return whichPath;
      }
    } catch {
      // 忽略错误
    }

    throw new Error(
      `OpenClaw executable not found.\n\nSearched paths:\n${possiblePaths.join(
        "\n"
      )}\n\n` +
        "Please check if the 'resources/openclaw' directory exists in the installation folder."
    );
  }

  /**
   * 确保端口可用
   */
  private async ensurePortAvailable(retryCount: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      const net = require("net");
      const tester = net.createServer();

      tester.once("error", (err: any) => {
        if (err.code !== "EADDRINUSE") {
          reject(err);
          return;
        }

        void (async () => {
          // 先检查占用端口的进程
          const occupier = await this.getPortOccupier();

          if (occupier) {
            if (occupier.cmd.includes(OPENCLAW_PROCESS_NAME)) {
              // 如果是 clawstation-engine 进程，尝试清理它
              this.log.info(
                `Port ${this.config.port} is in use by ${occupier.cmd} (PID: ${occupier.pid}), cleaning up to use own instance...`
              );
              if (retryCount < 1) {
                const cleanupResult = await this.forceCleanup();
                if (cleanupResult.success) {
                  try {
                    await this.ensurePortAvailable(retryCount + 1);
                    resolve();
                    return;
                  } catch (retryError) {
                    reject(retryError);
                    return;
                  }
                }
              }
              reject(
                new Error(
                  `Port ${this.config.port} is occupied by ${OPENCLAW_PROCESS_NAME} and could not be freed`
                )
              );
              return;
            } else {
              // 如果是其他进程，报错提示端口被占用
              reject(
                new Error(
                  `Port ${this.config.port} is occupied by ${occupier.cmd} (PID: ${occupier.pid}). Please free the port or change the port in configuration.`
                )
              );
              return;
            }
          }

          // 无法确定占用进程，尝试清理一次
          if (retryCount < 1) {
            this.log.warn(
              `Port ${this.config.port} is occupied by unknown process, attempting cleanup...`
            );
            const cleanupResult = await this.forceCleanup();
            if (cleanupResult.success) {
              try {
                await this.ensurePortAvailable(retryCount + 1);
                resolve();
                return;
              } catch (retryError) {
                reject(retryError);
                return;
              }
            }
          }

          reject(
            new Error(
              `Port ${this.config.port} is occupied by an unknown process`
            )
          );
        })();
      });

      tester.once("listening", () => {
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
    // 完整初始化配置（包含 auth-profiles/system.md/models.json 等）
    this.configManager.initializeConfig();

    // 兼容旧逻辑：确保默认 agent 目录存在
    this.configManager.ensureAgentDir("default");

    // 确保日志目录存在（便于首启失败时排查）
    const stateDir = path.join(os.homedir(), ".clawstation");
    const logsDir = path.join(stateDir, "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 同步端口配置
    const gatewayConfig = this.configManager.getGatewayConfig();
    if (gatewayConfig?.port) {
      this.config.port = gatewayConfig.port;
    }

    // 加载 token
    this.gatewayToken = this.configManager.getGatewayToken() || null;

    this.log.info("OpenClaw configuration ensured via ConfigManager");
  }

  private gatewayToken: string | null = null;

  /**
   * 生成安全随机token
   */
  private generateSecureToken(): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "claw_";
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
      throw new Error("OpenClaw path not resolved");
    }

    // 确保配置文件存在
    await this.ensureConfigFile();

    // 确定工作目录 - 使用 OpenClaw 的根目录，这样 Node.js 能找到 node_modules
    // OpenClaw 路径类似: .../lib/openclaw/dist/index.js -> .../lib/openclaw/
    // 或者 .../resources/openclaw/wrapper.js -> .../resources/openclaw/
    let openclawRoot: string;
    if (this.openclawPath.endsWith("wrapper.js")) {
      openclawRoot = path.dirname(this.openclawPath);
    } else {
      openclawRoot = path.dirname(path.dirname(this.openclawPath)); // dist -> openclaw
    }

    let cwd: string;
    if (app.isPackaged) {
      // 打包环境：使用 OpenClaw 根目录作为 cwd
      // 这样 Node.js 能正确解析 ./node_modules
      cwd = openclawRoot;
      this.log.info(`Using OpenClaw root as cwd: ${cwd}`);
    } else {
      cwd = openclawRoot;
    }

    // 准备环境变量
    // 使用独立的 OPENCLAW_STATE_DIR 指向 ~/.clawstation/
    // 这样内置的 OpenClaw 不会与用户自己安装的 OpenClaw (使用 ~/.openclaw/) 冲突
    const stateDir = path.join(os.homedir(), ".clawstation");

    // 设置 NODE_PATH 指向 OpenClaw 的 node_modules，确保依赖能被找到
    const nodeModulesPath = path.join(openclawRoot, "node_modules");

    const env = {
      ...process.env,
      OPENCLAW_MODE: "embedded",
      // 使用独立的状态目录，避免与用户自己的 OpenClaw 冲突
      OPENCLAW_STATE_DIR: stateDir,
      // NODE_PATH 帮助 Node.js 找到依赖（备用方案）
      NODE_PATH: nodeModulesPath,
      // 移除可能导致冲突的环境变量设置，改由 CLI 参数控制
      // OPENCLAW_GATEWAY_BIND: this.config.bindAddress,  // 改用 CLI 参数
      OPENCLAW_GATEWAY_PORT: String(this.config.port),
      OPENCLAW_LOG_LEVEL: this.config.logLevel,
      OPENCLAW_HIDE_BANNER: "1", // 隐藏启动 banner
      NODE_NO_WARNINGS: "1",
      // 设置token环境变量作为备选认证方式
      OPENCLAW_GATEWAY_TOKEN: this.gatewayToken || "",
      // 传递进程名，以便 entry.js 能够正确设置 process.title
      OPENCLAW_PROCESS_NAME: OPENCLAW_PROCESS_NAME,
      // 禁用 OpenClaw 的进程重新生成行为，避免与子进程管理冲突
      OPENCLAW_NO_RESPAWN: "1",
    };

    this.log.info(`NODE_PATH set to: ${nodeModulesPath}`);

    // 确定启动参数
    const args = [
      "gateway",
      "run",
      "--bind",
      "loopback",
      "--port",
      String(this.config.port),
    ];

    // 使用系统 Node.js 启动（避免 Electron sandbox 问题）
    const nodePath = await this.findSystemNode();

    this.log.info(`Spawning Claw with Node.js: ${nodePath}`);
    this.log.info(`Working directory: ${cwd}`);
    this.log.info(`Arguments: ${args.join(" ")}`);

    // 使用 launcher 设置进程名为 clawstation-engine
    // 优先使用 launcher 脚本，如果没有则直接启动
    const launcherPath =
      process.platform === "win32" ? null : this.resolveLauncherPath();

    if (launcherPath) {
      // 使用 launcher 脚本启动，可以设置进程名
      this.log.info(`Using launcher: ${launcherPath}`);
      this.childProcess = spawn(
        nodePath,
        [launcherPath, this.openclawPath!, ...args],
        {
          env,
          stdio: ["pipe", "pipe", "pipe"],
          cwd,
          detached: false,
        }
      );
    } else {
      // 直接启动（没有 launcher 时，设置 argv[0] 为 clawstation-engine）
      // 注意：在 Node 22+ 上修改 argv0 可能导致模块加载失败，因此我们只传递脚本路径
      // 进程名由 wrapper.js 内部设置
      this.log.info(
        "No launcher found, using direct spawn without custom argv[0]"
      );
      this.childProcess = spawn(nodePath, [this.openclawPath!, ...args], {
        env,
        stdio: ["pipe", "pipe", "pipe"],
        cwd,
        detached: false,
      });
    }

    if (!this.childProcess.pid) {
      throw new Error("Failed to spawn Claw process");
    }

    // 设置进程事件处理
    this.setupProcessHandlers();
  }

  /**
   * 解析 launcher 脚本路径
   */
  private resolveLauncherPath(): string | null {
    const possiblePaths: string[] = [];

    // 生产环境
    if (app.isPackaged) {
      const appPath = app.getAppPath();
      const unpackedPath = appPath.replace("app.asar", "app.asar.unpacked");
      possiblePaths.push(
        path.join(unpackedPath, "scripts", "clawstation-claw-launcher.js"),
        path.join(
          process.resourcesPath,
          "scripts",
          "clawstation-claw-launcher.js"
        )
      );
    }

    // 开发环境
    possiblePaths.push(
      path.join(__dirname, "../../../scripts/clawstation-claw-launcher.js"),
      path.join(process.cwd(), "scripts", "clawstation-claw-launcher.js")
    );

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }

    return null;
  }

  /**
   * 查找 Node.js 运行时
   * 优先级：打包的 Node.js > 系统 Node.js > Electron 内置
   */
  private async findSystemNode(): Promise<string> {
    const isWindows = process.platform === "win32";
    const arch = process.arch;

    // 1. 最高优先级：打包的 Node.js 运行时
    if (app.isPackaged) {
      const embeddedNodePaths: string[] = [];

      // resources/node/ 目录（electron-builder extraResources）
      const resourcesNodePath = path.join(process.resourcesPath, "node");

      if (isWindows) {
        embeddedNodePaths.push(
          path.join(resourcesNodePath, "node.exe"),
          path.join(resourcesNodePath, "bin", "node.exe")
        );
      } else {
        embeddedNodePaths.push(
          path.join(resourcesNodePath, "bin", "node"),
          path.join(resourcesNodePath, "node")
        );
      }

      for (const testPath of embeddedNodePaths) {
        if (fs.existsSync(testPath)) {
          this.log.info(`Using embedded Node.js: ${testPath}`);
          return testPath;
        }
      }
    }

    // 2. 环境变量指定的 Node
    if (process.env.NODE_PATH && fs.existsSync(process.env.NODE_PATH)) {
      this.log.info(`Using NODE_PATH: ${process.env.NODE_PATH}`);
      return process.env.NODE_PATH;
    }

    // 3. 系统 Node.js
    const possiblePaths: string[] = [];

    if (isWindows) {
      possiblePaths.push(
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Program Files (x86)\\nodejs\\node.exe",
        path.join(os.homedir(), "AppData\\Local\\fnm\\node.exe"),
        path.join(os.homedir(), "AppData\\Roaming\\fnm\\node.exe"),
        path.join(os.homedir(), ".fnm\\node.exe"),
        path.join(os.homedir(), "scoop\\apps\\nodejs\\current\\node.exe"),
        path.join(os.homedir(), ".nvm-windows\\node.exe"),
        path.join(process.env.APPDATA || "", "nvm", "current", "node.exe")
      );
    } else {
      possiblePaths.push(
        "/usr/local/bin/node",
        "/usr/bin/node",
        "/opt/homebrew/bin/node",
        path.join(os.homedir(), ".nvm", "current", "bin", "node"),
        path.join(
          os.homedir(),
          ".local",
          "share",
          "fnm",
          "node-versions",
          "installing",
          "installation",
          "bin",
          "node"
        ),
        path.join(os.homedir(), ".volta", "bin", "node")
      );
    }

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        this.log.info(`Found system Node.js at: ${testPath}`);
        return testPath;
      }
    }

    // 4. which/where 命令
    try {
      const { execSync } = require("child_process");
      const cmd = isWindows ? "where node" : "which node";
      const result = execSync(cmd, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const whichPath = result.trim().split("\n")[0];
      if (whichPath && fs.existsSync(whichPath)) {
        this.log.info(`Found system Node.js via ${cmd}: ${whichPath}`);
        return whichPath;
      }
    } catch {
      // 忽略错误
    }

    // 5. 最后回退到 Electron 内置 Node.js
    this.log.warn("No Node.js found, falling back to Electron Node.js");
    return process.execPath;
  }

  /**
   * 设置进程事件处理
   */
  private setupProcessHandlers(): void {
    if (!this.childProcess) return;

    // 标准输出 - 同时监听启动成功的标志
    this.childProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        this.log.info("[OpenClaw]", output);
        this.emit(OpenClawProcessEvent.OUTPUT, output);

        // 检测 OpenClaw 启动成功的标志
        if (
          output.includes("listening on ws://") ||
          output.includes("[gateway] listening")
        ) {
          this.emit(OpenClawProcessEvent.READY);
        }
      }
    });

    // 标准错误
    this.childProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        this.log.warn("[OpenClaw]", output);
        this.emit(OpenClawProcessEvent.STDERR, output);
      }
    });

    // 进程错误
    this.childProcess.on("error", (error) => {
      this.lastError = (error as Error)?.message || String(error);
      this.log.error("OpenClaw process error:", error);
      this.emit(OpenClawProcessEvent.ERROR, error);
    });

    // 进程退出
    this.childProcess.on("close", (code, signal) => {
      this.log.info(
        `OpenClaw process exited with code ${code}, signal ${signal}`
      );
      if (!this.isShuttingDown) {
        this.lastError = `OpenClaw process exited (code=${code}, signal=${signal})`;
      }
      this.childProcess = null;

      if (!this.isShuttingDown) {
        this.emit(OpenClawProcessEvent.STOPPED, {
          code,
          signal,
          unexpected: true,
        });
        this.handleUnexpectedExit(code);
      } else {
        this.emit(OpenClawProcessEvent.STOPPED, {
          code,
          signal,
          unexpected: false,
        });
      }
    });

    this.log.info(
      `Started OpenClaw process with PID: ${this.childProcess.pid}`
    );
  }

  /**
   * 等待服务启动
   * 通过两种方式检测：
   * 1. 监听 stdout 中的 "listening on ws://" 标志（最快）
   * 2. 定期健康检查（备用）
   */
  private async waitForStartup(): Promise<void> {
    const startTime = Date.now();
    const timeout = this.config.startupTimeoutMs;

    // 重置就绪状态
    this.isReady = false;

    // 设置一次性监听器，当 OpenClaw 输出 "listening on ws://" 时触发
    const readyPromise = new Promise<void>((resolve) => {
      const onReady = () => {
        this.isReady = true;
        this.log.info("OpenClaw reported ready via stdout");
        resolve();
      };
      this.once(OpenClawProcessEvent.READY, onReady);

      // 超时后清理监听器
      setTimeout(() => {
        this.off(OpenClawProcessEvent.READY, onReady);
      }, timeout);
    });

    // 健康检查循环
    const healthCheckPromise = (async () => {
      while (Date.now() - startTime < timeout) {
        try {
          const isHealthy = await this.performHealthCheck();
          if (isHealthy) {
            this.log.info("OpenClaw health check passed");
            return;
          }
        } catch {
          // 继续等待
        }

        // 如果已经通过 stdout 检测到就绪，提前退出
        if (this.isReady) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      throw new Error(`OpenClaw failed to start within ${timeout}ms`);
    })();

    // 竞争：谁先完成就用谁的结果
    await Promise.race([readyPromise, healthCheckPromise]);

    // 给一点额外时间让服务完全初始化
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.healthCheckTimeoutMs
      );

      const response = await fetch(
        `http://${this.config.bindAddress}:${this.config.port}/health`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);
      // OpenClaw returns 503 if UI assets are missing, but API is working.
      // We consider 503 as healthy for embedded engine without UI.
      return response.ok || response.status === 503;
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
        this.log.warn("Health check failed");
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

    this.lastError = `OpenClaw exited unexpectedly (code=${code})`;
    this.stopHealthCheck();

    if (this.restartCount < this.config.maxRestarts) {
      this.restartCount++;
      this.log.info(
        `Attempting to restart OpenClaw (attempt ${this.restartCount}/${this.config.maxRestarts})...`
      );

      this.emit(OpenClawProcessEvent.RESTARTING, {
        attempt: this.restartCount,
        maxAttempts: this.config.maxRestarts,
      });

      setTimeout(() => {
        this.start().catch((error) => {
          this.log.error("Failed to restart OpenClaw:", error);
        });
      }, this.config.restartDelayMs);
    } else {
      this.log.error(
        `OpenClaw has exited unexpectedly ${this.config.maxRestarts} times. Giving up.`
      );
      this.cleanup();
    }
  }

  /**
   * 优雅关闭
   */
  private gracefulShutdown(): void {
    if (!this.childProcess) return;

    // 首先尝试 SIGTERM
    this.childProcess.kill("SIGTERM");

    // 设置超时强制终止
    setTimeout(() => {
      if (this.childProcess && !this.childProcess.killed) {
        this.log.warn("OpenClaw did not terminate gracefully, forcing...");
        this.childProcess.kill("SIGKILL");
      }
    }, 10000);
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.stopHealthCheck();
    this.childProcess = null;
    this.isExternal = false;
    this.startTime = 0;
  }
}

// 导出单例实例
let managerInstance: OpenClawManager | null = null;

/**
 * 获取 OpenClaw 管理器实例（单例）
 */
export function getOpenClawManager(
  config?: Partial<OpenClawServiceConfig>
): OpenClawManager {
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
