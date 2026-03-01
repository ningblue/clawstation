// src/api/routes/user.route.ts

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { UserService } from '../../backend/services/user.service';
import { validateInput } from '../../backend/services/security.service';
import { logAudit } from '../../backend/services/audit.service';
import { AuditAction, AuditLevel } from '../../models/audit.model';

/**
 * 用户相关的API路由
 */
export function setupUserRoutes(): void {
  // 创建用户
  ipcMain.handle('user:create', async (event: IpcMainInvokeEvent, userData: any) => {
    try {
      // 验证和清理输入
      const validatedUserData = {
        username: validateInput(userData.username, 50),
        email: validateInput(userData.email, 100),
        preferences: userData.preferences || {}
      };

      // 创建用户
      const user = await UserService.createUser(validatedUserData);

      // 记录审计日志
      await logAudit({
        userId: user.id,
        action: AuditAction.USER_LOGIN,
        level: AuditLevel.INFO,
        details: `User account created: ${user.username}`,
        ipAddress: event.sender.getURL() // 简化的IP获取
      });

      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  });

  // 获取用户
  ipcMain.handle('user:get', async (event: IpcMainInvokeEvent, userId: number) => {
    try {
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      return await UserService.getUserById(userId);
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  });

  // 获取用户（按用户名）
  ipcMain.handle('user:get-by-username', async (event: IpcMainInvokeEvent, username: string) => {
    try {
      if (!username) {
        throw new Error('Username is required');
      }

      const validatedUsername = validateInput(username, 50);
      return await UserService.getUserByUsername(validatedUsername);
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  });

  // 更新用户
  ipcMain.handle('user:update', async (event: IpcMainInvokeEvent, userId: number, userData: any) => {
    try {
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      // 验证和清理输入
      const validatedUserData: any = {};
      if (userData.username) {
        validatedUserData.username = validateInput(userData.username, 50);
      }
      if (userData.email) {
        validatedUserData.email = validateInput(userData.email, 100);
      }
      if (userData.preferences) {
        validatedUserData.preferences = userData.preferences;
      }

      return await UserService.updateUser(userId, validatedUserData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  });

  // 删除用户
  ipcMain.handle('user:delete', async (event: IpcMainInvokeEvent, userId: number) => {
    try {
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      const success = await UserService.deleteUser(userId);
      return success;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  });

  // 获取所有用户
  ipcMain.handle('user:list', async (event: IpcMainInvokeEvent) => {
    try {
      return await UserService.getAllUsers();
    } catch (error) {
      console.error('Error listing users:', error);
      throw error;
    }
  });
}