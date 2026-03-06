// src/api/routes/openclaw.route.ts

import { ipcMain, IpcMainInvokeEvent, IpcMainEvent } from 'electron';
import { OpenClawManager } from '../../backend/services/openclaw.service';
import { modelCatalogService } from '../../backend/services/model-catalog.service';

/**
 * OpenClaw AI引擎相关的API路由
 */
export function setupOpenClawRoutes(openclawManager: OpenClawManager): void {
  // 获取引擎状态
  ipcMain.handle('openclaw:status', async (_event: IpcMainInvokeEvent) => {
    try {
      const status = await openclawManager.getStatus();
      return status;
    } catch (error) {
      console.error('Error getting OpenClaw status:', error);
      return {
        isRunning: false,
        isHealthy: false,
        port: 18791,
        error: (error as Error).message
      };
    }
  });

  // 发送查询到AI引擎
  ipcMain.handle('openclaw:query', async (_event: IpcMainInvokeEvent, message: string, conversationId?: number) => {
    try {
      if (!message || message.trim().length === 0) {
        throw new Error('Message is required');
      }

      const queryResult = await openclawManager.sendQuery({
        message: message.trim(),
        conversationId
      });
      // 只返回 content 字符串，而不是整个响应对象
      return { success: true, response: queryResult.content };
    } catch (error) {
      console.error('Error sending query to OpenClaw:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // 启动引擎
  ipcMain.handle('openclaw:start', async (_event: IpcMainInvokeEvent) => {
    try {
      await openclawManager.start();
      return { success: true };
    } catch (error) {
      console.error('Error starting OpenClaw:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // 停止引擎
  ipcMain.handle('openclaw:stop', async (_event: IpcMainInvokeEvent) => {
    try {
      openclawManager.stop();
      return { success: true };
    } catch (error) {
      console.error('Error stopping OpenClaw:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // 重启引擎
  ipcMain.handle('openclaw:restart', async (_event: IpcMainInvokeEvent) => {
    try {
      await openclawManager.restart();
      return { success: true };
    } catch (error) {
      console.error('Error restarting OpenClaw:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // 获取进程信息
  ipcMain.handle('openclaw:process:info', async (_event: IpcMainInvokeEvent) => {
    try {
      const info = openclawManager.getProcessInfo();
      return { success: true, info };
    } catch (error) {
      console.error('Error getting process info:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 强制清理进程
  ipcMain.handle('openclaw:process:cleanup', async (_event: IpcMainInvokeEvent) => {
    try {
      const result = await openclawManager.forceCleanup();
      return result;
    } catch (error) {
      console.error('Error cleaning up processes:', error);
      return { success: false, killed: 0, error: (error as Error).message };
    }
  });

  // 修复 AI 引擎
  ipcMain.handle('openclaw:repair', async (_event: IpcMainInvokeEvent) => {
    try {
      const result = await openclawManager.repair();
      return result;
    } catch (error) {
      console.error('Error repairing OpenClaw:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  // ========== 配置管理 API ==========

  // 获取完整配置
  ipcMain.handle('openclaw:config:get', async (_event: IpcMainInvokeEvent) => {
    try {
      const configManager = openclawManager.getConfigManager();
      const config = configManager.getConfig();
      return { success: true, config };
    } catch (error) {
      console.error('Error getting OpenClaw config:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取 Gateway 配置
  ipcMain.handle('openclaw:config:gateway', async (_event: IpcMainInvokeEvent) => {
    try {
      const configManager = openclawManager.getConfigManager();
      const gateway = configManager.getGatewayConfig();
      return { success: true, gateway };
    } catch (error) {
      console.error('Error getting gateway config:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取 Agents 配置
  ipcMain.handle('openclaw:config:agents', async (_event: IpcMainInvokeEvent) => {
    try {
      const configManager = openclawManager.getConfigManager();
      const agents = configManager.getAgentsConfig();
      return { success: true, agents };
    } catch (error) {
      console.error('Error getting agents config:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取默认 Agent
  ipcMain.handle('openclaw:config:defaultAgent', async (_event: IpcMainInvokeEvent) => {
    try {
      const configManager = openclawManager.getConfigManager();
      const agent = configManager.getDefaultAgent();
      return { success: true, agent };
    } catch (error) {
      console.error('Error getting default agent:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 添加/更新 Agent
  ipcMain.handle('openclaw:config:agent:set', async (_event: IpcMainInvokeEvent, agent: any) => {
    try {
      const configManager = openclawManager.getConfigManager();
      configManager.addAgent(agent);
      return { success: true };
    } catch (error) {
      console.error('Error setting agent:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 删除 Agent
  ipcMain.handle('openclaw:config:agent:remove', async (_event: IpcMainInvokeEvent, agentId: string) => {
    try {
      const configManager = openclawManager.getConfigManager();
      const removed = configManager.removeAgent(agentId);
      return { success: removed };
    } catch (error) {
      console.error('Error removing agent:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 设置默认 Agent
  ipcMain.handle('openclaw:config:agent:setDefault', async (_event: IpcMainInvokeEvent, agentId: string) => {
    try {
      const configManager = openclawManager.getConfigManager();
      const success = configManager.setDefaultAgent(agentId);
      return { success };
    } catch (error) {
      console.error('Error setting default agent:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ========== API Key 管理 API ==========

  // 设置 API Key
  ipcMain.handle('openclaw:apikey:set', async (_event: IpcMainInvokeEvent, provider: string, apiKey: string, agentId?: string) => {
    try {
      openclawManager.setApiKey(provider, apiKey, agentId);
      return { success: true };
    } catch (error) {
      console.error('Error setting API key:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 检查是否有 API Key
  ipcMain.handle('openclaw:apikey:has', async (_event: IpcMainInvokeEvent, provider: string, agentId?: string) => {
    try {
      const hasKey = openclawManager.hasApiKey(provider, agentId);
      return { success: true, hasKey };
    } catch (error) {
      console.error('Error checking API key:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取已配置的 providers
  ipcMain.handle('openclaw:apikey:providers', async (_event: IpcMainInvokeEvent, agentId?: string) => {
    try {
      const providers = openclawManager.getConfiguredProviders(agentId);
      return { success: true, providers };
    } catch (error) {
      console.error('Error getting configured providers:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 删除 API Key
  ipcMain.handle('openclaw:apikey:remove', async (_event: IpcMainInvokeEvent, provider: string, agentId?: string) => {
    try {
      const removed = openclawManager.removeApiKey(provider, agentId);
      return { success: removed };
    } catch (error) {
      console.error('Error removing API key:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ========== 模型管理 API ==========

  // 获取所有可用的模型列表（从配置文件）
  ipcMain.handle('openclaw:models:list', async (_event: IpcMainInvokeEvent) => {
    try {
      const models = openclawManager.getModelsFromConfig();
      return { success: true, models };
    } catch (error) {
      console.error('Error getting models:', error);
      return { success: false, error: (error as Error).message, models: [] };
    }
  });

  // 获取完整模型目录（从 OpenClaw 的模型目录）
  ipcMain.handle('openclaw:catalog:list', async (_event: IpcMainInvokeEvent) => {
    try {
      console.log('[DEBUG] Loading model catalog...');
      const models = await modelCatalogService.loadModelCatalog();
      console.log('[DEBUG] Loaded models count:', models.length);
      return { success: true, models };
    } catch (error) {
      console.error('[DEBUG] Error loading model catalog:', error);
      return { success: false, error: (error as Error).message, models: [] };
    }
  });

  // 获取所有提供商列表
  ipcMain.handle('openclaw:catalog:providers', async (_event: IpcMainInvokeEvent) => {
    try {
      console.log('[DEBUG] Loading providers...');
      const providers = await modelCatalogService.getProviders();
      console.log('[DEBUG] Loaded providers count:', providers.length);
      return { success: true, providers };
    } catch (error) {
      console.error('[DEBUG] Error getting providers:', error);
      return { success: false, error: (error as Error).message, providers: [] };
    }
  });

  // 获取指定提供商的所有模型
  ipcMain.handle('openclaw:catalog:modelsByProvider', async (_event: IpcMainInvokeEvent, providerId: string) => {
    try {
      const models = await modelCatalogService.getModelsByProvider(providerId);
      return { success: true, models };
    } catch (error) {
      console.error('Error getting models by provider:', error);
      return { success: false, error: (error as Error).message, models: [] };
    }
  });

  // 获取所有提供商配置
  ipcMain.handle('openclaw:providers:list', async (_event: IpcMainInvokeEvent) => {
    try {
      const providers = openclawManager.getProviderConfigs();
      return { success: true, providers };
    } catch (error) {
      console.error('Error getting providers:', error);
      return { success: false, error: (error as Error).message, providers: {} };
    }
  });

  // 获取 Auth Profiles 列表
  ipcMain.handle('openclaw:auth:profiles', async (_event: IpcMainInvokeEvent, agentId?: string) => {
    try {
      const profiles = openclawManager.getAuthProfilesFromConfig(agentId);
      return { success: true, profiles };
    } catch (error) {
      console.error('Error getting auth profiles:', error);
      return { success: false, error: (error as Error).message, profiles: [] };
    }
  });

  // ========== 当前模型配置 API ==========

  // 获取当前模型配置
  ipcMain.handle('openclaw:config:currentModel', async (_event: IpcMainInvokeEvent) => {
    try {
      const config = openclawManager.getCurrentModelConfig();
      return { success: true, config };
    } catch (error) {
      console.error('Error getting current model config:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ========== 配置验证 API ==========

  // 验证配置
  ipcMain.handle('openclaw:config:validate', async (_event: IpcMainInvokeEvent) => {
    try {
      const result = openclawManager.validateConfiguration();
      return { success: true, ...result };
    } catch (error) {
      console.error('Error validating config:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 初始化配置
  ipcMain.handle('openclaw:config:initialize', async (_event: IpcMainInvokeEvent) => {
    try {
      await openclawManager.initializeConfig();
      return { success: true };
    } catch (error) {
      console.error('Error initializing config:', error);
      return { success: false, error: (error as Error).message };
    }
  });
  // ========== 流式响应 IPC (支持取消) ==========

  // 存储活动的流式请求
  const activeStreams = new Map<number, AbortController>();

  // 开始流式请求
  ipcMain.on("openclaw:query:stream:start", async (event: IpcMainEvent, message: string, conversationId?: number) => {
    try {
      if (!message || message.trim().length === 0) {
        event.sender.send("openclaw:stream:chunk", { type: "error", error: "Message is required" });
        return;
      }

      const webContentsId = event.sender.id;

      // 如果已有活动的流，先取消
      const existingAbort = activeStreams.get(webContentsId);
      if (existingAbort) {
        existingAbort.abort();
      }

      const abortController = new AbortController();
      activeStreams.set(webContentsId, abortController);

      try {
        const stream = openclawManager.sendQueryStream({
          message: message.trim(),
          conversationId,
          stream: true
        });

        let fullContent = "";
        const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

        for await (const chunk of stream) {
          if (abortController.signal.aborted) {
            event.sender.send("openclaw:stream:chunk", { type: "cancelled" });
            break;
          }

          if (chunk.type === 'content') {
            fullContent += chunk.data;
            event.sender.send("openclaw:stream:chunk", {
              type: "chunk",
              content: chunk.data
            });
          } else if (chunk.type === 'tool_call') {
            try {
              const toolData = JSON.parse(chunk.data);
              toolCalls.push({ name: toolData.name, arguments: toolData.arguments });
              // 发送工具调用信息给前端
              event.sender.send("openclaw:stream:chunk", {
                type: "tool_call",
                tool: toolData
              });
            } catch {
              // 忽略解析错误
            }
          }
        }

        if (!abortController.signal.aborted) {
          event.sender.send("openclaw:stream:chunk", {
            type: "done",
            content: fullContent
          });
        }
      } catch (streamError) {
        if ((streamError as Error).name !== "AbortError") {
          event.sender.send("openclaw:stream:chunk", {
            type: "error",
            error: (streamError as Error).message
          });
        }
      } finally {
        activeStreams.delete(webContentsId);
      }
    } catch (error) {
      console.error("Error in streaming query:", error);
      event.sender.send("openclaw:stream:chunk", {
        type: "error",
        error: (error as Error).message
      });
    }
  });

  // 取消流式请求
  ipcMain.on("openclaw:query:stream:cancel", (event: IpcMainEvent) => {
    const webContentsId = event.sender.id;
    const abortController = activeStreams.get(webContentsId);
    if (abortController) {
      abortController.abort();
      activeStreams.delete(webContentsId);
    }
  });

}
