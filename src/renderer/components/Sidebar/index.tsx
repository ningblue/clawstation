/**
 * Sidebar 组件
 * 左侧可伸缩菜单栏：Logo+伸缩、新建任务、任务记录、用户信息
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Conversation } from '../../stores';

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
  onRenameConversation: (conversationId: number, newTitle: string) => Promise<boolean>;
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
 * 对话项组件
 */
interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isCollapsed: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  isCollapsed,
  onSelect,
  onRename,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
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
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setIsEditing(true);
    setEditTitle(conversation.title);
  }, [conversation.title]);

  const handleFinishEdit = useCallback(async () => {
    const newTitle = editTitle.trim();
    if (newTitle && newTitle !== conversation.title) {
      await onRename(newTitle);
    }
    setIsEditing(false);
  }, [editTitle, conversation.title, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setEditTitle(conversation.title);
      setIsEditing(false);
    }
  }, [handleFinishEdit, conversation.title]);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (confirm(`确定要删除会话 "${conversation.title}" 吗？`)) {
      await onDelete();
    }
  }, [conversation.title, onDelete]);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(prev => !prev);
  }, []);

  if (isCollapsed) {
    return (
      <div
        className={`sidebar-item-icon ${isActive ? 'active' : ''}`}
        onClick={onSelect}
        title={conversation.title}
      >
        {conversation.title.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className={`conversation-item ${isActive ? 'active' : ''}`}
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
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <div className="conversation-info">
            <span className="conversation-title">{conversation.title}</span>
          </div>
          <div className="conversation-menu-wrapper">
            <button
              className="conversation-menu-btn"
              onClick={toggleMenu}
              title="更多操作"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
            </button>
            {showMenu && (
              <div className="conversation-menu-dropdown">
                <button className="conversation-menu-item" onClick={handleStartEdit}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  <span>重命名</span>
                </button>
                <button className="conversation-menu-item danger" onClick={handleDelete}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>删除</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Sidebar 组件
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
  const [collapsed, setCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭用户菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
    return { name: 'Demo User', initial: 'D' };
  };

  const { name, initial } = getUserDisplay();

  // 分组对话
  const groupConversations = () => {
    const groups: { today: Conversation[]; yesterday: Conversation[]; older: Conversation[] } = {
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

  const sidebarWidth = collapsed ? '60px' : '240px';

  return (
    <>
      {/* 移动端遮罩 */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}
        style={{ width: sidebarWidth }}
      >
        {/* 第一行：Logo + 伸缩按钮 */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">C</div>
            {!collapsed && <span className="logo-text">ClawStation</span>}
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? '展开' : '收起'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed ? (
                <path d="M9 18l6-6-6-6" />
              ) : (
                <path d="M15 18l-6-6 6-6" />
              )}
            </svg>
          </button>
        </div>

        {/* 第二行：新建任务按钮 */}
        <div className="sidebar-actions">
          <button
            className="new-task-btn"
            onClick={onNewConversation}
            title="新建对话"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            {!collapsed && <span>新建任务</span>}
          </button>
        </div>

        {/* 第三部分：任务记录（对话列表） */}
        <div className="sidebar-section">
          {!collapsed && <div className="sidebar-section-title">任务记录</div>}
          <div className="conversations-list">
            {conversations.length === 0 ? (
              !collapsed && (
                <div className="empty-conversations">
                  暂无任务记录
                </div>
              )
            ) : (
              <>
                {grouped.today.length > 0 && !collapsed && (
                  <div className="conversation-group">
                    <div className="group-label">今天</div>
                    {grouped.today.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === currentConversationId}
                        isCollapsed={collapsed}
                        onSelect={() => onSelectConversation(conv.id)}
                        onRename={(title) => onRenameConversation(conv.id, title)}
                        onDelete={() => onDeleteConversation(conv.id)}
                      />
                    ))}
                  </div>
                )}
                {grouped.yesterday.length > 0 && !collapsed && (
                  <div className="conversation-group">
                    <div className="group-label">昨天</div>
                    {grouped.yesterday.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === currentConversationId}
                        isCollapsed={collapsed}
                        onSelect={() => onSelectConversation(conv.id)}
                        onRename={(title) => onRenameConversation(conv.id, title)}
                        onDelete={() => onDeleteConversation(conv.id)}
                      />
                    ))}
                  </div>
                )}
                {grouped.older.length > 0 && !collapsed && (
                  <div className="conversation-group">
                    <div className="group-label">更早</div>
                    {grouped.older.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === currentConversationId}
                        isCollapsed={collapsed}
                        onSelect={() => onSelectConversation(conv.id)}
                        onRename={(title) => onRenameConversation(conv.id, title)}
                        onDelete={() => onDeleteConversation(conv.id)}
                      />
                    ))}
                  </div>
                )}
                {/* 收起状态只显示图标列表 */}
                {collapsed && conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === currentConversationId}
                    isCollapsed={collapsed}
                    onSelect={() => onSelectConversation(conv.id)}
                    onRename={(title) => onRenameConversation(conv.id, title)}
                    onDelete={() => onDeleteConversation(conv.id)}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* 第四部分：用户信息 */}
        <div className="sidebar-user" ref={userMenuRef}>
          <button
            className="user-info-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar-small">{initial}</div>
            {!collapsed && (
              <>
                <div className="user-details">
                  <div className="user-name">{name}</div>
                  <div className="user-email">{user?.email || 'demo@clawstation.local'}</div>
                </div>
                <svg className="user-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </>
            )}
          </button>

          {/* 用户菜单 */}
          {showUserMenu && !collapsed && (
            <div className="sidebar-user-menu">
              <button
                className="user-menu-item"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenSettings?.();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                <span>设置</span>
              </button>
              <button
                className="user-menu-item danger"
                onClick={() => {
                  setShowUserMenu(false);
                  onLogout?.();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
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
