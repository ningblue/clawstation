// ConversationSidebar.tsx - 历史侧边栏

import React, { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  X,
  MessageSquare,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
      className={cn(
        'group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      onClick={onSelect}
    >
      <MessageSquare className="size-4 shrink-0" />

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            className="w-full bg-background border border-border rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
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
            <div className="text-sm truncate" title={conversation.title}>
              {conversation.title || '新对话'}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span>{formatRelativeTime(conversation.updatedAt)}</span>
              {conversation.messageCount !== undefined && (
                <span>{conversation.messageCount}条消息</span>
              )}
            </div>
          </>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            title="重命名"
          >
            <Pencil className="size-3" />
          </button>
          <button
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('确定要删除这个对话吗？')) {
                onDelete();
              }
            }}
            title="删除"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
};

// 分组标题
const GroupHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
    {title}
  </div>
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
    <div className="flex flex-col h-full bg-background">
      {/* 头部 */}
      <div className="p-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={onCreate}
        >
          <Plus className="size-4" />
          <span>新建对话</span>
        </Button>
      </div>

      {/* 搜索框 */}
      <div className={cn(
        'px-2 pb-2 shrink-0',
      )}>
        <div className={cn(
          'relative flex items-center rounded-md border transition-colors',
          isSearchFocused ? 'border-ring ring-1 ring-ring' : 'border-border',
        )}>
          <Search className="size-4 shrink-0 ml-2 text-muted-foreground" />
          <input
            type="text"
            className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="搜索对话..."
            value={searchQuery}
            onChange={handleSearch}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
          {searchQuery && (
            <button
              className="p-1 mr-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 对话列表 */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="px-2 pb-2">
          {hasConversations ? (
            <>
              {Object.entries(grouped).map(
                ([key, group]) =>
                  group.length > 0 && (
                    <div key={key}>
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
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              {searchQuery ? (
                <>
                  <Search className="size-10 mb-3 opacity-50" />
                  <p className="text-sm">未找到匹配的对话</p>
                </>
              ) : (
                <>
                  <MessageSquare className="size-10 mb-3 opacity-50" />
                  <p className="text-sm">暂无对话</p>
                  <p className="text-xs mt-1">点击上方按钮开始新对话</p>
                </>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 底部信息 */}
      <div className="border-t border-border px-3 py-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {conversations.length} 个对话
        </span>
      </div>
    </div>
  );
};

export default ConversationSidebar;
