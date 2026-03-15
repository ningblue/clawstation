/**
 * MessageList 组件
 * 消息列表，显示用户和AI的消息
 */

import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../../stores';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ToolCard, type ToolCall, type ToolResult } from '../ToolCard';
import { Thinking, parseThinkingFromContent } from '../Thinking';
import { ToolTimeline } from '../ToolTimeline';
import type { ToolEvent } from '../../types/tool-event';

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
  /** 工具事件列表（来自 WebSocket） */
  toolEvents?: ToolEvent[];
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
interface EmptyStateProps {
  onFeatureClick?: (prompt: string) => void;
}

// 导出 EmptyState 组件
export const EmptyState: React.FC<EmptyStateProps> = ({ onFeatureClick }) => {
  const features = [
    {
      title: '文档转换',
      desc: 'Markdown 转精美 PDF，支持目录',
      prompt: '帮我把【上传的 Markdown 文件】转换成排版精美的 PDF 文档，要求：自定义封面页（标题 + 作者 + 日期）、自动生成目录、代码块带语法高亮、表格有交替行底色、页脚显示页码。',
    },
    {
      title: 'Excel 分析',
      desc: '上传 Excel，生成图表分析报告',
      prompt: '请分析【上传你的 Excel 文件】，生成包含数据洞察和可视化图表的专业 Excel 分析报告。要求：\n1. 数据概况和基本统计\n2. 关键指标分析\n3. 趋势分析\n4. 发现的问题和建议\n5. 生成可视化图表',
    },
    {
      title: '项目管理表',
      desc: '创建优雅的项目管理表',
      prompt: '创建一个项目管理表，用于跟踪项目全生命周期的任务，具有优雅且简约的视觉风格。要求包含：\n1. 任务名称\n2. 负责人\n3. 开始/截止日期\n4. 优先级\n5. 状态（待处理/进行中/已完成）\n6. 进度百分比\n7. 备注',
    },
    {
      title: '简历优化',
      desc: '优化简历，增加量化成果',
      prompt: '帮我优化【这份简历】，让它更有吸引力：\n1. 优化表述方式，更专业更有亮点\n2. 增加一些量化成果\n3. 调整简历结构\n\n请直接给出优化后的完整简历内容。',
    },
    {
      title: '合同审核',
      desc: '检查合同风险，给出修改建议',
      prompt: '帮我审核【这份合同】，检查潜在风险点：\n1. 付款条款是否合理\n2. 违约责任是否对等\n3. 关键条款是否有遗漏\n4. 知识产权归属是否清晰\n5. 争议解决机制是否完善\n\n请逐条列出发现的问题，并给出具体的修改建议。',
    },
    {
      title: '会议纪要',
      desc: '整理结构化纪要，列待办事项',
      prompt: '帮我把【这段会议记录】整理成结构化的会议纪要，包含：\n1. 会议主题\n2. 会议时间\n3. 参与人员\n4. 讨论要点\n5. 决策事项\n6. 待办事项（包含负责人和截止时间）\n\n请用清晰的Markdown格式输出。',
    },
  ];

  const handleFeatureClick = (prompt: string) => {
    console.log('EmptyState handleFeatureClick called:', prompt.substring(0, 50));
    console.log('onFeatureClick prop exists:', !!onFeatureClick);
    if (onFeatureClick) {
      onFeatureClick(prompt);
      console.log('onFeatureClick executed');
    } else {
      console.warn('onFeatureClick is undefined!');
    }
  };

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
          <div key={index} className="feature-card" onClick={() => handleFeatureClick(feature.prompt)} style={{ cursor: 'pointer' }}>
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
  toolEvents = [],
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

  // 如果显示空状态，返回 null（EmptyState 在 ChatPage 中渲染）
  if (showEmptyState && messages.length === 0) {
    return null;
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
                  {/* 流式响应中实时显示工具调用 */}
                  {streamingToolCalls.length > 0 && (
                    <div className="streaming-tools">
                      {streamingToolCalls.map((tool, index) => (
                        <div key={index} className="streaming-tool-item">
                          <span className="tool-icon">{getToolIcon(tool.name)}</span>
                          <span className="tool-name">{getToolDisplayName(tool.name)}</span>
                          <span className="tool-detail">{getToolDetail(tool)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 工具时间线 - 显示详细的工具执行过程 */}
                  <ToolTimeline
                    events={toolEvents}
                    maxHeight={300}
                    defaultExpanded={false}
                  />
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

      {isTyping && !isStreaming && <TypingIndicator />}
    </div>
  );
};

export default MessageList;
