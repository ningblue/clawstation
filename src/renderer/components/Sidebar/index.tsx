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
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleStartEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowMenu(false);
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
      setShowMenu(false);
      if (confirm(`确定要删除会话 "${conversation.title}" 吗？`)) {
        await onDelete();
      }
    },
    [conversation.title, onDelete],
  );

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu((prev) => !prev);
  }, []);

  return (
    <div
      ref={menuRef}
      className={`sidebar-history-item ${isActive ? "active" : ""}`}
      onClick={onSelect}
    >
      {isEditing ? (
        <input
          type="text"
          className="conversation-title-input"
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
          <span className="sidebar-history-item-text">
            <MessageSquare
              size={14}
              style={{ marginRight: 8, flexShrink: 0 }}
            />
            {conversation.title}
          </span>
          <button
            className="conversation-menu-btn"
            onClick={toggleMenu}
            title="更多操作"
          >
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <div className="conversation-menu-dropdown">
              <button
                className="conversation-menu-item"
                onClick={handleStartEdit}
              >
                <Pencil size={14} />
                <span>重命名</span>
              </button>
              <button
                className="conversation-menu-item danger"
                onClick={handleDelete}
              >
                <Trash2 size={14} />
                <span>删除</span>
              </button>
            </div>
          )}
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭用户菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserMenu]);

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

  return (
    <>
      {/* 移动端遮罩 - 仅在移动端显示 */}
      <div
        className="sidebar-overlay"
        onClick={onClose}
        style={{ display: isOpen ? "block" : "none" }}
      />

      <aside
        className="sidebar"
        style={{
          display: isOpen ? "flex" : "none",
          width: "240px",
          minWidth: "240px",
        }}
      >
        {/* Header - 仅关闭按钮 */}
        <div className="sidebar-header">
          <button
            className="sidebar-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            type="button"
            aria-label="收起侧边栏"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* 新建对话按钮 */}
        <div
          className="sidebar-new-chat"
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
          <Plus size={20} />
          <span>新建对话</span>
        </div>

        {/* 历史记录标题 */}
        <div className="sidebar-history-title">历史记录</div>

        {/* 历史记录列表 */}
        <div className="sidebar-history">
          {conversations.length === 0 ? (
            <div className="sidebar-empty">
              <div className="sidebar-empty-text">暂无历史记录</div>
            </div>
          ) : (
            <div className="sidebar-history-list">
              {grouped.today.length > 0 && (
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
                </>
              )}
              {grouped.yesterday.length > 0 && (
                <>
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
                </>
              )}
              {grouped.older.length > 0 && (
                <>
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
          )}
        </div>

        {/* Footer - 用户信息 */}
        <div className="sidebar-footer" ref={userMenuRef}>
          <div className="sidebar-footer-row">
            <div
              className="sidebar-user"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="sidebar-user-avatar-default">{initial}</div>
              <span className="sidebar-user-name">{name}</span>
            </div>
          </div>

          {/* 用户菜单 */}
          {showUserMenu && (
            <div className="sidebar-user-menu">
              <button
                className="user-menu-item"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenSettings?.();
                }}
              >
                <Settings size={16} />
                <span>设置</span>
              </button>
              <button
                className="user-menu-item danger"
                onClick={() => {
                  setShowUserMenu(false);
                  onLogout?.();
                }}
              >
                <LogOut size={16} />
                <span>退出</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
