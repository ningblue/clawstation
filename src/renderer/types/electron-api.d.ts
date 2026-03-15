// Electron API 类型定义
// 解决 electronAPI 重复声明问题，统一在此文件中定义

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface ElectronAPI {
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
  updateConversation: (
    conversationId: number,
    conversationData: any
  ) => Promise<any>;
  deleteConversation: (conversationId: number) => Promise<boolean>;

  // 消息相关API
  createMessage: (messageData: any) => Promise<any>;
  getMessagesByConversation: (conversationId: number) => Promise<any[]>;
  getLatestMessages: (params: {
    conversationId: number;
    limit: number;
  }) => Promise<any[]>;
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
  showErrorDialog: (options: {
    title: string;
    message: string;
  }) => Promise<void>;

  // 确认对话框
  showConfirmDialog: (options: {
    title: string;
    message: string;
    buttons?: string[];
    defaultId?: number;
    cancelId?: number;
  }) => Promise<number>;

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
  sendQueryToOpenClaw: (
    message: string,
    conversationId?: number
  ) => Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }>;
  sendQueryToOpenClawStream: (
    message: string,
    conversationId?: number,
    onChunk?: (chunk: string) => void,
    onToolCall?: (tool: {
      name: string;
      arguments: Record<string, unknown>;
    }) => void,
    onDone?: (fullContent: string, toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>) => void,
    onError?: (error: string) => void
  ) => () => void;
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

  // AI 引擎进程管理
  getOpenClawProcessInfo: () => Promise<{
    success: boolean;
    info?: {
      processName: string;
      pid: number | null;
      port: number;
      isExternal: boolean;
      isRunning: boolean;
      uptime: number;
    };
    error?: string;
  }>;
  cleanupOpenClawProcesses: () => Promise<{
    success: boolean;
    killed: number;
    error?: string;
  }>;
  repairOpenClaw: () => Promise<{
    success: boolean;
    message: string;
  }>;

  // 审计日志相关API
  getAuditLogs: (params?: { limit?: number; offset?: number }) => Promise<{
    success: boolean;
    logs?: any[];
    error?: string;
  }>;
  getAuditLogsByUser: (
    userId: number,
    limit?: number
  ) => Promise<{
    success: boolean;
    logs?: any[];
    error?: string;
  }>;
  getAuditLogsByAction: (
    action: string,
    limit?: number
  ) => Promise<{
    success: boolean;
    logs?: any[];
    error?: string;
  }>;
  exportAuditLogs: (params?: {
    format?: "json" | "csv";
    limit?: number;
  }) => Promise<{
    success: boolean;
    data?: string;
    format?: string;
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
  setAgent: (agent: any) => Promise<{ success: boolean; error?: string }>;
  removeAgent: (
    agentId: string
  ) => Promise<{ success: boolean; error?: string }>;
  setDefaultAgent: (
    agentId: string
  ) => Promise<{ success: boolean; error?: string }>;
  setDefaultModel: (model: {
    primary: string;
    fallbacks?: string[];
  }) => Promise<{ success: boolean; error?: string }>;

  // OpenClaw API Key 管理API
  setApiKey: (
    provider: string,
    apiKey: string,
    agentId?: string,
    endpoint?: string
  ) => Promise<{ success: boolean; error?: string }>;
  hasApiKey: (
    provider: string,
    agentId?: string
  ) => Promise<{ success: boolean; hasKey?: boolean; error?: string }>;
  getConfiguredProviders: (
    agentId?: string
  ) => Promise<{ success: boolean; providers?: string[]; error?: string }>;
  removeApiKey: (
    provider: string,
    agentId?: string
  ) => Promise<{ success: boolean; error?: string }>;

  // MiniMax OAuth API
  miniMaxOAuthStart: (region?: 'cn' | 'global') => Promise<{
    success: boolean;
    userCode?: string;
    verificationUri?: string;
    expiresAt?: number;
    error?: string;
  }>;
  miniMaxOAuthPoll: () => Promise<{
    success: boolean;
    pending?: boolean;
    token?: {
      access: string;
      resourceUrl?: string;
      notification?: string;
    };
    error?: string;
  }>;
  miniMaxOAuthCancel: () => Promise<{ success: boolean; error?: string }>;
  miniMaxOAuthStatus: () => Promise<{
    success: boolean;
    configured?: boolean;
    hasSavedToken?: boolean;
    region?: 'cn' | 'global';
    error?: string;
  }>;
  miniMaxOAuthClear: () => Promise<{ success: boolean; error?: string }>;

  // OpenClaw 模型管理API（配置文件中的模型）
  getModelsList: () => Promise<{
    success: boolean;
    models?: Array<{
      provider: string;
      id: string;
      name: string;
      contextWindow?: number;
      maxTokens?: number;
    }>;
    error?: string;
  }>;
  getProvidersList: () => Promise<{
    success: boolean;
    providers?: Record<
      string,
      { baseUrl?: string; api?: string; models?: any[] }
    >;
    error?: string;
  }>;
  getAuthProfiles: (agentId?: string) => Promise<{
    success: boolean;
    profiles?: Array<{ provider: string; hasKey: boolean }>;
    error?: string;
  }>;

  // OpenClaw 模型目录API（全量服务商和模型）
  getModelCatalog: () => Promise<{
    success: boolean;
    models?: Array<{
      id: string;
      name: string;
      provider: string;
      contextWindow?: number;
      reasoning?: boolean;
      input?: string[];
    }>;
    error?: string;
  }>;
  getCatalogProviders: () => Promise<{
    success: boolean;
    providers?: Array<{ id: string; name: string }>;
    error?: string;
  }>;
  getCatalogModelsByProvider: (providerId: string) => Promise<{
    success: boolean;
    models?: Array<{
      id: string;
      name: string;
      provider: string;
      contextWindow?: number;
      reasoning?: boolean;
      input?: string[];
    }>;
    error?: string;
  }>;

  // 监听主进程发送的消息
  onOpenClawReady: (callback: (event: any, data: any) => void) => void;
  removeOpenClawReadyListener: (
    callback: (event: any, data: any) => void
  ) => void;
  onNewConversation: (callback: () => void) => void;
  onToggleSearch: (callback: () => void) => void;

  // 移除监听器
  removeNewConversationListener: (callback: () => void) => void;
  removeToggleSearchListener: (callback: () => void) => void;

  // Tool 事件监听（来自 OpenClaw WebSocket）
  onToolEvent: (callback: (event: any, data: any) => void) => void;
  removeToolEventListener: (callback: (event: any, data: any) => void) => void;

  // 窗口控制 API
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
}

// 用户类型
export interface User {
  id: number;
  username: string;
  email: string;
  preferences?: UserPreferences;
  createdAt?: string;
  updatedAt?: string;
}

// 用户偏好设置
export interface UserPreferences {
  theme?: "light" | "dark";
  locale?: string;
  fontSize?: "small" | "medium" | "large";
}

// 会话类型
export interface Conversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// 消息类型
export interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

// 审计日志类型
export interface AuditLog {
  id: number;
  userId?: number;
  action: string;
  level: "INFO" | "WARN" | "ERROR";
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// 引擎状态类型
export interface EngineStatus {
  isRunning: boolean;
  isHealthy: boolean;
  pid?: number;
  uptime?: number;
  version?: string;
  error?: string;
  port: number;
}

// 窗口控制 API
export interface WindowControlsAPI {
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
}

export {};
