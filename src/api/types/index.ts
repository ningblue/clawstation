// src/api/types/index.ts

/**
 * API 统一的请求/响应类型定义
 * 遵循 BMAD 架构规范
 */

/**
 * 标准 API 响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API 错误信息
 */
export interface ApiError {
  code: string;
  message: string;
  details?: string;
  timestamp: string;
}

/**
 * 响应元数据（分页等）
 */
export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  offset?: number;
}

/**
 * IPC 处理器函数类型
 */
export type IpcHandler<T = any, R = any> = (
  event: Electron.IpcMainInvokeEvent,
  ...args: T[]
) => Promise<R>;

/**
 * 包装后的 IPC 处理器
 */
export type WrappedIpcHandler = (
  event: Electron.IpcMainInvokeEvent,
  ...args: any[]
) => Promise<ApiResponse>;

/**
 * 认证上下文
 */
export interface AuthContext {
  userId: number;
  username: string;
  isAuthenticated: boolean;
  permissions?: string[];
}

/**
 * IPC 通道定义
 */
export enum IpcChannel {
  // 用户相关
  USER_CREATE = 'user:create',
  USER_GET = 'user:get',
  USER_GET_BY_USERNAME = 'user:get-by-username',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_LIST = 'user:list',

  // 会话相关
  CONVERSATION_CREATE = 'conversation:create',
  CONVERSATION_GET = 'conversation:get',
  CONVERSATION_LIST = 'conversation:list',
  CONVERSATION_UPDATE = 'conversation:update',
  CONVERSATION_DELETE = 'conversation:delete',

  // 消息相关
  MESSAGE_CREATE = 'message:create',
  MESSAGE_GET = 'message:get',
  MESSAGE_GET_BY_CONVERSATION = 'message:get-by-conversation',
  MESSAGE_GET_LATEST = 'message:get-latest',
  MESSAGE_DELETE = 'message:delete',

  // OpenClaw 相关
  OPENCLAW_STATUS = 'openclaw:status',
  OPENCLAW_QUERY = 'openclaw:query',
  OPENCLAW_RESTART = 'openclaw:restart',

  // 审计相关
  AUDIT_GET_LOGS = 'audit:get-logs',
  AUDIT_GET_LOGS_BY_USER = 'audit:get-logs-by-user',
  AUDIT_GET_LOGS_BY_ACTION = 'audit:get-logs-by-action',
  AUDIT_CLEANUP = 'audit:cleanup',
  AUDIT_EXPORT = 'audit:export',

  // 应用相关
  APP_EXIT = 'app-exit',
  APP_RESTART = 'app-restart',
  APP_GET_INFO = 'get-app-info',
  APP_OPEN_EXTERNAL = 'open-external-url',
  APP_SHOW_ERROR = 'show-error-dialog',

  // 菜单事件
  MENU_NEW_CONVERSATION = 'new-conversation',
  MENU_TOGGLE_SEARCH = 'toggle-search'
}

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // 认证错误
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // 业务错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',

  // 系统错误
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
