/**
 * ToolCard 组件
 * 展示工具调用和工具执行结果
 */

import React, { useState } from 'react';
import './styles.css';

// 工具类型定义
export interface ToolCall {
  type: 'toolcall' | 'tool_call' | 'tooluse' | 'tool_use';
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  type: 'toolresult' | 'tool_result';
  name: string;
  text?: string;
  content?: string;
  error?: string;
}

export interface ToolCardProps {
  tool: ToolCall | ToolResult;
  status?: 'pending' | 'success' | 'error';
}

// 工具显示配置
const TOOL_DISPLAY_CONFIG: Record<string, { icon: string; title: string }> = {
  bash: { icon: '🛠️', title: '终端' },
  browser: { icon: '🌐', title: '浏览器' },
  read: { icon: '📖', title: '读取文件' },
  write: { icon: '✍️', title: '写入文件' },
  web_search: { icon: '🔍', title: '网络搜索' },
  grep: { icon: '🔎', title: '文本搜索' },
  glob: { icon: '📁', title: '文件匹配' },
  edit: { icon: '✏️', title: '编辑文件' },
  delete: { icon: '🗑️', title: '删除文件' },
  reapply: { icon: '🔄', title: '重新应用' },
  list: { icon: '📋', title: '列出' },
  view: { icon: '👁️', title: '查看' },
  search: { icon: '🔍', title: '搜索' },
};

// 获取工具显示信息
const getToolDisplay = (toolName: string): { icon: string; title: string } => {
  return TOOL_DISPLAY_CONFIG[toolName] || { icon: '🔧', title: toolName };
};

// 格式化参数显示
const formatArgs = (args: Record<string, unknown>): string => {
  const keys = Object.keys(args);
  if (keys.length === 0) return '';

  // 优先显示关键参数
  const priorityKeys = ['query', 'pattern', 'path', 'url', 'command', 'file'];
  for (const key of priorityKeys) {
    if (args[key]) {
      const value = String(args[key]);
      return value.length > 50 ? value.slice(0, 50) + '...' : value;
    }
  }

  // 显示第一个参数
  const firstKey = keys[0];
  if (!firstKey) return '';
  const value = String(args[firstKey]);
  return value.length > 50 ? value.slice(0, 50) + '...' : value;
};

// 判断是否为工具调用
const isToolCall = (tool: ToolCall | ToolResult): tool is ToolCall => {
  return ['toolcall', 'tool_call', 'tooluse', 'tool_use'].includes(tool.type);
};

/**
 * ToolCard 组件
 */
export const ToolCard: React.FC<ToolCardProps> = ({ tool, status = 'pending' }) => {
  const [expanded, setExpanded] = useState(false);
  const display = getToolDisplay(tool.name);
  const isCall = isToolCall(tool);

  // 获取状态图标
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'pending':
      default:
        return '⟳';
    }
  };

  // 获取详情文本
  const getDetailText = () => {
    if (isCall) {
      return formatArgs(tool.arguments);
    }
    // 工具结果
    const result = tool as ToolResult;
    if (result.error) {
      return `错误: ${result.error}`;
    }
    const content = result.text || result.content || '';
    return content.length > 100 ? content.slice(0, 100) + '...' : content;
  };

  // 获取完整内容（展开时显示）
  const getFullContent = () => {
    if (isCall) {
      return JSON.stringify(tool.arguments, null, 2);
    }
    const result = tool as ToolResult;
    if (result.error) {
      return result.error;
    }
    return result.text || result.content || '';
  };

  const detailText = getDetailText();
  const hasMoreContent = getFullContent().length > (isCall ? 50 : 100);

  return (
    <div className={`tool-card ${status} ${expanded ? 'expanded' : ''}`}>
      <div className="tool-card-header" onClick={() => hasMoreContent && setExpanded(!expanded)}>
        <div className="tool-icon">{display.icon}</div>
        <div className="tool-info">
          <div className="tool-label">
            <span className="tool-name">{display.title}</span>
            <span className={`tool-status ${status}`}>{getStatusIcon()}</span>
          </div>
          {detailText && (
            <div className="tool-detail" title={detailText}>
              {detailText}
            </div>
          )}
        </div>
        {hasMoreContent && (
          <div className="tool-expand-icon">
            {expanded ? '▼' : '▶'}
          </div>
        )}
      </div>

      {expanded && (
        <div className="tool-card-content">
          <pre className="tool-content-pre">{getFullContent()}</pre>
        </div>
      )}
    </div>
  );
};

/**
 * ToolCardList 组件 - 显示多个工具调用
 */
export interface ToolCardListProps {
  tools: Array<{ tool: ToolCall | ToolResult; status?: 'pending' | 'success' | 'error' }>;
}

export const ToolCardList: React.FC<ToolCardListProps> = ({ tools }) => {
  if (!tools || tools.length === 0) return null;

  return (
    <div className="tool-card-list">
      {tools.map((item, index) => (
        <ToolCard key={index} tool={item.tool} status={item.status} />
      ))}
    </div>
  );
};

export default ToolCard;
