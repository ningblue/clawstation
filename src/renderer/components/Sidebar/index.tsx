/**
 * Sidebar 组件 - 参考 QClaw 设计
 * 左侧边栏：Header + 新建聊天 + 历史记录 + Footer
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronLeft,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Settings,
  LogOut,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Conversation } from "../../stores";

export interface SidebarProps {
  /** 对话列表 */
  conversations: Conversation[];
  /** 当前选中的对话ID */
  currentConversationId: number | null;
  /** 选择对话回调 */
  onSelectConversation: (conversationId: number) => void;
  /** 新建对话回调 */
  onNewConversation: () => void;
  /** 重命名对话回调 */
  onRenameConversation: (
    conversationId: number,
    newTitle: string,
  ) => Promise<boolean>;
  /** 删除对话回调 */
  onDeleteConversation: (conversationId: number) => Promise<boolean>;
  /** 侧边栏是否打开（移动端） */
  isOpen?: boolean;
  /** 关闭侧边栏回调（移动端） */
  onClose?: () => void;
  /** 用户信息 */
  user?: {
    username: string;
    email: string;
  };
  /** 打开设置回调 */
  onOpenSettings?: () => void;
  /** 退出登录回调 */
  onLogout?: () => void;
}

/**
 * 对话项组件 - 参考 QClaw 圆角 80px 设计
 */
interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  const handleStartEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      setEditTitle(conversation.title);
    },
    [conversation.title],
  );

  const handleFinishEdit = useCallback(async () => {
    const newTitle = editTitle.trim();
    if (newTitle && newTitle !== conversation.title) {
      await onRename(newTitle);
    }
    setIsEditing(false);
  }, [editTitle, conversation.title, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isComposing) {
        handleFinishEdit();
      } else if (e.key === "Escape") {
        setEditTitle(conversation.title);
        setIsEditing(false);
      }
    },
    [handleFinishEdit, conversation.title, isComposing],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm(`确定要删除会话 "${conversation.title}" 吗？`)) {
        await onDelete();
      }
    },
    [conversation.title, onDelete],
  );

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={onSelect}
    >
      {isEditing ? (
        <input
          type="text"
          className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleFinishEdit}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="flex items-center gap-2 truncate flex-1 min-w-0">
            <MessageSquare className="size-3.5 shrink-0" />
            {conversation.title}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4 text-muted-foreground hover:text-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" sideOffset={4}>
              <DropdownMenuItem onClick={handleStartEdit}>
                <Pencil className="size-4" />
                <span>重命名</span>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                <Trash2 className="size-4" />
                <span>删除</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
};

/**
 * Sidebar 组件 - 参考 QClaw 布局
 */
export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  isOpen = false,
  onClose,
  user,
  onOpenSettings,
  onLogout,
}) => {
  // 分组对话
  const groupConversations = () => {
    const groups: {
      today: Conversation[];
      yesterday: Conversation[];
      older: Conversation[];
    } = {
      today: [],
      yesterday: [],
      older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    conversations.forEach((conv) => {
      const date = new Date(conv.updatedAt);
      if (date >= today) {
        groups.today.push(conv);
      } else if (date >= yesterday) {
        groups.yesterday.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  };

  const grouped = groupConversations();

  // 获取用户显示信息
  const getUserDisplay = () => {
    if (user?.username) {
      return {
        name: user.username,
        initial: user.username.charAt(0).toUpperCase(),
      };
    }
    return { name: "Demo User", initial: "D" };
  };

  const { name, initial } = getUserDisplay();

  return (
    <>
      {/* 移动端遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "flex flex-col h-full bg-background border-r border-border shrink-0",
          "w-[240px] min-w-[240px]",
          // Mobile: fixed overlay
          "fixed inset-y-0 left-0 z-50 md:static md:z-auto",
          isOpen ? "flex" : "hidden md:flex",
        )}
      >
        {/* Header - 仅关闭按钮 */}
        <div className="flex items-center h-10 px-2 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            aria-label="收起侧边栏"
          >
            <ChevronLeft className="size-5" />
          </Button>
        </div>

        {/* 新建对话按钮 */}
        <div className="px-2 shrink-0">
          <button
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            onClick={() => onNewConversation?.()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNewConversation?.();
              }
            }}
          >
            <Plus className="size-5" />
            <span>新建对话</span>
          </button>
        </div>

        {/* 历史记录标题 */}
        <div className="px-4 py-2 text-xs font-medium text-muted-foreground shrink-0">
          历史记录
        </div>

        {/* 历史记录列表 */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="px-2 space-y-0.5">
            {conversations.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无历史记录
              </div>
            ) : (
              <>
                {grouped.today.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === currentConversationId}
                    onSelect={() => onSelectConversation(conv.id)}
                    onRename={(title) => onRenameConversation(conv.id, title)}
                    onDelete={() => onDeleteConversation(conv.id)}
                  />
                ))}
                {grouped.yesterday.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === currentConversationId}
                    onSelect={() => onSelectConversation(conv.id)}
                    onRename={(title) => onRenameConversation(conv.id, title)}
                    onDelete={() => onDeleteConversation(conv.id)}
                  />
                ))}
                {grouped.older.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === currentConversationId}
                    onSelect={() => onSelectConversation(conv.id)}
                    onRename={(title) => onRenameConversation(conv.id, title)}
                    onDelete={() => onDeleteConversation(conv.id)}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer - 用户信息 */}
        <div className="border-t border-border p-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
              <div className="flex items-center justify-center size-6 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {initial}
              </div>
              <span className="text-sm text-foreground truncate">{name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={8}>
              <DropdownMenuItem onClick={() => onOpenSettings?.()}>
                <Settings className="size-4" />
                <span>设置</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onLogout?.()}>
                <LogOut className="size-4" />
                <span>退出</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
