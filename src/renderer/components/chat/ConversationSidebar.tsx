// ConversationSidebar.tsx - 历史侧边栏

import React, { useState, useCallback, useMemo } from 'react';

export interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
  onSearch?: (query: string) => void;
}

// 分组对话
const groupConversations = (conversations: Conversation[]) => {
  const groups: Record<string, Conversation[]> = {
    today: [],
    yesterday: [],
    last7Days: [],
    last30Days: [],
    older: [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 7);
  const last30Days = new Date(today);
  last30Days.setDate(last30Days.getDate() - 30);

  for (const conv of conversations) {
    const updatedAt = new Date(conv.updatedAt);

    if (updatedAt >= today) {
      groups['today']!.push(conv);
    } else if (updatedAt >= yesterday) {
      groups['yesterday']!.push(conv);
    } else if (updatedAt >= last7Days) {
      groups['last7Days']!.push(conv);
    } else if (updatedAt >= last30Days) {
      groups['last30Days']!.push(conv);
    } else {
      groups['older']!.push(conv);
    }
  }

  return groups;
};

// 格式化相对时间
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
};

// 对话项组件
const ConversationItem: React.FC<{
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}> = ({ conversation, isActive, onSelect, onDelete, onRename }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  const handleRename = useCallback(() => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  }, [editTitle, conversation.title, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isComposing) {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditTitle(conversation.title);
      setIsEditing(false);
    }
  }, [handleRename, conversation.title, isComposing]);

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <div className="conversation-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>

      <div className="conversation-content">
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div className="conversation-title" title={conversation.title}>
              {conversation.title || '新对话'}
            </div>
            <div className="conversation-meta">
              <span>{formatRelativeTime(conversation.updatedAt)}</span>
              {conversation.messageCount !== undefined && (
                <span>{conversation.messageCount}条消息</span>
              )}
            </div>
          </>
        )}
      </div>

      {!isEditing && (
        <div className="conversation-actions">
          <button
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            title="重命名"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button
            className="action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('确定要删除这个对话吗？')) {
                onDelete();
              }
            }}
            title="删除"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

// 分组标题
const GroupHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="group-header">{title}</div>
);

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // 过滤对话
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // 分组
  const grouped = useMemo(
    () => groupConversations(filteredConversations),
    [filteredConversations]
  );

  // 处理搜索
  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      onSearch?.(query);
    },
    [onSearch]
  );

  // 清空搜索
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    onSearch?.('');
  }, [onSearch]);

  const groupLabels: Record<string, string> = {
    today: '今天',
    yesterday: '昨天',
    last7Days: '过去7天',
    last30Days: '过去30天',
    older: '更早',
  };

  const hasConversations = Object.values(grouped).some(
    (group) => group.length > 0
  );

  return (
    <div className="conversation-sidebar">
      {/* 头部 */}
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>新建对话</span>
        </button>
      </div>

      {/* 搜索框 */}
      <div className={`search-box ${isSearchFocused ? 'focused' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          placeholder="搜索对话..."
          value={searchQuery}
          onChange={handleSearch}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
        {searchQuery && (
          <button className="clear-search" onClick={clearSearch}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {/* 对话列表 */}
      <div className="conversations-list">
        {hasConversations ? (
          <>
            {Object.entries(grouped).map(
              ([key, group]) =>
                group.length > 0 && (
                  <div key={key} className="conversation-group">
                    <GroupHeader title={groupLabels[key] || key} />
                    {group.map((conversation) => (
                      <ConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        isActive={conversation.id === activeId}
                        onSelect={() => onSelect(conversation.id)}
                        onDelete={() => onDelete(conversation.id)}
                        onRename={(title) => onRename(conversation.id, title)}
                      />
                    ))}
                  </div>
                )
            )}
          </>
        ) : (
          <div className="empty-state">
            {searchQuery ? (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <p>未找到匹配的对话</p>
              </>
            ) : (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <p>暂无对话</p>
                <p className="empty-hint">点击上方按钮开始新对话</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="sidebar-footer">
        <div className="footer-info">
          <span>{conversations.length} 个对话</span>
        </div>
      </div>
    </div>
  );
};

export default ConversationSidebar;
