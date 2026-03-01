/**
 * MarkdownRenderer 组件
 * 支持 Markdown 渲染、代码高亮、思考过程展示
 */

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// 自定义代码块组件
const CodeBlock = ({ children, className, inline, node, ...props }: any) => {
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

  if (!inline && code) {
    return (
      <div className="code-block-wrapper">
        <div className="code-block-header">
          <span className="code-language">{language || 'text'}</span>
          <button className={`code-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
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
          </button>
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          showLineNumbers={false}
          customStyle={{
            margin: 0,
            borderRadius: '0 0 8px 8px',
            fontSize: '13px',
          }}
          {...props}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code className="inline-code" {...props}>
      {children}
    </code>
  );
};

// 思考过程组件
const ThinkingBlock = ({ content }: { content: string }) => {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className={`thinking-block ${collapsed ? 'collapsed' : ''}`}>
      <div className="thinking-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="thinking-title">
          <svg className="thinking-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
          </svg>
          <span>思考过程</span>
        </div>
        <div className="thinking-toggle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      {!collapsed && (
        <div className="thinking-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

// 解析消息内容，分离思考过程和实际内容
const parseMessageContent = (content: string) => {
  // 匹配 think 标签
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const thinkingMatches = [...content.matchAll(thinkRegex)];

  let thinkingContent = '';
  let mainContent = content;

  if (thinkingMatches.length > 0) {
    thinkingContent = thinkingMatches.map(m => m[1]).join('\n\n');
    // 移除 think 标签
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
    <div className="markdown-content">
      {showThinking && thinkingContent && (
        <ThinkingBlock content={thinkingContent} />
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
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
