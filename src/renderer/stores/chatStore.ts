/**
 * 对话状态管理 Store
 * 管理对话状态、消息、当前会话等
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// 消息角色类型
export type MessageRole = 'user' | 'assistant' | 'system';

// 消息接口
export interface Message {
  id?: number;
  conversationId: number;
  role: MessageRole;
  content: string;
  createdAt?: string;
}

// 对话接口
export interface Conversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// 引擎状态接口
export interface EngineStatus {
  isRunning: boolean;
  isHealthy: boolean;
  pid?: number;
  uptime?: number;
  version?: string;
  error?: string;
  port: number;
}

/**
 * 对话状态管理 Hook
 */
export function useChatStore(userId: number | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engineCheckInterval = useRef<NodeJS.Timeout | null>(null);

  /**
   * 检查引擎状态
   */
  const checkEngineStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.getOpenClawStatus();
      setEngineStatus(status);
      return status;
    } catch (err) {
      console.error('Failed to check engine status:', err);
      const errorStatus: EngineStatus = {
        isRunning: false,
        isHealthy: false,
        error: '无法获取引擎状态',
        port: 0,
      };
      setEngineStatus(errorStatus);
      return errorStatus;
    }
  }, []);

  /**
   * 启动引擎状态检查
   */
  const startEngineStatusCheck = useCallback(() => {
    checkEngineStatus();
    if (engineCheckInterval.current) {
      clearInterval(engineCheckInterval.current);
    }
    engineCheckInterval.current = setInterval(checkEngineStatus, 5000);
  }, [checkEngineStatus]);

  /**
   * 停止引擎状态检查
   */
  const stopEngineStatusCheck = useCallback(() => {
    if (engineCheckInterval.current) {
      clearInterval(engineCheckInterval.current);
      engineCheckInterval.current = null;
    }
  }, []);

  /**
   * 重启引擎
   */
  const restartEngine = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.restartOpenClaw();
      if (result.success) {
        // 等待几秒后检查状态
        setTimeout(() => checkEngineStatus(), 3000);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Failed to restart engine:', err);
      return { success: false, error: err instanceof Error ? err.message : '重启失败' };
    } finally {
      setLoading(false);
    }
  }, [checkEngineStatus]);

  /**
   * 加载对话列表
   */
  const loadConversations = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const list = await window.electronAPI.invoke('conversation:list', userId);
      setConversations(list);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('加载对话列表失败');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * 加载对话消息
   */
  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      setLoading(true);
      const msgs = await window.electronAPI.invoke('message:get-by-conversation', conversationId);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('加载消息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 创建新对话 - 重置状态
   */
  const createConversation = useCallback(async (title?: string) => {
    if (!userId) return null;
    try {
      // 创建新对话时重置之前的状态
      setIsTyping(false);
      setLoading(true);
      const newConv = await window.electronAPI.invoke('conversation:create', {
        userId,
        title: title || `新对话 ${new Date().toLocaleTimeString()}`,
      });
      setConversations(prev => [newConv, ...prev]);
      setCurrentConversationId(newConv.id);
      setMessages([]);
      return newConv;
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError('创建对话失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * 选择对话 - 切换时重置所有状态，避免影响其他会话
   */
  const selectConversation = useCallback(async (conversationId: number) => {
    // 切换会话时重置打字和加载状态，避免其他会话受影响
    setIsTyping(false);
    setLoading(false);
    setCurrentConversationId(conversationId);
    await loadMessages(conversationId);
  }, [loadMessages]);

  /**
   * 重命名对话
   */
  const renameConversation = useCallback(async (conversationId: number, newTitle: string) => {
    try {
      await window.electronAPI.invoke('conversation:update', conversationId, { title: newTitle });
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId ? { ...conv, title: newTitle } : conv
        )
      );
      return true;
    } catch (err) {
      console.error('Failed to rename conversation:', err);
      setError('重命名对话失败');
      return false;
    }
  }, []);

  /**
   * 删除对话
   */
  const deleteConversation = useCallback(async (conversationId: number) => {
    try {
      await window.electronAPI.invoke('conversation:delete', conversationId);
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      return true;
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError('删除对话失败');
      return false;
    }
  }, [currentConversationId]);

  /**
   * 添加消息到当前对话
   */
  const addMessage = useCallback(async (role: MessageRole, content: string) => {
    if (!currentConversationId) return null;
    try {
      const message = await window.electronAPI.invoke('message:create', {
        conversationId: currentConversationId,
        role,
        content,
      });
      setMessages(prev => [...prev, message]);
      return message;
    } catch (err) {
      console.error('Failed to add message:', err);
      return null;
    }
  }, [currentConversationId]);

  /**
   * 删除消息
   */
  const deleteMessage = useCallback(async (messageId: number) => {
    try {
      await window.electronAPI.invoke('message:delete', messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      return true;
    } catch (err) {
      console.error('Failed to delete message:', err);
      setError('删除消息失败');
      return false;
    }
  }, []);

  /**
   * 更新消息
   */
  const updateMessageContent = useCallback(async (messageId: number, content: string) => {
    try {
      await window.electronAPI.invoke('message:update', messageId, content);
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, content } : msg
      ));
      return true;
    } catch (err) {
      console.error('Failed to update message:', err);
      setError('更新消息失败');
      return false;
    }
  }, []);

  /**
   * 重新生成AI回复
   * 找到对应的用户消息，重新调用AI生成新回复
   */
  const regenerateMessage = useCallback(async (aiMessageId: number) => {
    // 找到AI消息在数组中的索引
    const aiIndex = messages.findIndex(msg => msg.id === aiMessageId);
    if (aiIndex === -1) {
      console.error('AI message not found');
      return { success: false, error: '消息不存在' };
    }

    // 找到对应的用户消息（AI消息前面的最近的用户消息）
    let userMessage = null;
    for (let i = aiIndex - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === 'user') {
        userMessage = msg;
        break;
      }
    }

    if (!userMessage) {
      return { success: false, error: '找不到对应的用户消息' };
    }

    try {
      // 显示打字指示器
      setIsTyping(true);

      // 删除旧的AI回复
      await window.electronAPI.invoke('message:delete', aiMessageId);
      setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));

      // 发送到AI引擎
      const result = await window.electronAPI.sendQueryToOpenClaw(
        userMessage.content,
        currentConversationId || undefined
      );

      setIsTyping(false);

      if (result.success && result.response) {
        // 添加新的AI回复
        await addMessage('assistant', result.response);
        return { success: true };
      } else {
        // 添加错误消息
        await addMessage('assistant', `抱歉，AI引擎返回错误: ${result.error || '未知错误'}`);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Failed to regenerate message:', err);
      setIsTyping(false);
      await addMessage('assistant', '抱歉，重新生成回复时出现错误。请检查AI引擎状态。');
      return { success: false, error: err instanceof Error ? err.message : '重新生成失败' };
    }
  }, [messages, currentConversationId, addMessage]);

  /**
   * 发送消息并获取AI回复
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return { success: false, error: '消息不能为空' };

    // 如果没有当前对话，先创建一个
    let conversationId = currentConversationId;
    if (!conversationId) {
      const newConv = await createConversation();
      if (!newConv) return { success: false, error: '创建对话失败' };
      conversationId = newConv.id;
    }

    // 确保 conversationId 是 number 类型
    if (!conversationId) {
      return { success: false, error: '无法获取对话ID' };
    }
    const targetConversationId: number = conversationId;

    try {
      // 添加用户消息
      await addMessage('user', content);

      // 显示打字指示器
      setIsTyping(true);

      // 发送到AI引擎
      const result = await window.electronAPI.sendQueryToOpenClaw(content, targetConversationId);

      setIsTyping(false);

      if (result.success && result.response) {
        // 添加AI回复
        await addMessage('assistant', result.response);
        return { success: true };
      } else {
        // 添加错误消息
        await addMessage('assistant', `抱歉，AI引擎返回错误: ${result.error || '未知错误'}`);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setIsTyping(false);
      await addMessage('assistant', '抱歉，获取AI回复时出现错误。请检查AI引擎状态。');
      return { success: false, error: err instanceof Error ? err.message : '发送失败' };
    }
  }, [currentConversationId, createConversation, addMessage]);

  /**
   * 清空错误状态
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 初始加载对话列表
  useEffect(() => {
    if (userId) {
      loadConversations();
    }
  }, [userId, loadConversations]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (engineCheckInterval.current) {
        clearInterval(engineCheckInterval.current);
      }
    };
  }, []);

  // 获取当前对话
  const currentConversation = conversations.find(c => c.id === currentConversationId) || null;

  return {
    // 状态
    conversations,
    currentConversation,
    currentConversationId,
    messages,
    isTyping,
    engineStatus,
    loading,
    error,

    // 操作
    setCurrentConversationId,
    loadConversations,
    loadMessages,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    addMessage,
    deleteMessage,
    updateMessageContent,
    regenerateMessage,
    sendMessage,
    checkEngineStatus,
    startEngineStatusCheck,
    stopEngineStatusCheck,
    restartEngine,
    clearError,
  };
}

export default useChatStore;
