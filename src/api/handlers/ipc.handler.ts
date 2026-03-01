// src/api/handlers/ipc.handler.ts

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ApiResponse, ErrorCode, IpcChannel } from '../types';

/**
 * IPC 处理器封装
 * 提供统一的错误处理、响应格式和日志记录
 */

/**
 * IPC 处理器选项
 */
export interface IpcHandlerOptions {
  /** 是否记录审计日志 */
  auditLog?: boolean;
  /** 操作名称（用于审计日志） */
  operationName?: string;
  /** 是否验证输入 */
  validateInput?: boolean;
}

/**
 * 创建标准化的 IPC 处理器
 * 统一处理错误和响应格式
 */
export function createIpcHandler<T = any>(
  channel: IpcChannel | string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>,
  options: IpcHandlerOptions = {}
): void {
  const wrappedHandler = async (
    event: IpcMainInvokeEvent,
    ...args: any[]
  ): Promise<ApiResponse<T>> => {
    const startTime = Date.now();

    try {
      // 记录请求日志
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[IPC] ${channel} called with args:`, args);
      }

      // 执行实际处理器
      const result = await handler(event, ...args);

      // 计算执行时间
      const duration = Date.now() - startTime;

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[IPC] ${channel} completed in ${duration}ms`);
      }

      // 返回标准化响应
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // 计算执行时间（即使出错）
      const duration = Date.now() - startTime;

      console.error(`[IPC] ${channel} failed after ${duration}ms:`, error);

      // 转换错误为标准化响应
      return errorToResponse(error);
    }
  };

  // 注册 IPC 处理器
  ipcMain.handle(channel, wrappedHandler);
}

/**
 * 创建带输入验证的 IPC 处理器
 */
export function createValidatedIpcHandler<T = any>(
  channel: IpcChannel | string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>,
  validator: (...args: any[]) => string | null,
  options: IpcHandlerOptions = {}
): void {
  const wrappedHandler = async (
    event: IpcMainInvokeEvent,
    ...args: any[]
  ): Promise<ApiResponse<T>> => {
    try {
      // 验证输入
      const validationError = validator(...args);
      if (validationError) {
        return {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: validationError,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 执行实际处理器
      const result = await handler(event, ...args);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error(`[IPC] ${channel} failed:`, error);
      return errorToResponse(error);
    }
  };

  ipcMain.handle(channel, wrappedHandler);
}

/**
 * 将错误转换为标准化响应
 */
function errorToResponse(error: unknown): ApiResponse {
  // 如果是已格式化的 API 错误，直接使用
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return {
      success: false,
      error: {
        code: (error as any).code || ErrorCode.UNKNOWN_ERROR,
        message: (error as any).message || 'Unknown error',
        details: (error as any).details,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 根据错误类型映射错误代码
  let errorCode = ErrorCode.UNKNOWN_ERROR;
  let errorMessage = 'An unexpected error occurred';

  if (error instanceof Error) {
    errorMessage = error.message;

    // 根据错误消息内容推断错误类型
    const message = error.message.toLowerCase();
    if (message.includes('not found') || message.includes('does not exist')) {
      errorCode = ErrorCode.NOT_FOUND;
    } else if (message.includes('already exists') || message.includes('duplicate')) {
      errorCode = ErrorCode.ALREADY_EXISTS;
    } else if (message.includes('invalid') || message.includes('validation')) {
      errorCode = ErrorCode.VALIDATION_ERROR;
    } else if (message.includes('unauthorized') || message.includes('authentication')) {
      errorCode = ErrorCode.UNAUTHORIZED;
    } else if (message.includes('permission') || message.includes('forbidden')) {
      errorCode = ErrorCode.FORBIDDEN;
    } else if (message.includes('database') || message.includes('sql')) {
      errorCode = ErrorCode.DATABASE_ERROR;
    }
  }

  return {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 移除 IPC 处理器
 */
export function removeIpcHandler(channel: IpcChannel | string): void {
  ipcMain.removeHandler(channel);
}

/**
 * 批量注册 IPC 处理器
 */
export function registerIpcHandlers(
  handlers: Array<{
    channel: IpcChannel | string;
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>;
    options?: IpcHandlerOptions;
  }>
): void {
  handlers.forEach(({ channel, handler, options }) => {
    createIpcHandler(channel, handler, options);
  });
}

/**
 * 通用的 ID 验证器
 */
export function validateId(id: any, fieldName: string = 'ID'): string | null {
  if (id === undefined || id === null) {
    return `${fieldName} is required`;
  }

  const numId = typeof id === 'string' ? parseInt(id, 10) : id;

  if (isNaN(numId) || numId <= 0) {
    return `Invalid ${fieldName.toLowerCase()}`;
  }

  return null;
}

/**
 * 通用的字符串验证器
 */
export function validateString(
  value: any,
  fieldName: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): string | null {
  const { required = true, minLength, maxLength } = options;

  if (required && (!value || typeof value !== 'string' || value.trim().length === 0)) {
    return `${fieldName} is required`;
  }

  if (value && typeof value === 'string') {
    const trimmed = value.trim();

    if (minLength !== undefined && trimmed.length < minLength) {
      return `${fieldName} must be at least ${minLength} characters`;
    }

    if (maxLength !== undefined && trimmed.length > maxLength) {
      return `${fieldName} must not exceed ${maxLength} characters`;
    }
  }

  return null;
}

/**
 * 创建分页响应元数据
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): { page: number; limit: number; total: number; offset: number } {
  return {
    page,
    limit,
    total,
    offset: (page - 1) * limit,
  };
}
