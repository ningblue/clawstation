/**
 * Chat 页面
 * 对话主页面，整合所有聊天相关组件
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { MessageList } from '../../components/MessageList';
import { ChatInput, type ChatInputRef } from '../../components/ChatInput';
import { WindowControls } from '../../components/WindowControls';
import { FeedbackButton, FeedbackModal } from '../../components/Feedback';
import { Button } from '@/components/ui/button';
import { useChatStore, useUserStore } from '../../stores';
import { useModels } from '../../hooks/useModels';
import { cn } from '@/lib/utils';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatInputRef = useRef<ChatInputRef>(null);

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

  // 处理功能卡片点击
  const handleFeatureClick = useCallback((prompt: string) => {
    console.log('ChatPage handleFeatureClick:', prompt.substring(0, 50));
    if (chatInputRef.current) {
      chatInputRef.current.setText(prompt);
    }
  }, []);

  // 处理打开设置
  const handleOpenSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-settings'));
  }, []);

  // 处理退出登录
  const handleLogout = useCallback(() => {
    if (confirm('确定要退出登录吗？')) {
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
      if (window.electronAPI && typeof window.electronAPI.captureScreen === 'function') {
        const screenshot = await window.electronAPI.captureScreen();
        setFeedbackScreenshot(screenshot);
      } else {
        console.warn('captureScreen API not available');
        setFeedbackScreenshot(null);
      }
      setIsFeedbackOpen(true);
    } catch (err) {
      console.error('Failed to capture screen:', err);
      setFeedbackScreenshot(null);
      setIsFeedbackOpen(true);
    }
  }, []);

  const isMac = navigator.userAgent.toLowerCase().includes('mac');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* 左侧边栏 */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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

      {/* 右侧聊天区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部标题栏 - 包含窗口控制按钮 */}
        <div className={cn(
          "flex h-12 shrink-0 items-center border-b border-border bg-background",
          isMac ? "pl-20" : "pl-4"
        )}>
          <div className="flex items-center">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarOpen(true)}
                title="展开侧边栏"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Button>
            )}
          </div>
          {/* Electron drag area */}
          <div className="h-full flex-1" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
          <div className="flex items-center gap-1 pr-2">
            <FeedbackButton onClick={handleFeedbackClick} />
            <WindowControls />
          </div>
        </div>

        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => {
            setIsFeedbackOpen(false);
            setFeedbackScreenshot(null);
          }}
          initialScreenshot={feedbackScreenshot}
        />

        {/* 主内容区 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <MessageList
            messages={displayMessages}
            isTyping={isTyping}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            showEmptyState={currentConversationId === null && messages.length === 0}
            onFeatureClick={handleFeatureClick}
            onDeleteMessage={deleteMessage}
            onUpdateMessage={updateMessageContent}
            onRegenerateMessage={regenerateMessage}
          />
          <ChatInput
            ref={chatInputRef}
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
