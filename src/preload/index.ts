import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // 通用调用方法
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

  // 用户相关API
  createUser: (userData: any) => ipcRenderer.invoke('user:create', userData),
  getUserById: (userId: number) => ipcRenderer.invoke('user:get', userId),
  getUserByUsername: (username: string) => ipcRenderer.invoke('user:get-by-username', username),
  updateUser: (userId: number, userData: any) => ipcRenderer.invoke('user:update', userId, userData),
  deleteUser: (userId: number) => ipcRenderer.invoke('user:delete', userId),
  listUsers: () => ipcRenderer.invoke('user:list'),

  // 会话相关API
  createConversation: (conversationData: any) => ipcRenderer.invoke('conversation:create', conversationData),
  getConversation: (conversationId: number) => ipcRenderer.invoke('conversation:get', conversationId),
  listConversations: (userId: number) => ipcRenderer.invoke('conversation:list', userId),
  updateConversation: (conversationId: number, conversationData: any) => ipcRenderer.invoke('conversation:update', conversationId, conversationData),
  deleteConversation: (conversationId: number) => ipcRenderer.invoke('conversation:delete', conversationId),

  // 消息相关API
  createMessage: (messageData: any) => ipcRenderer.invoke('message:create', messageData),
  getMessagesByConversation: (conversationId: number) => ipcRenderer.invoke('message:get-by-conversation', conversationId),
  getLatestMessages: (params: { conversationId: number, limit: number }) => ipcRenderer.invoke('message:get-latest', params),
  getMessage: (messageId: number) => ipcRenderer.invoke('message:get', messageId),
  deleteMessage: (messageId: number) => ipcRenderer.invoke('message:delete', messageId),

  // 应用程序交互
  appExit: () => ipcRenderer.invoke('app-exit'),
  appRestart: () => ipcRenderer.invoke('app-restart'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // 外部链接处理
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),

  // 错误对话框
  showErrorDialog: (options: { title: string; message: string }) =>
    ipcRenderer.invoke('show-error-dialog', options),

  // OpenClaw AI引擎相关API
  getOpenClawStatus: () => ipcRenderer.invoke('openclaw:status'),
  sendQueryToOpenClaw: (message: string, conversationId?: number) => ipcRenderer.invoke('openclaw:query', message, conversationId),
  startOpenClaw: () => ipcRenderer.invoke('openclaw:start'),
  stopOpenClaw: () => ipcRenderer.invoke('openclaw:stop'),
  restartOpenClaw: () => ipcRenderer.invoke('openclaw:restart'),

  // OpenClaw 配置管理API
  getOpenClawConfig: () => ipcRenderer.invoke('openclaw:config:get'),
  getGatewayConfig: () => ipcRenderer.invoke('openclaw:config:gateway'),
  getAgentsConfig: () => ipcRenderer.invoke('openclaw:config:agents'),
  getDefaultAgent: () => ipcRenderer.invoke('openclaw:config:defaultAgent'),
  setAgent: (agent: any) => ipcRenderer.invoke('openclaw:config:agent:set', agent),
  removeAgent: (agentId: string) => ipcRenderer.invoke('openclaw:config:agent:remove', agentId),
  setDefaultAgent: (agentId: string) => ipcRenderer.invoke('openclaw:config:agent:setDefault', agentId),

  // OpenClaw API Key 管理API
  setApiKey: (provider: string, apiKey: string, agentId?: string) => ipcRenderer.invoke('openclaw:apikey:set', provider, apiKey, agentId),
  hasApiKey: (provider: string, agentId?: string) => ipcRenderer.invoke('openclaw:apikey:has', provider, agentId),
  getConfiguredProviders: (agentId?: string) => ipcRenderer.invoke('openclaw:apikey:providers', agentId),
  removeApiKey: (provider: string, agentId?: string) => ipcRenderer.invoke('openclaw:apikey:remove', provider, agentId),

  // OpenClaw 模型管理API
  getModelsList: () => ipcRenderer.invoke('openclaw:models:list'),
  getProvidersList: () => ipcRenderer.invoke('openclaw:providers:list'),
  getAuthProfiles: (agentId?: string) => ipcRenderer.invoke('openclaw:auth:profiles', agentId),

  // OpenClaw 当前模型配置API
  getCurrentModelConfig: () => ipcRenderer.invoke('openclaw:config:currentModel'),

  // OpenClaw 模型目录API（全量服务商和模型）
  getModelCatalog: () => ipcRenderer.invoke('openclaw:catalog:list'),
  getCatalogProviders: () => ipcRenderer.invoke('openclaw:catalog:providers'),
  getCatalogModelsByProvider: (providerId: string) => ipcRenderer.invoke('openclaw:catalog:modelsByProvider', providerId),

  // 审计日志相关API
  getAuditLogs: (params?: { limit?: number; offset?: number }) => ipcRenderer.invoke('audit:get-logs', params),
  getAuditLogsByUser: (userId: number, limit?: number) => ipcRenderer.invoke('audit:get-logs-by-user', userId, limit),
  getAuditLogsByAction: (action: string, limit?: number) => ipcRenderer.invoke('audit:get-logs-by-action', action, limit),
  exportAuditLogs: (params?: { format?: 'json' | 'csv'; limit?: number }) => ipcRenderer.invoke('audit:export', params),

  // 监听主进程发送的消息
  onNewConversation: (callback: () => void) =>
    ipcRenderer.on('new-conversation', callback),

  onToggleSearch: (callback: () => void) =>
    ipcRenderer.on('toggle-search', callback),

  onOpenClawReady: (callback: (event: any, data: any) => void) =>
    ipcRenderer.on('openclaw:ready', callback),

  onOpenClawStatusChanged: (callback: (event: any, data: any) => void) =>
    ipcRenderer.on('openclaw:status-changed', callback),

  // 移除监听器
  removeNewConversationListener: (callback: () => void) =>
    ipcRenderer.removeListener('new-conversation', callback),

  removeToggleSearchListener: (callback: () => void) =>
    ipcRenderer.removeListener('toggle-search', callback),

  removeOpenClawReadyListener: (callback: (event: any, data: any) => void) =>
    ipcRenderer.removeListener('openclaw:ready', callback),

  removeOpenClawStatusChangedListener: (callback: (event: any, data: any) => void) =>
    ipcRenderer.removeListener('openclaw:status-changed', callback)
});

// 定义API接口以便在渲染进程中使用类型提示
declare global {
  interface Window {
    electronAPI: {
      // 通用调用方法
      invoke: (channel: string, ...args: any[]) => Promise<any>;

      // 用户相关API
      createUser: (userData: any) => Promise<any>;
      getUserById: (userId: number) => Promise<any>;
      getUserByUsername: (username: string) => Promise<any>;
      updateUser: (userId: number, userData: any) => Promise<any>;
      deleteUser: (userId: number) => Promise<boolean>;
      listUsers: () => Promise<any[]>;

      // 会话相关API
      createConversation: (conversationData: any) => Promise<any>;
      getConversation: (conversationId: number) => Promise<any>;
      listConversations: (userId: number) => Promise<any[]>;
      updateConversation: (conversationId: number, conversationData: any) => Promise<any>;
      deleteConversation: (conversationId: number) => Promise<boolean>;

      // 消息相关API
      createMessage: (messageData: any) => Promise<any>;
      getMessagesByConversation: (conversationId: number) => Promise<any[]>;
      getLatestMessages: (params: { conversationId: number, limit: number }) => Promise<any[]>;
      getMessage: (messageId: number) => Promise<any>;
      deleteMessage: (messageId: number) => Promise<boolean>;

      // 应用程序交互
      appExit: () => Promise<void>;
      appRestart: () => Promise<void>;
      getAppInfo: () => Promise<{
        name: string;
        version: string;
        platform: string;
      }>;

      // 外部链接处理
      openExternalUrl: (url: string) => Promise<void>;

      // 错误对话框
      showErrorDialog: (options: { title: string; message: string }) => Promise<void>;

      // OpenClaw AI引擎相关API
      getOpenClawStatus: () => Promise<{
        isRunning: boolean;
        isHealthy: boolean;
        pid?: number;
        uptime?: number;
        version?: string;
        error?: string;
        port: number;
      }>;
      sendQueryToOpenClaw: (message: string, conversationId?: number) => Promise<{
        success: boolean;
        response?: string;
        error?: string;
      }>;
      startOpenClaw: () => Promise<{
        success: boolean;
        error?: string;
      }>;
      stopOpenClaw: () => Promise<{
        success: boolean;
        error?: string;
      }>;
      restartOpenClaw: () => Promise<{
        success: boolean;
        error?: string;
      }>;

      // OpenClaw 配置管理API
      getOpenClawConfig: () => Promise<{
        success: boolean;
        config?: any;
        error?: string;
      }>;
      getGatewayConfig: () => Promise<{
        success: boolean;
        gateway?: any;
        error?: string;
      }>;
      getAgentsConfig: () => Promise<{
        success: boolean;
        agents?: any;
        error?: string;
      }>;
      getDefaultAgent: () => Promise<{
        success: boolean;
        agent?: any;
        error?: string;
      }>;
      setAgent: (agent: any) => Promise<{
        success: boolean;
        error?: string;
      }>;
      removeAgent: (agentId: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      setDefaultAgent: (agentId: string) => Promise<{
        success: boolean;
        error?: string;
      }>;

      // OpenClaw API Key 管理API
      setApiKey: (provider: string, apiKey: string, agentId?: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      hasApiKey: (provider: string, agentId?: string) => Promise<{
        success: boolean;
        hasKey?: boolean;
        error?: string;
      }>;
      getConfiguredProviders: (agentId?: string) => Promise<{
        success: boolean;
        providers?: string[];
        error?: string;
      }>;
      removeApiKey: (provider: string, agentId?: string) => Promise<{
        success: boolean;
        error?: string;
      }>;

      // OpenClaw 模型管理API
      getModelsList: () => Promise<{
        success: boolean;
        models?: Array<{ provider: string; id: string; name: string; contextWindow?: number; maxTokens?: number }>;
        error?: string;
      }>;
      getProvidersList: () => Promise<{
        success: boolean;
        providers?: Record<string, { baseUrl?: string; api?: string; models?: any[] }>;
        error?: string;
      }>;
      getAuthProfiles: (agentId?: string) => Promise<{
        success: boolean;
        profiles?: Array<{ provider: string; hasKey: boolean }>;
        error?: string;
      }>;

      // OpenClaw 当前模型配置API
      getCurrentModelConfig: () => Promise<{
        success: boolean;
        config?: { provider: string; model: string; agentId: string } | null;
        error?: string;
      }>;

      // OpenClaw 模型目录API（全量服务商和模型）
      getModelCatalog: () => Promise<{
        success: boolean;
        models?: Array<{ id: string; name: string; provider: string; contextWindow?: number; reasoning?: boolean; input?: string[] }>;
        error?: string;
      }>;
      getCatalogProviders: () => Promise<{
        success: boolean;
        providers?: Array<{ id: string; name: string }>;
        error?: string;
      }>;
      getCatalogModelsByProvider: (providerId: string) => Promise<{
        success: boolean;
        models?: Array<{ id: string; name: string; provider: string; contextWindow?: number; reasoning?: boolean; input?: string[] }>;
        error?: string;
      }>;

      // 审计日志相关API
      getAuditLogs: (params?: { limit?: number; offset?: number }) => Promise<{
        success: boolean;
        logs?: any[];
        error?: string;
      }>;
      getAuditLogsByUser: (userId: number, limit?: number) => Promise<{
        success: boolean;
        logs?: any[];
        error?: string;
      }>;
      getAuditLogsByAction: (action: string, limit?: number) => Promise<{
        success: boolean;
        logs?: any[];
        error?: string;
      }>;
      exportAuditLogs: (params?: { format?: 'json' | 'csv'; limit?: number }) => Promise<{
        success: boolean;
        data?: string;
        format?: string;
        error?: string;
      }>;

      // 监听主进程发送的消息
      onNewConversation: (callback: () => void) => void;
      onToggleSearch: (callback: () => void) => void;
      onOpenClawReady: (callback: (event: any, data: any) => void) => void;
      onOpenClawStatusChanged: (callback: (event: any, data: { isRunning: boolean; port: number }) => void) => void;

      // 移除监听器
      removeNewConversationListener: (callback: () => void) => void;
      removeToggleSearchListener: (callback: () => void) => void;
      removeOpenClawReadyListener: (callback: (event: any, data: any) => void) => void;
      removeOpenClawStatusChangedListener: (callback: (event: any, data: { isRunning: boolean; port: number }) => void) => void;
    };
  }
}