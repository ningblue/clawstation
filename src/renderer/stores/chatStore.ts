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

  // 流式响应状态 - 按会话ID隔离
  const [streamingStates, setStreamingStates] = useState<Record<number, {
    isStreaming: boolean;
    content: string;
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  }>>({});
  const cancelStreamRef = useRef<(() => void) | null>(null);
  const activeConversationRef = useRef<number | null>(null);

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
   * 重置当前对话
   */
  const resetCurrentConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
    setIsTyping(false);
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
  const addMessage = useCallback(async (role: MessageRole, content: string, conversationId?: number) => {
    const targetId = conversationId || currentConversationId;
    if (!targetId) return null;
    try {
      const message = await window.electronAPI.invoke('message:create', {
        conversationId: targetId,
        role,
        content,
      });

      // 更新消息状态
      setMessages(prev => {
        // 如果我们正在切换到这个对话（conversationId被传递）
        // 或者这个消息属于当前对话
        if (conversationId || targetId === currentConversationId) {
          return [...prev, message];
        }
        return prev;
      });
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
   * 发送消息并获取AI回复（流式响应）
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return { success: false, error: '消息不能为空' };

    // 如果有正在进行的流，先取消
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }

    // 如果没有当前对话，先创建一个
    let conversationId = currentConversationId;
    let isNewConversation = false;
    if (!conversationId) {
      const newConv = await createConversation();
      if (!newConv) return { success: false, error: '创建对话失败' };
      conversationId = newConv.id;
      isNewConversation = true;
    }

    // 确保 conversationId 是 number 类型
    if (!conversationId) {
      return { success: false, error: '无法获取对话ID' };
    }
    const targetConversationId: number = conversationId;

    // 记录当前活动会话
    activeConversationRef.current = targetConversationId;

    try {
      // 添加用户消息
      await addMessage('user', content, targetConversationId);

      // 自动重命名会话：如果是新会话或第一条消息
      if (isNewConversation || messages.length === 0) {
        let newTitle = content.trim();
        // 移除换行符，避免标题显示异常
        newTitle = newTitle.replace(/[\r\n]+/g, ' ');
        if (newTitle.length > 20) {
          newTitle = newTitle.substring(0, 20);
        }
        // 异步重命名，不阻塞
        renameConversation(targetConversationId, newTitle).catch(console.error);
      }

      // 开始流式响应 - 按会话隔离
      setStreamingStates(prev => ({
        ...prev,
        [targetConversationId]: { isStreaming: true, content: '', toolCalls: [] }
      }));
      setIsTyping(true);

      // 使用流式API
      const cancelFn = window.electronAPI.sendQueryToOpenClawStream(
        content,
        targetConversationId,
        (chunk) => {
          // 接收到新的chunk - 只更新当前会话的状态
          setStreamingStates(prev => ({
            ...prev,
            [targetConversationId]: {
              isStreaming: true,
              toolCalls: prev[targetConversationId]?.toolCalls || [],
              content: (prev[targetConversationId]?.content || '') + chunk
            }
          }));
        },
        (tool) => {
          // 接收到工具调用 - 只更新当前会话的状态
          setStreamingStates(prev => ({
            ...prev,
            [targetConversationId]: {
              isStreaming: true,
              content: prev[targetConversationId]?.content || '',
              toolCalls: [...(prev[targetConversationId]?.toolCalls || []), tool]
            }
          }));
        },
        async (fullContent) => {
          // 流式响应完成
          setStreamingStates(prev => ({
            ...prev,
            [targetConversationId]: {
              isStreaming: false,
              content: prev[targetConversationId]?.content || '',
              toolCalls: prev[targetConversationId]?.toolCalls || []
            }
          }));
          setIsTyping(false);
          cancelStreamRef.current = null;
          activeConversationRef.current = null;

          // 保存完整的AI回复到数据库
          await addMessage('assistant', fullContent, targetConversationId);

          // 延迟清空流式内容（让用户看到完成状态）
          setTimeout(() => {
            setStreamingStates(prev => {
              const newState = { ...prev };
              delete newState[targetConversationId];
              return newState;
            });
          }, 100);
        },
        async (error) => {
          // 发生错误
          console.error('Stream error:', error);
          const currentContent = streamingStates[targetConversationId]?.content || '';
          setStreamingStates(prev => ({
            ...prev,
            [targetConversationId]: {
              isStreaming: false,
              content: prev[targetConversationId]?.content || '',
              toolCalls: prev[targetConversationId]?.toolCalls || []
            }
          }));
          setIsTyping(false);
          cancelStreamRef.current = null;
          activeConversationRef.current = null;

          // 添加错误消息（只如果有内容才添加）
          const errorContent = currentContent.trim()
            ? currentContent + '\n\n[生成中断: ' + (error || '未知错误') + ']'
            : `抱歉，AI引擎返回错误: ${error || '未知错误'}`;
          await addMessage('assistant', errorContent, targetConversationId);
        }
      );

      // 保存取消函数
      cancelStreamRef.current = cancelFn;

      return { success: true };
    } catch (err) {
      console.error('Failed to send message:', err);
      setStreamingStates(prev => ({
        ...prev,
        [targetConversationId]: { isStreaming: false, content: '', toolCalls: [] }
      }));
      setIsTyping(false);
      cancelStreamRef.current = null;
      activeConversationRef.current = null;
      await addMessage('assistant', '抱歉，获取AI回复时出现错误。请检查AI引擎状态。', targetConversationId);
      return { success: false, error: err instanceof Error ? err.message : '发送失败' };
    }
  }, [currentConversationId, createConversation, addMessage, messages, renameConversation]);

  /**
   * 取消当前流式响应
   */
  const cancelStream = useCallback(() => {
    const activeConvId = activeConversationRef.current;
    if (cancelStreamRef.current && activeConvId) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;

      const currentContent = streamingStates[activeConvId]?.content || '';
      setStreamingStates(prev => ({
        ...prev,
        [activeConvId]: {
          isStreaming: false,
          content: prev[activeConvId]?.content || '',
          toolCalls: prev[activeConvId]?.toolCalls || []
        }
      }));
      setIsTyping(false);

      // 如果有流式内容，保存为一条消息
      if (currentContent.trim()) {
        addMessage('assistant', currentContent + '\n\n[已停止生成]');
      }

      // 延迟清空状态
      setTimeout(() => {
        setStreamingStates(prev => {
          const newState = { ...prev };
          delete newState[activeConvId];
          return newState;
        });
      }, 100);

      activeConversationRef.current = null;
    }
  }, [streamingStates, addMessage]);

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

  // 获取当前会话的流式状态
  const currentStreamingState = currentConversationId ? streamingStates[currentConversationId] : undefined;
  const isStreaming = currentStreamingState?.isStreaming || false;
  const streamingContent = currentStreamingState?.content || '';
  const streamingToolCalls = currentStreamingState?.toolCalls || [];

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

    // 流式响应状态 - 当前会话
    isStreaming,
    streamingContent,
    streamingToolCalls,

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
    cancelStream,
    checkEngineStatus,
    startEngineStatusCheck,
    stopEngineStatusCheck,
    restartEngine,
    clearError,
    resetCurrentConversation,
  };
}

export default useChatStore;
