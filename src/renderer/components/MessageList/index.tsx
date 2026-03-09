/**
 * MessageList 组件
 * 消息列表，显示用户和AI的消息
 */

import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../../stores';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ToolCard, type ToolCall, type ToolResult } from '../ToolCard';
import { Thinking, parseThinkingFromContent } from '../Thinking';

export interface MessageListProps {
  /** 消息列表 */
  messages: Message[];
  /** 是否显示打字指示器 */
  isTyping?: boolean;
  /** 是否显示空状态 */
  showEmptyState?: boolean;
  /** 是否正在流式响应 */
  isStreaming?: boolean;
  /** 流式响应内容 */
  streamingContent?: string;
  /** 流式响应中的工具调用 */
  streamingToolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  /** 删除消息回调 */
  onDeleteMessage?: (messageId: number) => void;
  /** 更新消息回调 */
  onUpdateMessage?: (messageId: number, content: string) => void;
  /** 重新生成消息回调 */
  onRegenerateMessage?: (messageId: number) => void;
}

/**
 * 解析消息内容中的工具调用
 */
const parseToolsFromContent = (content: string): Array<{ tool: ToolCall | ToolResult; status: 'pending' | 'success' | 'error' }> => {
  const tools: Array<{ tool: ToolCall | ToolResult; status: 'pending' | 'success' | 'error' }> = [];

  // 匹配 JSON 代码块中的工具调用
  const toolCallRegex = /```json\s*({[\s\S]*?})\s*```/g;
  let match;

  while ((match = toolCallRegex.exec(content)) !== null) {
    try {
      const jsonStr = match[1] ?? '';
      if (!jsonStr) continue;
      const data = JSON.parse(jsonStr);

      // 检测工具调用格式
      if (data.type === 'toolcall' || data.type === 'tool_call' || data.type === 'tooluse' || data.type === 'tool_use') {
        tools.push({
          tool: data as ToolCall,
          status: 'success'
        });
      }
      // 检测工具结果格式
      else if (data.type === 'toolresult' || data.type === 'tool_result') {
        tools.push({
          tool: data as ToolResult,
          status: data.error ? 'error' : 'success'
        });
      }
    } catch {
      // 忽略解析错误
    }
  }

  // 也尝试匹配内联的 JSON（不在代码块中）
  const inlineRegex = /\{[^{}]*"type"\s*:\s*"(toolcall|tool_call|tooluse|tool_use|toolresult|tool_result)"[^{}]*\}/g;
  while ((match = inlineRegex.exec(content)) !== null) {
    // 避免重复处理已经匹配到的内容
    const alreadyMatched = tools.some(t => {
      const toolJson = JSON.stringify(t.tool);
      return toolJson.includes(match![0].slice(1, -1));
    });

    if (!alreadyMatched) {
      try {
        const data = JSON.parse(match[0]);
        if (['toolcall', 'tool_call', 'tooluse', 'tool_use'].includes(data.type)) {
          tools.push({ tool: data as ToolCall, status: 'success' });
        } else if (['toolresult', 'tool_result'].includes(data.type)) {
          tools.push({ tool: data as ToolResult, status: data.error ? 'error' : 'success' });
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  return tools;
};

/**
 * 消息项组件
 */
interface MessageItemProps {
  message: Message;
  onDeleteMessage?: (messageId: number) => void;
  onUpdateMessage?: (messageId: number, content: string) => void;
  onRegenerateMessage?: (messageId: number) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onDeleteMessage, onUpdateMessage, onRegenerateMessage }) => {
  const isUser = message.role === 'user';
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 解析工具调用和 thinking
  const tools = !isUser ? parseToolsFromContent(message.content) : [];
  const { mainContent, thinking } = !isUser ? parseThinkingFromContent(message.content) : { mainContent: message.content };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(message.content);
    setShowMenu(false);
  };

  const handleSaveEdit = () => {
    if (onUpdateMessage && message.id) {
      onUpdateMessage(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const handleDelete = () => {
    if (onDeleteMessage && message.id) {
      onDeleteMessage(message.id);
    }
    setShowMenu(false);
  };

  const handleRegenerate = () => {
    if (onRegenerateMessage && message.id) {
      onRegenerateMessage(message.id);
    }
    setShowMenu(false);
  };

  return (
    <div
      className={`message ${isUser ? 'user-message' : 'assistant-message'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: '12px',
        margin: '16px 0',
        maxWidth: '85%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {/* 只有 AI 消息显示头像 */}
      {!isUser && (
        <div
          className="avatar assistant-avatar"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontWeight: 'bold',
            color: 'white',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          }}
        >
          AI
        </div>
      )}
      <div
        className="message-wrapper"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          maxWidth: isUser ? '100%' : 'calc(100% - 48px)',
          alignItems: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        {/* 操作按钮栏 - 悬浮显示 */}
        <div className={`message-actions-bar ${isHovered ? 'visible' : ''}`}>
          {!isUser && (
            <button
              className="message-action-btn regenerate"
              onClick={handleRegenerate}
              title="重新生成"
            >
              ↻
            </button>
          )}
          <div className="message-actions-dropdown" ref={menuRef}>
            <button
              className="message-menu-btn"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="消息操作"
            >
              ⋮
            </button>
            {showMenu && (
              <div className="message-menu">
                <button onClick={handleCopy} className="menu-item">
                  复制
                </button>
                {!isUser && (
                  <button onClick={handleRegenerate} className="menu-item">
                    重新生成
                  </button>
                )}
                {isUser && (
                  <button onClick={handleEdit} className="menu-item">
                    编辑
                  </button>
                )}
                <button onClick={handleDelete} className="menu-item delete">
                  删除
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="message-content">
          {isEditing ? (
            <div className="message-edit">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="message-edit-input"
                rows={Math.max(3, editContent.split('\n').length)}
              />
              <div className="message-edit-actions">
                <button onClick={handleSaveEdit} className="btn-save">保存</button>
                <button onClick={handleCancelEdit} className="btn-cancel">取消</button>
              </div>
            </div>
          ) : (
            <>
              <MarkdownRenderer content={mainContent} />
              {/* 显示思考过程 */}
              {thinking && <Thinking content={thinking} />}
              {/* 显示工具调用 */}
              {tools.length > 0 && (
                <div className="message-tools">
                  {tools.map((item, index) => (
                    <ToolCard key={index} tool={item.tool} status={item.status} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 打字指示器组件 - 与 AI 消息保持相同布局
 */
const TypingIndicator: React.FC = () => {
  return (
    <div
      className="message assistant-message"
      id="typingIndicator"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: '12px',
        margin: '16px 0',
        maxWidth: '85%',
        alignSelf: 'flex-start',
      }}
    >
      <div
        className="avatar assistant-avatar"
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontWeight: 'bold',
          color: 'white',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        }}
      >
        AI
      </div>
      <div
        className="message-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          maxWidth: 'calc(100% - 48px)',
          alignItems: 'flex-start',
        }}
      >
        <div className="typing-indicator">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
      </div>
    </div>
  );
};

/**
 * 空状态组件
 */
const EmptyState: React.FC = () => {
  return (
    <div className="info-panel">
      <h2>欢迎使用 X-Claw</h2>
      <p>AI数字员工桌面应用</p>
      <p>开始一个新对话或选择现有对话</p>
    </div>
  );
};

/**
 * MessageList 组件
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isTyping = false,
  showEmptyState = false,
  isStreaming = false,
  streamingContent = '',
  streamingToolCalls = [],
  onDeleteMessage,
  onUpdateMessage,
  onRegenerateMessage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // 如果显示空状态
  if (showEmptyState && messages.length === 0) {
    return (
      <div className="messages-container" ref={containerRef}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div
      className="messages-container"
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
      }}
    >
      {messages.length === 0 ? (
        <div className="info-panel">
          <p>开始发送消息...</p>
        </div>
      ) : (
        messages.map((message) => (
          <MessageItem
            key={message.id || `${message.role}-${message.createdAt}`}
            message={message}
            onDeleteMessage={onDeleteMessage}
            onUpdateMessage={onUpdateMessage}
            onRegenerateMessage={onRegenerateMessage}
          />
        ))
      )}
      {/* 流式响应内容 */}
      {/* 流式响应内容 */}
      {isStreaming && (
        <div className="message assistant-message">
          <div
            className="avatar assistant-avatar"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontWeight: 'bold',
              color: 'white',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            }}
          >
            AI
          </div>
          <div
            className="message-content"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxWidth: 'calc(100% - 48px)',
              alignItems: 'flex-start',
            }}
          >
            {streamingContent ? (
              <>
                <MarkdownRenderer content={streamingContent} />
                <span className="streaming-cursor">▋</span>
              </>
            ) : (
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {isTyping && !isStreaming && <TypingIndicator />}
    </div>
  );
};

export default MessageList;
