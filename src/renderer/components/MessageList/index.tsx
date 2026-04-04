/**
 * MessageList 组件
 * 消息列表，显示用户和AI的消息
 */

import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../../stores';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ToolCard, type ToolCall, type ToolResult } from '../ToolCard';
import { Thinking, parseThinkingFromContent } from '../Thinking';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  if (args.command) {
    const cmd = String(args.command);
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
  /** 点击功能卡片回调 */
  onFeatureClick?: (prompt: string) => void;
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

  const toolCallRegex = /```json\s*({[\s\S]*?})\s*```/g;
  let match;

  while ((match = toolCallRegex.exec(content)) !== null) {
    try {
      const jsonStr = match[1] ?? '';
      if (!jsonStr) continue;
      const data = JSON.parse(jsonStr);

      if (data.type === 'toolcall' || data.type === 'tool_call' || data.type === 'tooluse' || data.type === 'tool_use') {
        tools.push({
          tool: data as ToolCall,
          status: 'success'
        });
      }
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

  const inlineRegex = /\{[^{}]*"type"\s*:\s*"(toolcall|tool_call|tooluse|tool_use|toolresult|tool_result)"[^{}]*\}/g;
  while ((match = inlineRegex.exec(content)) !== null) {
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
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "justify-end" : "justify-start"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 只有 AI 消息显示头像 */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          AI
        </div>
      )}

      {/* 用户消息 */}
      {isUser ? (
        <div className="flex max-w-[80%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full resize-none rounded-lg bg-primary-foreground/10 px-3 py-2 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary-foreground/30"
                  rows={Math.max(3, editContent.split('\n').length)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleSaveEdit}>保存</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancelEdit}>取消</Button>
                </div>
              </div>
            ) : (
              <MarkdownRenderer content={mainContent} />
            )}
          </div>
          {/* 用户消息操作按钮 */}
          <div className={cn(
            "flex items-center gap-0.5 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleCopy} title="复制">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleEdit} title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleDelete} title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </Button>
          </div>
        </div>
      ) : (
        /* AI消息 */
        <div className="flex max-w-[85%] flex-col gap-1">
          <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-foreground">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full resize-none rounded-lg bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={Math.max(3, editContent.split('\n').length)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleSaveEdit}>保存</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancelEdit}>取消</Button>
                </div>
              </div>
            ) : (
              <>
                <MarkdownRenderer content={mainContent} />
                {/* 显示思考过程 */}
                {thinking && <Thinking content={thinking} />}
                {/* 显示工具调用 */}
                {tools.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {tools.map((item, index) => (
                      <ToolCard key={index} tool={item.tool} status={item.status} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {/* AI消息操作按钮 */}
          <div className={cn(
            "flex items-center gap-0.5 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleCopy} title="复制">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleRegenerate} title="重新生成">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleDelete} title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </Button>
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
    <div className="flex gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        AI
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
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
    <div className="flex h-full flex-col items-center justify-center bg-background px-6 py-12 dark:bg-[#0f0f0f]">
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
          X
        </div>
        <h1 className="text-2xl font-bold text-foreground">XClaw</h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">7x24小时，随时随地召唤的全能电脑 AI 助手</p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        {features.map((feature, index) => (
          <div
            key={index}
            className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground dark:border-gray-700 dark:bg-[#1a1a1a]"
            onClick={() => handleFeatureClick(feature.prompt)}
          >
            <h3 className="text-sm font-medium text-foreground dark:text-white">{feature.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground dark:text-gray-400">{feature.desc}</p>
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
  onFeatureClick,
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
      <div className="flex-1 overflow-y-auto bg-background dark:bg-[#0f0f0f]" ref={containerRef}>
        <EmptyState onFeatureClick={onFeatureClick} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto bg-background px-0 py-5 dark:bg-gray-950"
      ref={containerRef}
    >
      {messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">开始发送消息...</p>
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
        <div className="flex gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            AI
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
            {streamingContent ? (
              <>
                <MarkdownRenderer content={streamingContent} />
                <span className="animate-pulse text-primary">▋</span>
              </>
            ) : (
              <div className="flex items-center gap-1 py-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
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
