/**
 * Chat 页面
 * 对话主页面，整合所有聊天相关组件
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { MessageList } from '../../components/MessageList';
import { ChatInput } from '../../components/ChatInput';
import { WindowControls } from '../../components/WindowControls';
import { FeedbackButton, FeedbackModal } from '../../components/Feedback';
import { useChatStore, useUserStore } from '../../stores';
import { useModels } from '../../hooks/useModels';
import type { Message } from '../../stores';

// 欢迎消息
const WELCOME_MESSAGE: Message = {
  conversationId: 0,
  role: 'assistant',
  content: '你好！我是你的AI助手。请问我有什么可以帮助你的吗？',
};

/**
 * Chat 页面组件
 */
export const ChatPage: React.FC = () => {
  const { user } = useUserStore();
  const { isRestarting } = useModels();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackScreenshot, setFeedbackScreenshot] = useState<string | null>(null);

  const {
    conversations,
    currentConversation,
    currentConversationId,
    messages,
    isTyping,
    loading,
    error,
    isStreaming,
    streamingContent,
    streamingToolCalls,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    deleteMessage,
    updateMessageContent,
    regenerateMessage,
    sendMessage,
    cancelStream,
    startEngineStatusCheck,
    clearError,
    resetCurrentConversation,
  } = useChatStore(user?.id ?? null);

  // 启动引擎状态检查
  useEffect(() => {
    startEngineStatusCheck();
    return () => {
      // 清理在store中处理
    };
  }, [startEngineStatusCheck]);

  // 处理新建对话
  const handleNewConversation = useCallback(async () => {
    // 只是重置状态，不立即创建数据库记录
    resetCurrentConversation();
  }, [resetCurrentConversation]);

  // 处理选择对话
  const handleSelectConversation = useCallback(async (conversationId: number) => {
    await selectConversation(conversationId);
  }, [selectConversation]);

  // 处理发送消息
  const handleSendMessage = useCallback(async (content: string) => {
    await sendMessage(content);
  }, [sendMessage]);

  // 处理打开设置
  const handleOpenSettings = useCallback(() => {
    // 触发设置模态框打开事件
    window.dispatchEvent(new CustomEvent('open-settings'));
  }, []);

  // 处理退出登录
  const handleLogout = useCallback(() => {
    if (confirm('确定要退出登录吗？')) {
      // 退出登录逻辑
      window.electronAPI?.invoke?.('auth:logout')?.then(() => {
        window.location.reload();
      })?.catch(() => {
        window.location.reload();
      });
    }
  }, []);

  // 显示错误提示
  useEffect(() => {
    if (error) {
      alert(error);
      clearError();
    }
  }, [error, clearError]);

  // 合并消息（如果是新对话，显示欢迎消息）
  const displayMessages = currentConversationId === null && messages.length === 0
    ? []
    : messages.length === 0 && currentConversationId !== null
      ? [WELCOME_MESSAGE]
      : messages;

  // 处理反馈按钮点击
  const handleFeedbackClick = useCallback(async () => {
    try {
      // 检查 API 是否可用
      if (window.electronAPI && typeof window.electronAPI.captureScreen === 'function') {
        // 截取当前屏幕
        const screenshot = await window.electronAPI.captureScreen();
        setFeedbackScreenshot(screenshot);
      } else {
        console.warn('captureScreen API not available');
        setFeedbackScreenshot(null);
      }
      setIsFeedbackOpen(true);
    } catch (err) {
      console.error('Failed to capture screen:', err);
      // 即使截图失败也打开反馈窗口
      setFeedbackScreenshot(null);
      setIsFeedbackOpen(true);
    }
  }, []);

  const isMac = navigator.userAgent.toLowerCase().includes('mac');

  return (
    <div id="root">
      {/* 顶部标题栏 - 包含窗口控制按钮 */}
      <div className={`app-header ${isMac ? 'mac' : 'win'}`}>
        <div className="app-header-drag-area" />
        <FeedbackButton onClick={handleFeedbackClick} />
        <WindowControls />
      </div>

      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => {
          setIsFeedbackOpen(false);
          setFeedbackScreenshot(null);
        }} 
        initialScreenshot={feedbackScreenshot}
      />

      <div className="main-content">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onRenameConversation={renameConversation}
          onDeleteConversation={deleteConversation}
          user={user ? { username: user.username, email: user.email } : undefined}
          onOpenSettings={handleOpenSettings}
          onLogout={handleLogout}
        />

        <div className="chat-area">
          <MessageList
            messages={displayMessages}
            isTyping={isTyping}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            streamingToolCalls={streamingToolCalls}
            showEmptyState={currentConversationId === null && messages.length === 0}
            onDeleteMessage={deleteMessage}
            onUpdateMessage={updateMessageContent}
            onRegenerateMessage={regenerateMessage}
          />
          <ChatInput
            onSend={handleSendMessage}
            disabled={loading || isTyping}
            isStreaming={isStreaming}
            onCancel={cancelStream}
            engineRestarting={isRestarting}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
