// src/api/middleware/error.middleware.ts
// 统一错误处理中间件

import { IpcMainInvokeEvent } from 'electron';
import { ApiResponse, ErrorCode, createErrorResponse } from '../types/response.types';

/**
 * 应用错误基类
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * 未找到错误
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    super(
      ErrorCode.NOT_FOUND,
      `${resource} not found${id ? `: ${id}` : ''}`,
      id ? { resource, id } : { resource }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * IPC 处理器包装器
 * 统一处理错误并返回标准响应格式
 */
export function handleIpcError<T>(
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>
): (event: IpcMainInvokeEvent, ...args: any[]) => Promise<ApiResponse<T>> {
  return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<ApiResponse<T>> => {
    try {
      const result = await handler(event, ...args);
      return {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('IPC handler error:', error);

      if (error instanceof AppError) {
        return createErrorResponse(error.code, error.message, error.details) as ApiResponse<T>;
      }

      if (error instanceof Error) {
        return createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          error.message,
          { stack: error.stack }
        ) as ApiResponse<T>;
      }

      return createErrorResponse(
        ErrorCode.UNKNOWN_ERROR,
        'An unknown error occurred'
      ) as ApiResponse<T>;
    }
  };
}

/**
 * 全局错误处理器
 */
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // 记录到审计日志
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // 记录到审计日志
  });
}
