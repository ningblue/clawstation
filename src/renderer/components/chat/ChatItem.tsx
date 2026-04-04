// ChatItem.tsx - 消息组件（用户/助手消息样式区分）

import React, { useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  model?: string;
  isStreaming?: boolean;
}

interface ChatItemProps {
  message: Message;
  onCopy?: (content: string) => void;
  onRegenerate?: (messageId: number) => void;
  onDelete?: (messageId: number) => void;
  onFeedback?: (messageId: number, type: 'like' | 'dislike') => void;
}

// 代码块组件
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'text' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-2">
        <span className="text-xs text-zinc-400">{language}</span>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 gap-1 text-xs text-zinc-400 hover:text-zinc-200", copied && "text-green-400")}
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>已复制</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>复制</span>
            </>
          )}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '0.8125rem',
          lineHeight: '1.5',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

// 图片组件
const ImageRenderer: React.FC<{ src: string; alt?: string }> = ({ src, alt }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border">
      {loading && !error && (
        <div className="flex items-center gap-2 p-4 text-muted-foreground">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span className="text-sm">加载中...</span>
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center gap-2 p-4 text-destructive">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span className="text-sm">图片加载失败</span>
          <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">{src}</a>
        </div>
      ) : (
        <img
          src={src}
          alt={alt || ''}
          className="max-w-full object-contain"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          style={{ display: loading ? 'none' : 'block' }}
        />
      )}
    </div>
  );
};

// 处理消息内容，解析代码块、行内代码和图片
const formatContent = (content: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const combinedRegex = /```(\w+)?\n([\s\S]*?)```|!\[([^\]]*)\]\(([^)]+)\)/g;

  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      parts.push(...processInlineCode(textBefore));
    }

    if (match[0].startsWith('```')) {
      const language = match[1] || 'text';
      const code = (match[2] || '').trim();
      parts.push(<CodeBlock key={`code-${match.index}`} code={code} language={language} />);
    } else {
      const alt = match[3] || '';
      const src = match[4] || '';
      parts.push(<ImageRenderer key={`img-${match.index}`} src={src} alt={alt} />);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    parts.push(...processInlineCode(remainingText));
  }

  return parts.length > 0 ? parts : [content];
};

// 处理行内代码
const processInlineCode = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const inlineCodeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match;

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${match.index}`} dangerouslySetInnerHTML={{
          __html: formatPlainText(text.slice(lastIndex, match.index))
        }} />
      );
    }

    parts.push(
      <code key={`inline-${match.index}`} className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
        {match[1]}
      </code>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-end`} dangerouslySetInnerHTML={{
        __html: formatPlainText(text.slice(lastIndex))
      }} />
    );
  }

  return parts.length > 0 ? parts : [text];
};

// 格式化普通文本（处理换行和链接）
const formatPlainText = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>'
    );
};

// 打字机光标组件
const StreamingCursor: React.FC = () => (
  <span className="animate-pulse text-primary">▊</span>
);

// 用户消息组件
const UserMessage: React.FC<{
  message: Message;
  onCopy?: (content: string) => void;
  onDelete?: (messageId: number) => void;
}> = ({ message, onCopy, onDelete }) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group flex flex-col items-end gap-1 px-4 py-2"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {formatContent(message.content)}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className={cn(
        "flex items-center gap-1 transition-opacity",
        showActions ? "opacity-100" : "opacity-0"
      )}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onCopy?.(message.content)}
          title="复制"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onDelete?.(message.id)}
          title="删除"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </Button>
      </div>

      {message.timestamp && (
        <span className="text-xs text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      )}
    </div>
  );
};

// 助手消息组件
const AssistantMessage: React.FC<{
  message: Message;
  onCopy?: (content: string) => void;
  onRegenerate?: (messageId: number) => void;
  onFeedback?: (messageId: number, type: 'like' | 'dislike') => void;
}> = ({ message, onCopy, onRegenerate, onFeedback }) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group flex flex-col gap-1 px-4 py-2"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* 助手名称和模型 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">AI 助手</span>
        {message.model && (
          <Badge variant="secondary" className="text-xs">{message.model}</Badge>
        )}
      </div>

      <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
          {formatContent(message.content)}
          {message.isStreaming && <StreamingCursor />}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className={cn(
        "flex items-center gap-1 transition-opacity",
        showActions ? "opacity-100" : "opacity-0"
      )}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onCopy?.(message.content)}
          title="复制"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onRegenerate?.(message.id)}
          title="重新生成"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onFeedback?.(message.id, 'like')}
          title="有用"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onFeedback?.(message.id, 'dislike')}
          title="无用"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
          </svg>
        </Button>
      </div>

      {message.timestamp && (
        <span className="text-xs text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      )}
    </div>
  );
};

// 主组件
export const ChatItem: React.FC<ChatItemProps> = ({
  message,
  onCopy,
  onRegenerate,
  onDelete,
  onFeedback,
}) => {
  if (message.role === 'user') {
    return (
      <UserMessage
        message={message}
        onCopy={onCopy}
        onDelete={onDelete}
      />
    );
  }

  return (
    <AssistantMessage
      message={message}
      onCopy={onCopy}
      onRegenerate={onRegenerate}
      onFeedback={onFeedback}
    />
  );
};

export default ChatItem;
