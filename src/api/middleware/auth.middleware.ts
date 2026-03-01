// src/api/middleware/auth.middleware.ts

import { IpcMainInvokeEvent } from 'electron';
import { AuthContext, ApiResponse, ErrorCode } from '../types';
import { UserService } from '../../backend/services/user.service';

/**
 * 认证中间件
 * 处理用户认证和权限验证
 */

// 简单的会话存储（实际应用中应该使用更安全的存储方式）
const sessions = new Map<string, AuthContext>();

/**
 * 创建认证上下文
 */
export async function createAuthContext(userId: number): Promise<AuthContext> {
  const user = await UserService.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return {
    userId: user.id,
    username: user.username,
    isAuthenticated: true,
    permissions: ['read', 'write'] // 简化权限模型
  };
}

/**
 * 验证用户是否已认证
 * 在 Electron 桌面应用中，认证主要基于本地用户会话
 */
export function requireAuth(
  handler: (event: IpcMainInvokeEvent, authContext: AuthContext, ...args: any[]) => Promise<any>
): (event: IpcMainInvokeEvent, ...args: any[]) => Promise<ApiResponse> {
  return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<ApiResponse> => {
    try {
      // 从第一个参数获取 userId（简化实现）
      // 实际应用中应该从安全的会话存储中获取
      const userId = extractUserIdFromArgs(args);

      if (!userId) {
        return {
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        };
      }

      const authContext = await createAuthContext(userId);

      if (!authContext.isAuthenticated) {
        return {
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Invalid or expired session',
            timestamp: new Date().toISOString()
          }
        };
      }

      // 调用实际的处理函数
      const result = await handler(event, authContext, ...args);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Auth middleware error:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Authentication check failed',
          details: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      };
    }
  };
}

/**
 * 可选认证 - 不强制要求认证，但提供认证上下文（如果可用）
 */
export function optionalAuth(
  handler: (event: IpcMainInvokeEvent, authContext: AuthContext | null, ...args: any[]) => Promise<any>
): (event: IpcMainInvokeEvent, ...args: any[]) => Promise<ApiResponse> {
  return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<ApiResponse> => {
    try {
      const userId = extractUserIdFromArgs(args);
      let authContext: AuthContext | null = null;

      if (userId) {
        try {
          authContext = await createAuthContext(userId);
        } catch {
          // 认证失败但不阻止操作
          authContext = null;
        }
      }

      const result = await handler(event, authContext, ...args);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Request processing failed',
          details: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      };
    }
  };
}

/**
 * 验证特定权限
 */
export function requirePermission(
  permission: string,
  handler: (event: IpcMainInvokeEvent, authContext: AuthContext, ...args: any[]) => Promise<any>
): (event: IpcMainInvokeEvent, ...args: any[]) => Promise<ApiResponse> {
  return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<ApiResponse> => {
    try {
      const userId = extractUserIdFromArgs(args);

      if (!userId) {
        return {
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        };
      }

      const authContext = await createAuthContext(userId);

      if (!authContext.isAuthenticated) {
        return {
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Invalid or expired session',
            timestamp: new Date().toISOString()
          }
        };
      }

      if (!authContext.permissions?.includes(permission)) {
        return {
          success: false,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: `Permission '${permission}' required`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const result = await handler(event, authContext, ...args);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Permission middleware error:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Permission check failed',
          details: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      };
    }
  };
}

/**
 * 从参数中提取用户 ID
 * 简化实现：假设第一个参数或参数对象的 userId 字段包含用户 ID
 */
function extractUserIdFromArgs(args: any[]): number | undefined {
  if (args.length === 0) return undefined;

  const firstArg = args[0];

  // 如果是数字，直接返回
  if (typeof firstArg === 'number') {
    return firstArg;
  }

  // 如果是对象，尝试获取 userId
  if (typeof firstArg === 'object' && firstArg !== null) {
    return firstArg.userId || firstArg.user_id;
  }

  return undefined;
}

/**
 * 设置当前会话（用于登录）
 */
export function setSession(sessionId: string, authContext: AuthContext): void {
  sessions.set(sessionId, authContext);
}

/**
 * 获取会话
 */
export function getSession(sessionId: string): AuthContext | undefined {
  return sessions.get(sessionId);
}

/**
 * 清除会话（用于登出）
 */
export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}
