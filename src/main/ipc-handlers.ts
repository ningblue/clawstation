import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  getConversationsByUserId,
  getConversationById,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  getMessagesByConversationId,
  createMessage,
  deleteMessage,
  updateMessage,
  getMessage,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser
} from './database';
import { validateInput } from './security';
import {
  logMessageSend,
  logConfigUpdate,
  getAuditLogs,
  getAuditLogsByUser,
  getAuditLogsByAction,
  logUserLogin,
  logUserLogout
} from './audit';
import { Conversation, Message, User } from './database';

/**
 * 设置IPC处理器
 */
export function setupIpcHandlers(): void {
  // 用户相关IPC处理器
  setupUserHandlers();

  // 对话相关IPC处理器
  setupConversationHandlers();

  // 消息相关IPC处理器
  setupMessageHandlers();

  // 审计相关IPC处理器
  setupAuditHandlers();
}

/**
 * 用户相关IPC处理器
 */
function setupUserHandlers(): void {
  // 获取用户信息
  ipcMain.handle('get-user', async (event: IpcMainInvokeEvent, userId: number) => {
    try {
      return getUserById(userId);
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  });

  // 通过用户名获取用户
  ipcMain.handle('get-user-by-username', async (event: IpcMainInvokeEvent, username: string) => {
    try {
      return getUserByUsername(username);
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  });

  // 创建用户
  ipcMain.handle('create-user', async (event: IpcMainInvokeEvent, userData: { username: string; email: string; preferences?: object }) => {
    try {
      const validatedUsername = validateInput(userData.username, 50);
      const validatedEmail = validateInput(userData.email, 100);

      const newUser = createUser(validatedUsername, validatedEmail, userData.preferences);

      // 记录审计日志
      logConfigUpdate(newUser.id, 'USER_CREATION', 'PENDING', 'COMPLETED');

      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  });

  // 更新用户 (user:update - 匹配preload中的命名)
  ipcMain.handle('user:update', async (event: IpcMainInvokeEvent, userId: number, userData: { username?: string; email?: string; preferences?: object }) => {
    try {
      const updateData: any = {};

      if (userData.username !== undefined) {
        updateData.username = validateInput(userData.username, 50);
      }
      if (userData.email !== undefined) {
        updateData.email = validateInput(userData.email, 100);
      }
      if (userData.preferences !== undefined) {
        updateData.preferences = userData.preferences;
      }

      const updatedUser = updateUser(userId, updateData);

      if (updatedUser) {
        // 记录审计日志
        logConfigUpdate(userId, 'USER_UPDATE', 'PENDING', 'COMPLETED');
      }

      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  });

  // 获取用户 (user:get - 匹配preload中的命名)
  ipcMain.handle('user:get', async (event: IpcMainInvokeEvent, userId: number) => {
    try {
      return getUserById(userId);
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  });

  // 通过用户名获取用户 (user:get-by-username - 匹配preload中的命名)
  ipcMain.handle('user:get-by-username', async (event: IpcMainInvokeEvent, username: string) => {
    try {
      return getUserByUsername(username);
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  });

  // 创建用户 (user:create - 匹配preload中的命名)
  ipcMain.handle('user:create', async (event: IpcMainInvokeEvent, userData: { username: string; email: string; preferences?: object }) => {
    try {
      const validatedUsername = validateInput(userData.username, 50);
      const validatedEmail = validateInput(userData.email, 100);

      const newUser = createUser(validatedUsername, validatedEmail, userData.preferences);

      // 记录审计日志
      logConfigUpdate(newUser.id, 'USER_CREATION', 'PENDING', 'COMPLETED');

      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  });
}

/**
 * 对话相关IPC处理器
 */
function setupConversationHandlers(): void {
  // 获取用户的所有对话
  ipcMain.handle('get-user-conversations', async (event: IpcMainInvokeEvent, userId: number) => {
    try {
      return getConversationsByUserId(userId);
    } catch (error) {
      console.error('Error getting user conversations:', error);
      throw error;
    }
  });

  // 获取特定对话
  ipcMain.handle('get-conversation', async (event: IpcMainInvokeEvent, conversationId: number) => {
    try {
      return getConversationById(conversationId);
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  });

  // 创建新对话
  ipcMain.handle('create-conversation', async (event: IpcMainInvokeEvent, userId: number, title: string) => {
    try {
      const validatedTitle = validateInput(title, 200);
      return createConversation(userId, validatedTitle);
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  });

  // 更新对话标题
  ipcMain.handle('update-conversation-title', async (event: IpcMainInvokeEvent, id: number, title: string) => {
    try {
      const validatedTitle = validateInput(title, 200);
      const success = updateConversationTitle(id, validatedTitle);
      return success;
    } catch (error) {
      console.error('Error updating conversation title:', error);
      throw error;
    }
  });

  // 删除对话
  ipcMain.handle('delete-conversation', async (event: IpcMainInvokeEvent, id: number) => {
    try {
      return deleteConversation(id);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  });
}

/**
 * 消息相关IPC处理器
 */
function setupMessageHandlers(): void {
  // 获取对话的消息
  ipcMain.handle('get-conversation-messages', async (event: IpcMainInvokeEvent, conversationId: number) => {
    try {
      return getMessagesByConversationId(conversationId);
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      throw error;
    }
  });

  // 创建消息
  ipcMain.handle('create-message', async (event: IpcMainInvokeEvent, messageData: { conversationId: number; role: 'user' | 'assistant'; content: string }) => {
    try {
      const validatedContent = validateInput(messageData.content, 10000);

      const message = createMessage(
        messageData.conversationId,
        messageData.role,
        validatedContent
      );

      // 记录消息发送审计
      logMessageSend(message.conversationId, message.conversationId, message.id, message.content.length);

      return message;
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  });

  // 删除消息
  ipcMain.handle('message:delete', async (event: IpcMainInvokeEvent, messageId: number) => {
    try {
      return deleteMessage(messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  });

  // 更新消息
  ipcMain.handle('message:update', async (event: IpcMainInvokeEvent, messageId: number, content: string) => {
    try {
      const validatedContent = validateInput(content, 10000);
      return updateMessage(messageId, validatedContent);
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  });

  // 获取单条消息
  ipcMain.handle('message:get', async (event: IpcMainInvokeEvent, messageId: number) => {
    try {
      return getMessage(messageId);
    } catch (error) {
      console.error('Error getting message:', error);
      throw error;
    }
  });
}

/**
 * 审计相关IPC处理器
 */
function setupAuditHandlers(): void {
  // 获取审计日志
  ipcMain.handle('get-audit-logs', async (event: IpcMainInvokeEvent, limit: number = 100, offset: number = 0) => {
    try {
      return getAuditLogs(limit, offset);
    } catch (error) {
      console.error('Error getting audit logs:', error);
      throw error;
    }
  });

  // 根据用户获取审计日志
  ipcMain.handle('get-audit-logs-by-user', async (event: IpcMainInvokeEvent, userId: number, limit: number = 100) => {
    try {
      return getAuditLogsByUser(userId, limit);
    } catch (error) {
      console.error('Error getting audit logs by user:', error);
      throw error;
    }
  });

  // 根据操作类型获取审计日志
  ipcMain.handle('get-audit-logs-by-action', async (event: IpcMainInvokeEvent, action: string, limit: number = 100) => {
    try {
      // 这里需要导入AuditAction枚举，为了简化直接转换字符串
      return getAuditLogsByAction(action as any, limit);
    } catch (error) {
      console.error('Error getting audit logs by action:', error);
      throw error;
    }
  });

  // 记录用户登录
  ipcMain.handle('log-user-login', async (event: IpcMainInvokeEvent, userId: number, ipAddress?: string) => {
    try {
      logUserLogin(userId, ipAddress);
      return true;
    } catch (error) {
      console.error('Error logging user login:', error);
      throw error;
    }
  });

  // 记录用户登出
  ipcMain.handle('log-user-logout', async (event: IpcMainInvokeEvent, userId: number, ipAddress?: string) => {
    try {
      logUserLogout(userId, ipAddress);
      return true;
    } catch (error) {
      console.error('Error logging user logout:', error);
      throw error;
    }
  });
}