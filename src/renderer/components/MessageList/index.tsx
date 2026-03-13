/**
 * MessageList 组件
 * 消息列表，显示用户和AI的消息
 */

import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../../stores';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ToolCard, type ToolCall, type ToolResult } from '../ToolCard';
import { Thinking, parseThinkingFromContent } from '../Thinking';

// 工具名称映射为用户可读的描述
const getToolDisplayName = (toolName: string): string => {
  const toolNames: Record<string, string> = {
    'browser': '浏览器',
    'web_search': '网络搜索',
    'exec': '执行命令',
    'read': '读取文件',
    'write': '写入文件',
    'process': '处理',
    'str_replace_editor': '编辑文件',
    'bash': '执行命令',
    'shell': '执行命令',
    'Playwright': '浏览器操作',
  };
  return toolNames[toolName] || toolName;
};

// 获取工具图标
const getToolIcon = (toolName: string): string => {
  const toolIcons: Record<string, string> = {
    'browser': '🌐',
    'web_search': '🔍',
    'exec': '⚡',
    'read': '📖',
    'write': '✏️',
    'process': '⚙️',
    'str_replace_editor': '📝',
    'bash': '💻',
    'shell': '💻',
    'Playwright': '🌍',
  };
  return toolIcons[toolName] || '🔧';
};

// 获取工具执行详情
const getToolDetail = (tool: { name: string; arguments: Record<string, unknown> }): string => {
  const args = tool.arguments;
  if (!args) return '';

  // 根据不同工具提取关键信息
  if (args.command) {
    const cmd = String(args.command);
    // 简化命令显示，只取前30个字符
    return cmd.length > 30 ? cmd.slice(0, 30) + '...' : cmd;
  }
  if (args.url) {
    const url = String(args.url);
    return url.length > 40 ? url.slice(0, 40) + '...' : url;
  }
  if (args.path) {
    const path = String(args.path);
    const filename = path.split('/').pop() || path;
    return filename;
  }
  if (args.query) {
    return String(args.query);
  }

  return '';
};

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
    >
      {/* 只有 AI 消息显示头像 */}
      {!isUser && (
        <div className="avatar assistant-avatar">
          AI
        </div>
      )}

      {/* 用户消息：简洁的类QClaw设计 */}
      {isUser ? (
        <div className="message-content-wrapper">
          <div className="message-bubble-user">
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
              <MarkdownRenderer content={mainContent} />
            )}
          </div>
          {/* 用户消息操作按钮 - 位于消息下方 */}
          <div className={`message-actions-user ${isHovered ? 'visible' : ''}`}>
            <button className="action-btn-small" onClick={handleCopy} title="复制">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button className="action-btn-small" onClick={handleEdit} title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button className="action-btn-small" onClick={handleDelete} title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      ) : (
        /* AI消息：简洁设计，操作按钮位于消息下方 */
        <div className="message-content-wrapper assistant">
          <div className="message-bubble assistant">
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
          {/* AI消息操作按钮 - 位于消息下方 */}
          <div className={`message-actions-ai ${isHovered ? 'visible' : ''}`}>
            <button className="action-btn-small" onClick={handleCopy} title="复制">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button className="action-btn-small" onClick={handleRegenerate} title="重新生成">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
            <button className="action-btn-small" onClick={handleDelete} title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 打字指示器组件 - 与 AI 消息保持相同布局
 */
const TypingIndicator: React.FC = () => {
  return (
    <div className="message assistant-message" id="typingIndicator">
      <div className="avatar assistant-avatar">AI</div>
      <div className="message-bubble assistant">
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
 * 空状态组件 - 参考 QClaw 设计
 */
const EmptyState: React.FC = () => {
  const features = [
    {
      title: '每日天气定时提醒',
      desc: '自动推送天气状况，给出穿衣 & 出行建议',
    },
    {
      title: '远程操控电脑文件',
      desc: '不带电脑，手机随时编辑，管理本地文件',
    },
    {
      title: '手机远程办公',
      desc: '不带电脑，手机随时查阅、处理在线任务',
    },
    {
      title: '社媒自动运营涨粉',
      desc: '不用团队自动互动发帖，轻松涨粉',
    },
    {
      title: 'GitHub项目自动开发',
      desc: '你出创意，我来实现，自动建库冲千星',
    },
  ];

  return (
    <div className="empty-state">
      <div className="empty-state-center">
        <div className="empty-state-logo">
          <div className="empty-state-icon">X</div>
        </div>
        <h1 className="empty-state-title">XClaw</h1>
        <p className="empty-state-subtitle">7x24小时，随时随地召唤的全能电脑 AI 助手</p>
      </div>

      <div className="empty-state-features">
        {features.map((feature, index) => (
          <div key={index} className="feature-card">
            <h3 className="feature-card-title">{feature.title}</h3>
            <p className="feature-card-desc">{feature.desc}</p>
          </div>
        ))}
      </div>
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
      {isStreaming && (
        <div className="message assistant-message">
          <div className="avatar assistant-avatar">AI</div>
          <div className="message-content-wrapper assistant">
            <div className="message-bubble assistant">
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
        </div>
      )}

      {/* 正在执行的工具调用 - 展示进度 */}
      {isStreaming && streamingToolCalls.length > 0 && (
        <div className="tool-calls-progress">
          {streamingToolCalls.map((tool, index) => (
            <div key={index} className="tool-call-item">
              <span className="tool-call-icon">{getToolIcon(tool.name)}</span>
              <span className="tool-call-name">{getToolDisplayName(tool.name)}</span>
              <span className="tool-call-detail">{getToolDetail(tool)}</span>
            </div>
          ))}
        </div>
      )}

      {isTyping && !isStreaming && <TypingIndicator />}
    </div>
  );
};

export default MessageList;
