// 消息气泡组件

import { Component } from './Component.js';
import { createElement, escapeHtml, formatDate, copyToClipboard } from '../utils/dom-utils.js';
import { Message } from '../types/electron-api.d.js';
import { toast } from './Toast.js';

export interface MessageBubbleOptions {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  messageId?: number;
  onDelete?: (messageId: number) => void;
}

export class MessageBubble extends Component {
  private messageOptions: MessageBubbleOptions;

  constructor(options: MessageBubbleOptions) {
    super({ className: 'message' });
    this.messageOptions = options;
  }

  protected override render(): HTMLElement {
    const { role, content, timestamp } = this.messageOptions;

    const element = createElement('div', `message message-${role}`);
    element.style.cssText = `
      display: flex;
      gap: 12px;
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
      animation: messageSlideIn 0.3s ease-out;
    `;

    // 头像
    const avatar = this.createAvatar(role);
    element.appendChild(avatar);

    // 内容区域
    const contentWrapper = createElement('div', 'message-content-wrapper');
    contentWrapper.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    // 消息内容
    const messageContent = createElement('div', 'message-content');
    messageContent.style.cssText = `
      background-color: ${role === 'user' ? '#2563eb' : '#ffffff'};
      color: ${role === 'user' ? '#ffffff' : '#374151'};
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 15px;
      line-height: 1.6;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      word-wrap: break-word;
    `;

    // 处理代码块和格式化
    messageContent.innerHTML = this.formatContent(content, role);

    contentWrapper.appendChild(messageContent);

    // 时间戳和操作按钮
    const metaRow = createElement('div', 'message-meta');
    metaRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      padding: 0 4px;
    `;

    if (timestamp) {
      const time = createElement('span', 'message-time');
      time.textContent = formatDate(timestamp);
      time.style.cssText = `
        font-size: 12px;
        color: #9ca3af;
      `;
      metaRow.appendChild(time);
    }

    // 操作按钮
    const actions = createElement('div', 'message-actions');
    actions.style.cssText = `
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    `;

    // 复制按钮
    const copyBtn = this.createActionButton('复制', () => this.copyContent());
    actions.appendChild(copyBtn);

    // 删除按钮（仅用户消息）
    if (role === 'user' && this.messageOptions.messageId) {
      const deleteBtn = this.createActionButton('删除', () => this.deleteMessage());
      actions.appendChild(deleteBtn);
    }

    metaRow.appendChild(actions);
    contentWrapper.appendChild(metaRow);

    // 悬停显示操作按钮
    element.addEventListener('mouseenter', () => {
      actions.style.opacity = '1';
    });
    element.addEventListener('mouseleave', () => {
      actions.style.opacity = '0';
    });

    element.appendChild(contentWrapper);

    return element;
  }

  private createAvatar(role: string): HTMLElement {
    const avatar = createElement('div', `avatar avatar-${role}`);
    avatar.style.cssText = `
      width: 36px;
      height: 36px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-weight: bold;
      color: white;
      font-size: 14px;
      background-color: ${role === 'user' ? '#10b981' : '#2563eb'};
    `;
    avatar.textContent = role === 'user' ? '我' : 'AI';
    return avatar;
  }

  private createActionButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 2px 8px;
      border: none;
      background: transparent;
      color: #6b7280;
      font-size: 12px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#f3f4f6';
      btn.style.color = '#374151';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = 'transparent';
      btn.style.color = '#6b7280';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  private formatContent(content: string, role: string): string {
    // 转义 HTML
    let formatted = escapeHtml(content);

    // 处理代码块
    formatted = formatted.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (match, lang, code) => {
        return `<pre style="
          background-color: #1f2937;
          color: #e5e7eb;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          line-height: 1.5;
          margin: 8px 0;
        "><code>${code.trim()}</code></pre>`;
      }
    );

    // 处理行内代码
    formatted = formatted.replace(
      /`([^`]+)`/g,
      '<code style="background-color: rgba(0, 0, 0, 0.05); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">$1</code>'
    );

    // 处理换行
    formatted = formatted.replace(/\n/g, '<br>');

    // 处理链接
    formatted = formatted.replace(
      /(https?:\/\/[^\s<]+)/g,
      `<a href="$1" target="_blank" style="color: ${role === 'user' ? '#bfdbfe' : '#2563eb'}; text-decoration: underline;">$1</a>`
    );

    return formatted;
  }

  private async copyContent(): Promise<void> {
    const success = await copyToClipboard(this.messageOptions.content);
    if (success) {
      toast.success('已复制到剪贴板');
    } else {
      toast.error('复制失败');
    }
  }

  private deleteMessage(): void {
    if (this.messageOptions.messageId && this.messageOptions.onDelete) {
      this.messageOptions.onDelete(this.messageOptions.messageId);
    }
  }

  update(data: Partial<MessageBubbleOptions>): void {
    if (data.content && this.element) {
      const contentEl = this.element.querySelector('.message-content');
      if (contentEl) {
        contentEl.innerHTML = this.formatContent(data.content, this.messageOptions.role);
      }
    }
  }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent += `
  @keyframes messageSlideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);

export default MessageBubble;
