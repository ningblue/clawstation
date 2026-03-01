// src/api/routes/message.route.ts

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { MessageService } from '../../backend/services/message.service';
import { validateInput } from '../../backend/services/security.service';
import { logAudit } from '../../backend/services/audit.service';
import { AuditAction, AuditLevel } from '../../models/audit.model';

/**
 * 消息相关的API路由
 */
export function setupMessageRoutes(): void {
  // 创建消息
  ipcMain.handle('message:create', async (event: IpcMainInvokeEvent, messageData: any) => {
    try {
      // 验证和清理输入
      const validatedMessageData = {
        conversationId: messageData.conversationId,
        role: messageData.role,
        content: validateInput(messageData.content, 10000)
      };

      // 验证角色值
      if (!['user', 'assistant'].includes(validatedMessageData.role)) {
        throw new Error('Invalid message role');
      }

      // 创建消息
      const message = await MessageService.createMessage(validatedMessageData);

      // 记录审计日志
      await logAudit({
        userId: undefined, // 暂时不确定用户ID
        action: AuditAction.MESSAGE_SEND,
        level: AuditLevel.INFO,
        details: `Message sent to conversation ${message.conversationId}`,
        ipAddress: event.sender.getURL() // 简化的IP获取
      });

      return message;
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  });

  // 获取会话消息
  ipcMain.handle('message:get-by-conversation', async (event: IpcMainInvokeEvent, conversationId: number) => {
    try {
      if (!conversationId || conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      return await MessageService.getMessagesByConversationId(conversationId);
    } catch (error) {
      console.error('Error getting messages by conversation:', error);
      throw error;
    }
  });

  // 获取最新消息
  ipcMain.handle('message:get-latest', async (event: IpcMainInvokeEvent, params: { conversationId: number, limit: number }) => {
    try {
      if (!params.conversationId || params.conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      if (!params.limit || params.limit <= 0 || params.limit > 100) {
        params.limit = 10; // 默认值
      }

      return await MessageService.getLatestMessages(params.conversationId, params.limit);
    } catch (error) {
      console.error('Error getting latest messages:', error);
      throw error;
    }
  });

  // 获取消息
  ipcMain.handle('message:get', async (event: IpcMainInvokeEvent, messageId: number) => {
    try {
      if (!messageId || messageId <= 0) {
        throw new Error('Invalid message ID');
      }

      return await MessageService.getMessageById(messageId);
    } catch (error) {
      console.error('Error getting message:', error);
      throw error;
    }
  });

  // 删除消息
  ipcMain.handle('message:delete', async (event: IpcMainInvokeEvent, messageId: number) => {
    try {
      if (!messageId || messageId <= 0) {
        throw new Error('Invalid message ID');
      }

      const success = await MessageService.deleteMessage(messageId);
      return success;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  });
}