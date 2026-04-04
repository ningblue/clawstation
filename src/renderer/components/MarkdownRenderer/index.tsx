/**
 * MarkdownRenderer 组件
 * 支持 Markdown 渲染、代码高亮、思考过程展示
 */

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 自定义代码块组件
const CodeBlock = ({ children, className, inline, node, ...props }: any) => {
  const isInline = inline || !className || !String(children).includes('\n');

  if (isInline) {
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  }

  // 代码块
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, [code]);

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between bg-muted px-4 py-2">
        <span className="text-xs text-muted-foreground">{language || 'text'}</span>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 gap-1 text-xs text-muted-foreground hover:text-foreground",
            copied && "text-green-500"
          )}
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
        style={oneLight}
        language={language}
        PreTag="div"
        showLineNumbers={false}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '0.8125rem',
          background: 'transparent',
          padding: '1rem',
        }}
        {...props}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

// 思考过程组件
const ThinkingBlock = ({ content }: { content: string }) => {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className={cn(
      "mb-3 overflow-hidden rounded-lg border border-border bg-muted/50",
      !collapsed && "border-primary/20"
    )}>
      <div
        className="flex cursor-pointer items-center justify-between px-3 py-2"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
          </svg>
          <span className="text-sm font-medium text-muted-foreground">思考过程</span>
        </div>
        <svg
          className={cn("h-4 w-4 text-muted-foreground transition-transform", !collapsed && "rotate-180")}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {!collapsed && (
        <div className="border-t border-border px-3 py-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

// 解析消息内容，分离思考过程和实际内容
const parseMessageContent = (content: string) => {
  const thinkRegex = /<think[^>]*>([\s\S]*?)<\/think>/gi;
  const thinkingMatches = [...content.matchAll(thinkRegex)];

  let thinkingContent = '';
  let mainContent = content;

  if (thinkingMatches.length > 0) {
    thinkingContent = thinkingMatches.map(m => m[1]).join('\n\n');
    mainContent = content.replace(thinkRegex, '').trim();
  }

  return { thinkingContent, mainContent };
};

interface MarkdownRendererProps {
  content: string;
  showThinking?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  showThinking = true,
}) => {
  const { thinkingContent, mainContent } = parseMessageContent(content);

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none break-words prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-table:border prose-table:border-border prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5 prose-tr:border-b prose-tr:border-border">
      {showThinking && thinkingContent && (
        <ThinkingBlock content={thinkingContent} />
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code: CodeBlock,
        }}
      >
        {mainContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
