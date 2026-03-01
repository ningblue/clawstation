// 对话列表组件

import { Component } from './Component.js';
import { createElement, formatRelativeTime } from '../utils/dom-utils.js';
import { eventBus, Events } from '../utils/event-bus.js';
import { Conversation } from '../types/electron-api.d.js';
import { toast } from './Toast.js';

export interface ConversationListOptions {
  onSelect?: (conversationId: number) => void;
  onDelete?: (conversationId: number) => void;
  onRename?: (conversationId: number, newTitle: string) => void;
  onCreate?: () => void;
}

export class ConversationList extends Component {
  private conversationOptions: ConversationListOptions;
  private conversations: Conversation[] = [];
  private activeConversationId: number | null = null;
  private listElement: HTMLElement | null = null;
  private editingId: number | null = null;

  constructor(options: ConversationListOptions = {}) {
    super({ className: 'sidebar' });
    this.conversationOptions = options;
  }

  protected override render(): HTMLElement {
    const element = createElement('div', 'sidebar');
    element.style.cssText = `
      width: 260px;
      background-color: #ffffff;
      border-right: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // 侧边栏头部
    const header = createElement('div', 'sidebar-header');
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
    `;

    // 新建对话按钮
    const newChatBtn = createElement('button', 'new-chat-btn');
    newChatBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      <span>新建对话</span>
    `;
    newChatBtn.style.cssText = `
      width: 100%;
      padding: 10px;
      border-radius: 8px;
      background-color: #2563eb;
      color: white;
      border: none;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    `;
    newChatBtn.addEventListener('mouseenter', () => {
      newChatBtn.style.backgroundColor = '#1d4ed8';
    });
    newChatBtn.addEventListener('mouseleave', () => {
      newChatBtn.style.backgroundColor = '#2563eb';
    });
    newChatBtn.addEventListener('click', () => {
      this.conversationOptions.onCreate?.();
      eventBus.emit(Events.CONVERSATION_CREATED);
    });

    header.appendChild(newChatBtn);
    element.appendChild(header);

    // 对话列表
    this.listElement = createElement('div', 'conversations-list');
    this.listElement.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `;

    element.appendChild(this.listElement);

    return element;
  }

  setConversations(conversations: Conversation[]): void {
    this.conversations = conversations;
    this.renderList();
  }

  addConversation(conversation: Conversation): void {
    this.conversations.unshift(conversation);
    this.renderList();
    this.setActiveConversation(conversation.id);
  }

  removeConversation(conversationId: number): void {
    this.conversations = this.conversations.filter(c => c.id !== conversationId);
    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null;
    }
    this.renderList();
  }

  updateConversation(conversation: Conversation): void {
    const index = this.conversations.findIndex(c => c.id === conversation.id);
    if (index !== -1) {
      this.conversations[index] = conversation;
      this.renderList();
    }
  }

  setActiveConversation(conversationId: number | null): void {
    this.activeConversationId = conversationId;
    this.renderList();
  }

  private renderList(): void {
    if (!this.listElement) return;

    this.listElement.innerHTML = '';

    if (this.conversations.length === 0) {
      const empty = createElement('div', 'conversations-empty');
      empty.textContent = '暂无对话';
      empty.style.cssText = `
        text-align: center;
        padding: 40px 20px;
        color: #9ca3af;
        font-size: 14px;
      `;
      this.listElement.appendChild(empty);
      return;
    }

    this.conversations.forEach(conversation => {
      const item = this.createConversationItem(conversation);
      this.listElement!.appendChild(item);
    });
  }

  private createConversationItem(conversation: Conversation): HTMLElement {
    const isActive = conversation.id === this.activeConversationId;
    const isEditing = conversation.id === this.editingId;

    const item = createElement('div', `conversation-item ${isActive ? 'active' : ''}`);
    item.style.cssText = `
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 4px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      background-color: ${isActive ? '#eff6ff' : 'transparent'};
      border: 1px solid ${isActive ? '#bfdbfe' : 'transparent'};
    `;

    // 图标
    const icon = createElement('span', 'conversation-icon');
    icon.innerHTML = '💬';
    icon.style.cssText = 'flex-shrink: 0;';
    item.appendChild(icon);

    // 内容区域
    const content = createElement('div', 'conversation-content');
    content.style.cssText = `
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;

    if (isEditing) {
      // 编辑模式
      const input = document.createElement('input');
      input.type = 'text';
      input.value = conversation.title;
      input.style.cssText = `
        flex: 1;
        border: 1px solid #2563eb;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 14px;
        outline: none;
        background: white;
      `;

      const saveEdit = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== conversation.title) {
          this.conversationOptions.onRename?.(conversation.id, newTitle);
          eventBus.emit(Events.CONVERSATION_UPDATED, { id: conversation.id, title: newTitle });
        }
        this.editingId = null;
        this.renderList();
      };

      input.addEventListener('blur', saveEdit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveEdit();
        } else if (e.key === 'Escape') {
          this.editingId = null;
          this.renderList();
        }
      });

      // 自动聚焦
      setTimeout(() => input.focus(), 0);

      content.appendChild(input);
    } else {
      // 显示模式
      const title = createElement('div', 'conversation-title');
      title.textContent = conversation.title || '新对话';
      title.style.cssText = `
        font-weight: ${isActive ? '500' : '400'};
        color: ${isActive ? '#1e40af' : '#374151'};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      content.appendChild(title);

      // 时间
      if (conversation.updatedAt) {
        const time = createElement('div', 'conversation-time');
        time.textContent = formatRelativeTime(conversation.updatedAt);
        time.style.cssText = `
          font-size: 12px;
          color: #9ca3af;
        `;
        content.appendChild(time);
      }
    }

    item.appendChild(content);

    // 操作按钮
    if (!isEditing) {
      const actions = createElement('div', 'conversation-actions');
      actions.style.cssText = `
        display: flex;
        gap: 4px;
        opacity: ${isActive ? '1' : '0'};
        transition: opacity 0.2s;
      `;

      // 重命名按钮
      const renameBtn = this.createActionButton('✏️', () => {
        this.editingId = conversation.id;
        this.renderList();
      });
      actions.appendChild(renameBtn);

      // 删除按钮
      const deleteBtn = this.createActionButton('🗑️', () => {
        if (confirm('确定要删除这个对话吗？')) {
          this.conversationOptions.onDelete?.(conversation.id);
          eventBus.emit(Events.CONVERSATION_DELETED, conversation.id);
        }
      });
      actions.appendChild(deleteBtn);

      item.appendChild(actions);

      // 悬停显示操作按钮
      item.addEventListener('mouseenter', () => {
        actions.style.opacity = '1';
      });
      item.addEventListener('mouseleave', () => {
        if (!isActive) {
          actions.style.opacity = '0';
        }
      });
    }

    // 点击选择
    item.addEventListener('click', (e) => {
      // 如果点击的是操作按钮，不触发选择
      if ((e.target as HTMLElement).closest('.conversation-actions')) {
        return;
      }
      this.setActiveConversation(conversation.id);
      this.conversationOptions.onSelect?.(conversation.id);
      eventBus.emit(Events.CONVERSATION_SELECTED, conversation.id);
    });

    return item;
  }

  private createActionButton(icon: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.innerHTML = icon;
    btn.style.cssText = `
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.2s;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = 'transparent';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  update(): void {
    this.renderList();
  }
}

export default ConversationList;
