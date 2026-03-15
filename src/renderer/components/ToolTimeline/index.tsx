/**
 * ToolTimeline 组件
 * 展示 AI 工具调用过程的时间线
 */

import React, { useState, useEffect } from 'react';
import type { ToolEvent } from '../../types/tool-event';
import {
  getToolDisplayName,
  getToolIcon,
  type ToolEventStatus,
} from '../../types/tool-event';
import './ToolTimeline.css';

/**
 * ToolTimeline 组件 Props
 */
interface ToolTimelineProps {
  /** 工具事件列表 */
  events: ToolEvent[];
  /** 是否展开所有卡片 */
  defaultExpanded?: boolean;
  /** 最大高度（超出时滚动） */
  maxHeight?: number;
  /** 点击事件回调 */
  onEventClick?: (event: ToolEvent) => void;
}

/**
 * 单个工具卡片 Props
 */
interface ToolCardProps {
  event: ToolEvent;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}

/**
 * 状态图标组件
 */
const StatusIcon: React.FC<{ status: ToolEventStatus; phase: string }> = ({
  status,
  phase,
}) => {
  // 执行中 - 旋转动画
  if (status === 'running' || phase === 'update') {
    return (
      <div className="tool-status-icon running">
        <div className="spinner" />
      </div>
    );
  }

  // 等待中
  if (status === 'pending') {
    return (
      <div className="tool-status-icon pending">
        <span className="icon">⏳</span>
      </div>
    );
  }

  // 成功
  if (status === 'success') {
    return (
      <div className="tool-status-icon success">
        <span className="icon">✓</span>
      </div>
    );
  }

  // 错误
  if (status === 'error') {
    return (
      <div className="tool-status-icon error">
        <span className="icon">✕</span>
      </div>
    );
  }

  return null;
};

/**
 * 参数预览组件
 */
const ArgsPreview: React.FC<{ args?: Record<string, unknown> }> = ({ args }) => {
  if (!args || Object.keys(args).length === 0) {
    return <span className="args-empty">无参数</span>;
  }

  // 优先显示常见的参数
  const priorityKeys = ['query', 'path', 'file', 'url', 'command', 'message'];
  const entries = Object.entries(args);

  // 按优先级排序
  entries.sort((a, b) => {
    const aIndex = priorityKeys.indexOf(a[0]);
    const bIndex = priorityKeys.indexOf(b[0]);
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return 0;
  });

  // 只显示第一个参数作为预览
  const firstEntry = entries[0];
  if (!firstEntry) {
    return <span className="args-empty">无参数</span>;
  }
  const [key, value] = firstEntry;
  const displayValue =
    typeof value === 'string'
      ? value
      : Array.isArray(value)
      ? `[${value.length} items]`
      : JSON.stringify(value).slice(0, 50);

  const hasMore = entries.length > 1;

  return (
    <span className="args-preview">
      <span className="args-key">{key}:</span>
      <span className="args-value" title={displayValue}>
        {displayValue}
      </span>
      {hasMore && <span className="args-more">+{entries.length - 1} more</span>}
    </span>
  );
};

/**
 * 结果展示组件
 */
const ResultView: React.FC<{ result?: unknown; error?: string }> = ({
  result,
  error,
}) => {
  if (error) {
    return (
      <div className="result-view error">
        <div className="result-label">错误</div>
        <pre className="result-content error">{error}</pre>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="result-view empty">
        <span>暂无结果</span>
      </div>
    );
  }

  // 格式化结果
  let displayContent: string;
  try {
    if (typeof result === 'string') {
      displayContent = result;
    } else {
      displayContent = JSON.stringify(result, null, 2);
    }
  } catch {
    displayContent = String(result);
  }

  // 截断过长的结果
  const maxLength = 500;
  const isTruncated = displayContent.length > maxLength;
  const content = isTruncated
    ? displayContent.slice(0, maxLength) + '...'
    : displayContent;

  return (
    <div className="result-view">
      <div className="result-label">执行结果</div>
      <pre className="result-content">{content}</pre>
      {isTruncated && (
        <div className="result-truncated">内容已截断，完整结果请查看会话日志</div>
      )}
    </div>
  );
};

/**
 * 单个工具卡片组件
 */
const ToolCard: React.FC<ToolCardProps> = ({
  event,
  isExpanded,
  onToggle,
  isLast,
}) => {
  const displayName = getToolDisplayName(event.name);
  const icon = getToolIcon(event.name);
  const showExpandButton = event.phase === 'result' || event.args;

  return (
    <div
      className={`tool-card ${event.status} ${isExpanded ? 'expanded' : ''}`}
      data-phase={event.phase}
    >
      {/* 时间线连接线 */}
      {!isLast && <div className="timeline-connector" />}

      {/* 状态图标 */}
      <div className="tool-status">
        <StatusIcon status={event.status} phase={event.phase} />
      </div>

      {/* 工具信息 */}
      <div className="tool-content" onClick={showExpandButton ? onToggle : undefined}>
        <div className="tool-header">
          <span className="tool-icon">{icon}</span>
          <span className="tool-name">{displayName}</span>
          {showExpandButton && (
            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
          )}
        </div>

        {/* 参数预览（折叠状态） */}
        {!isExpanded && event.args && (
          <div className="tool-preview">
            <ArgsPreview args={event.args} />
          </div>
        )}

        {/* 展开后的详情 */}
        {isExpanded && (
          <div className="tool-details">
            {/* 完整参数 */}
            {event.args && (
              <div className="detail-section">
                <div className="detail-label">参数</div>
                <pre className="detail-content args">
                  {JSON.stringify(event.args, null, 2)}
                </pre>
              </div>
            )}

            {/* 执行结果 */}
            {(event.phase === 'result' || event.result || event.error) && (
              <div className="detail-section">
                <ResultView result={event.result} error={event.error} />
              </div>
            )}
          </div>
        )}

        {/* 状态标签 */}
        <div className="tool-status-label">
          {event.status === 'running' && <span className="status-badge running">执行中...</span>}
          {event.status === 'success' && <span className="status-badge success">已完成</span>}
          {event.status === 'error' && <span className="status-badge error">执行失败</span>}
        </div>
      </div>
    </div>
  );
};

/**
 * ToolTimeline 主组件
 */
export const ToolTimeline: React.FC<ToolTimelineProps> = ({
  events,
  defaultExpanded = false,
  maxHeight = 400,
  onEventClick,
}) => {
  // 展开状态管理
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return defaultExpanded ? new Set(events.map((e) => e.id)) : new Set();
  });

  // 有新事件时自动滚动到底部
  const containerRef = React.useRef<HTMLDivElement>(null);
  const prevEventsLength = React.useRef(events.length);

  useEffect(() => {
    if (events.length > prevEventsLength.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    prevEventsLength.current = events.length;
  }, [events.length]);

  // 如果没有事件，不渲染
  if (events.length === 0) {
    return null;
  }

  // 按时间戳排序
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // 切换展开状态
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 全部展开/折叠
  const expandAll = () => {
    setExpandedIds(new Set(events.map((e) => e.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div className="tool-timeline-container">
      {/* 头部控制栏 */}
      <div className="timeline-header">
        <span className="timeline-title">🛠️ 工具调用</span>
        <span className="timeline-count">{events.length} 个</span>
        <div className="timeline-controls">
          <button className="control-btn" onClick={expandAll} title="展开全部">
            展开
          </button>
          <button className="control-btn" onClick={collapseAll} title="折叠全部">
            折叠
          </button>
        </div>
      </div>

      {/* 时间线内容 */}
      <div
        ref={containerRef}
        className="timeline-content"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {sortedEvents.map((event, index) => (
          <ToolCard
            key={event.id}
            event={event}
            isExpanded={expandedIds.has(event.id)}
            onToggle={() => toggleExpand(event.id)}
            isLast={index === sortedEvents.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

export default ToolTimeline;
