// ChatContainer.tsx - 对话容器

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChatItem, Message } from './ChatItem';
import { ChatInput } from '../ChatInput';
import { ConversationSidebar } from './ConversationSidebar';

export interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ChatContainerProps {
  // 对话数据
  conversations: Conversation[];
  messages: Message[];
  activeConversationId: number | null;

  // 模型信息
  currentModel?: string;
  availableModels?: Array<{ id: string; name: string; provider: string }>;

  // 状态
  isLoading?: boolean;
  isStreaming?: boolean;
  streamingContent?: string;
  onCancelStream?: () => void;

  // 回调函数
  onSendMessage: (message: string) => void;
  onSelectConversation: (id: number) => void;
  onCreateConversation: () => void;
  onDeleteConversation: (id: number) => void;
  onRenameConversation: (id: number, title: string) => void;
  onModelChange?: (modelId: string) => void;
  onRegenerateMessage?: (messageId: number) => void;
  onDeleteMessage?: (messageId: number) => void;
  onFeedbackMessage?: (messageId: number, type: 'like' | 'dislike') => void;

  // 搜索
  onSearchConversations?: (query: string) => void;
}

// 欢迎组件
const WelcomeScreen: React.FC<{
  onPromptClick: (prompt: string) => void;
  modelName?: string;
}> = ({ onPromptClick, modelName }) => {
  const WELCOME_PROMPTS = [
    {
      icon: '💡',
      title: '创意写作',
      description: '帮我写一篇关于人工智能的文章',
    },
    {
      icon: '🔍',
      title: '知识问答',
      description: '解释量子计算的基本原理',
    },
    {
      icon: '💻',
      title: '代码辅助',
      description: '用Python写一个快速排序算法',
    },
    {
      icon: '📊',
      title: '数据分析',
      description: '分析这个CSV文件的数据趋势',
    },
  ];

  return (
    <div className="flex h-full items-center justify-center bg-background dark:bg-[#0f0f0f]">
      <div className="flex flex-col items-center gap-6 px-6">
        <div className="text-muted-foreground">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="9"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">XClaw</h1>
        <p className="text-sm text-muted-foreground">
          {modelName ? `当前模型: ${modelName}` : '选择模型开始对话'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {WELCOME_PROMPTS.map((prompt, index) => (
            <button
              key={index}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => onPromptClick(prompt.description)}
            >
              <span className="text-xl">{prompt.icon}</span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">{prompt.title}</span>
                <span className="text-xs text-muted-foreground">{prompt.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// 加载骨架屏
const LoadingSkeleton: React.FC = () => (
  <div className="flex gap-3 px-4 py-3">
    <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  </div>
);

// 滚动到底部按钮
const ScrollToBottomButton: React.FC<{
  onClick: () => void;
  hasNewMessage: boolean;
}> = ({ onClick, hasNewMessage }) => (
  <button
    className={cn(
      "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background p-2 shadow-lg",
      "text-muted-foreground hover:text-foreground transition-colors",
      hasNewMessage && "ring-2 ring-primary"
    )}
    onClick={onClick}
    title="滚动到底部"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
    {hasNewMessage && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary" />}
  </button>
);

export const ChatContainer: React.FC<ChatContainerProps> = ({
  conversations,
  messages,
  activeConversationId,
  currentModel,
  availableModels = [],
  isLoading = false,
  isStreaming = false,
  streamingContent = '',
  onCancelStream,
  onSendMessage,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  onModelChange,
  onRegenerateMessage,
  onDeleteMessage,
  onFeedbackMessage,
  onSearchConversations,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // 滚动到底部
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setHasNewMessage(false);
  }, []);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  }, []);

  // 监听消息变化，自动滚动
  useEffect(() => {
    if (messages.length > 0) {
      const container = messagesContainerRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

        if (isNearBottom) {
          scrollToBottom('smooth');
        } else {
          setHasNewMessage(true);
        }
      }
    }
  }, [messages, scrollToBottom]);

  // 处理复制
  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // 处理快捷提示点击
  const handlePromptClick = useCallback((prompt: string) => {
    onSendMessage(prompt);
  }, [onSendMessage]);

  // 处理模型选择
  const handleModelChange = useCallback((modelId: string) => {
    onModelChange?.(modelId);
  }, [onModelChange]);

  // 获取当前模型名称
  const currentModelName = availableModels.find(m => m.id === currentModel)?.name || currentModel;

  return (
    <div className="flex h-full">
      {/* 侧边栏 */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={onSelectConversation}
        onCreate={onCreateConversation}
        onDelete={onDeleteConversation}
        onRename={onRenameConversation}
        onSearch={onSearchConversations}
      />

      {/* 主聊天区域 */}
      <div className="flex flex-1 flex-col bg-background dark:bg-[#0f0f0f]">
        {/* 顶部工具栏 */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center">
            {activeConversationId ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => handleModelChange(currentModel || '')}
                disabled={isLoading || isStreaming}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                <span>{currentModelName || '选择模型'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </Button>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">新对话</span>
            )}
          </div>

          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="设置">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </Button>
          </div>
        </div>

        {/* 消息列表 */}
        <div
          ref={messagesContainerRef}
          className="relative flex-1 overflow-y-auto"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <WelcomeScreen
              onPromptClick={handlePromptClick}
              modelName={currentModelName}
            />
          ) : (
            <>
              <div className="flex flex-col">
                {messages.map((message) => (
                  <ChatItem
                    key={message.id}
                    message={message}
                    onCopy={handleCopy}
                    onRegenerate={onRegenerateMessage}
                    onDelete={onDeleteMessage}
                    onFeedback={onFeedbackMessage}
                  />
                ))}

                {/* 流式响应内容 */}
                {isStreaming && streamingContent && (
                  <ChatItem
                    message={{
                      id: -1,
                      role: 'assistant',
                      content: streamingContent,
                      isStreaming: true,
                    }}
                    onCopy={handleCopy}
                  />
                )}

                {isLoading && !isStreaming && (
                  <LoadingSkeleton />
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* 滚动到底部按钮 */}
              {showScrollButton && (
                <ScrollToBottomButton
                  onClick={() => scrollToBottom('smooth')}
                  hasNewMessage={hasNewMessage}
                />
              )}
            </>
          )}
        </div>

        {/* 输入区域 */}
        <div className="shrink-0 border-t border-border bg-background px-4 py-3">
          <ChatInput
            onSend={onSendMessage}
            disabled={isLoading || isStreaming}
            placeholder="输入消息..."
            modelName={currentModelName}
            isStreaming={isStreaming}
            onCancel={onCancelStream}
          />
        </div>
      </div>

    </div>
  );
};

export default ChatContainer;
