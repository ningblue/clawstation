/**
 * Thinking 组件
 * 展示AI的思考过程
 */

import React, { useState } from 'react';

export interface ThinkingProps {
  /** 思考内容 */
  content: string;
  /** 思考标题 */
  title?: string;
  /** 默认是否展开 */
  defaultExpanded?: boolean;
}

/**
 * Thinking 组件
 */
export const Thinking: React.FC<ThinkingProps> = ({
  content,
  title = '思考过程',
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!content || content.trim().length === 0) {
    return null;
  }

  return (
    <div className="thinking-section">
      <div
        className="thinking-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="thinking-icon">💭</span>
        <span className="thinking-label">{title}</span>
        <span className="thinking-expand">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="thinking-content">
          <pre>{content}</pre>
        </div>
      )}
    </div>
  );
};

/**
 * 解析消息中的 thinking 标签
 */
export const parseThinkingFromContent = (content: string): {
  mainContent: string;
  thinking?: string;
} => {
  // 匹配 <thinking> 标签
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/i;
  const match = content.match(thinkingRegex);

  if (match && match[1]) {
    return {
      mainContent: content.replace(thinkingRegex, '').trim(),
      thinking: match[1].trim(),
    };
  }

  // 匹配 think 代码块
  const thinkBlockRegex = /```think\s*([\s\S]*?)```/i;
  const thinkMatch = content.match(thinkBlockRegex);

  if (thinkMatch && thinkMatch[1]) {
    return {
      mainContent: content.replace(thinkBlockRegex, '').trim(),
      thinking: thinkMatch[1].trim(),
    };
  }

  return { mainContent: content };
};

export default Thinking;
