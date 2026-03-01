// src/api/routes/conversation.route.ts

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ConversationService } from '../../backend/services/conversation.service';
import { validateInput } from '../../backend/services/security.service';
import { logAudit } from '../../backend/services/audit.service';
import { AuditAction, AuditLevel } from '../../models/audit.model';

/**
 * 会话相关的API路由
 */
export function setupConversationRoutes(): void {
  // 创建会话
  ipcMain.handle('conversation:create', async (event: IpcMainInvokeEvent, conversationData: any) => {
    try {
      // 验证和清理输入
      const validatedConversationData = {
        userId: conversationData.userId,
        title: validateInput(conversationData.title, 200) || 'New Conversation'
      };

      // 创建会话
      const conversation = await ConversationService.createConversation(validatedConversationData);

      // 记录审计日志
      await logAudit({
        userId: conversation.userId,
        action: AuditAction.CONVERSATION_CREATE,
        level: AuditLevel.INFO,
        details: `Conversation created: ${conversation.title}`,
        ipAddress: event.sender.getURL() // 简化的IP获取
      });

      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  });

  // 获取会话
  ipcMain.handle('conversation:get', async (event: IpcMainInvokeEvent, conversationId: number) => {
    try {
      if (!conversationId || conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      return await ConversationService.getConversationById(conversationId);
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  });

  // 获取用户的所有会话
  ipcMain.handle('conversation:list', async (event: IpcMainInvokeEvent, userId: number) => {
    try {
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      return await ConversationService.getConversationsByUserId(userId);
    } catch (error) {
      console.error('Error listing conversations:', error);
      throw error;
    }
  });

  // 更新会话
  ipcMain.handle('conversation:update', async (event: IpcMainInvokeEvent, conversationId: number, conversationData: any) => {
    try {
      if (!conversationId || conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      // 验证和清理输入
      const validatedData: any = {};
      if (conversationData.title) {
        validatedData.title = validateInput(conversationData.title, 200);
      }

      return await ConversationService.updateConversation(conversationId, validatedData);
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  });

  // 删除会话
  ipcMain.handle('conversation:delete', async (event: IpcMainInvokeEvent, conversationId: number) => {
    try {
      if (!conversationId || conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      const success = await ConversationService.deleteConversation(conversationId);
      return success;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  });
}