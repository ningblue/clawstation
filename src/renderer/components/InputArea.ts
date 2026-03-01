// 输入框组件

import { Component } from './Component.js';
import { createElement, autoResizeTextarea, containsSensitiveContent } from '../utils/dom-utils.js';
import { eventBus, Events } from '../utils/event-bus.js';
import { toast } from './Toast.js';

export interface InputAreaOptions {
  placeholder?: string;
  maxLength?: number;
  onSend?: (message: string) => void | Promise<void>;
  onTyping?: (text: string) => void;
}

export class InputArea extends Component {
  private inputOptions: InputAreaOptions;
  private textarea: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private isSending = false;

  constructor(options: InputAreaOptions = {}) {
    super({ className: 'input-area' });
    this.inputOptions = {
      placeholder: '输入消息... (按 Enter 发送, Shift+Enter 换行)',
      maxLength: 10000,
      ...options
    };
  }

  protected override render(): HTMLElement {
    const element = createElement('div', 'input-area');
    element.style.cssText = `
      background-color: #ffffff;
      border-top: 1px solid #e5e7eb;
      padding: 16px 20px;
    `;

    // 智能提示区域
    const smartPrompts = this.createSmartPrompts();
    element.appendChild(smartPrompts);

    // 输入容器
    const inputContainer = createElement('div', 'input-container');
    inputContainer.style.cssText = `
      display: flex;
      gap: 12px;
      align-items: flex-end;
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 8px 12px;
      transition: border-color 0.2s, box-shadow 0.2s;
    `;

    // 文本输入框
    this.textarea = createElement('textarea', 'chat-input');
    this.textarea.placeholder = this.inputOptions.placeholder!;
    this.textarea.rows = 1;
    this.textarea.style.cssText = `
      flex: 1;
      border: none;
      background: transparent;
      resize: none;
      outline: none;
      font-size: 15px;
      line-height: 1.5;
      max-height: 200px;
      min-height: 24px;
      font-family: inherit;
    `;

    // 输入事件
    this.textarea.addEventListener('input', () => {
      autoResizeTextarea(this.textarea!, 200);
      this.inputOptions.onTyping?.(this.textarea!.value);
    });

    // 键盘事件
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // 聚焦样式
    this.textarea.addEventListener('focus', () => {
      inputContainer.style.borderColor = '#2563eb';
      inputContainer.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
    });

    this.textarea.addEventListener('blur', () => {
      inputContainer.style.borderColor = '#e5e7eb';
      inputContainer.style.boxShadow = 'none';
    });

    inputContainer.appendChild(this.textarea);

    // 发送按钮
    this.sendBtn = createElement('button', 'send-btn');
    this.sendBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 2L11 13" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    this.sendBtn.style.cssText = `
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background-color: #2563eb;
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
    `;
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    // 悬停效果
    this.sendBtn.addEventListener('mouseenter', () => {
      if (!this.isSending) {
        this.sendBtn!.style.backgroundColor = '#1d4ed8';
      }
    });
    this.sendBtn.addEventListener('mouseleave', () => {
      if (!this.isSending) {
        this.sendBtn!.style.backgroundColor = '#2563eb';
      }
    });

    inputContainer.appendChild(this.sendBtn);
    element.appendChild(inputContainer);

    return element;
  }

  private createSmartPrompts(): HTMLElement {
    const container = createElement('div', 'smart-prompts');
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    `;

    const label = createElement('span', 'smart-prompts-label');
    label.textContent = '快捷提示:';
    label.style.cssText = `
      font-size: 13px;
      color: #6b7280;
      white-space: nowrap;
    `;
    container.appendChild(label);

    const promptsList = createElement('div', 'smart-prompts-list');
    promptsList.style.cssText = `
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    `;

    const prompts = [
      { text: '👋 自我介绍', prompt: '你好，请介绍一下你自己' },
      { text: '🐍 Python代码', prompt: '请帮我写一段Python代码' },
      { text: '📝 内容总结', prompt: '请帮我总结这段内容' },
      { text: '🌐 翻译', prompt: '请帮我翻译这段话' }
    ];

    prompts.forEach(({ text, prompt }) => {
      const btn = createElement('button', 'smart-prompt-btn');
      btn.textContent = text;
      btn.style.cssText = `
        padding: 6px 12px;
        border: 1px solid #e5e7eb;
        background-color: #ffffff;
        border-radius: 16px;
        font-size: 13px;
        color: #374151;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = '#f3f4f6';
        btn.style.borderColor = '#d1d5db';
        btn.style.transform = 'translateY(-1px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = '#ffffff';
        btn.style.borderColor = '#e5e7eb';
        btn.style.transform = 'translateY(0)';
      });
      btn.addEventListener('click', () => {
        this.setValue(prompt);
        this.focus();
      });
      promptsList.appendChild(btn);
    });

    container.appendChild(promptsList);
    return container;
  }

  private async sendMessage(): Promise<void> {
    if (!this.textarea || this.isSending) return;

    const message = this.textarea.value.trim();
    if (!message) return;

    // 长度检查
    if (message.length > this.inputOptions.maxLength!) {
      toast.error(`消息过长，请控制在${this.inputOptions.maxLength}字符以内`);
      return;
    }

    // 敏感内容检查
    if (containsSensitiveContent(message)) {
      if (!confirm('检测到可能包含敏感内容，确定要发送吗？')) {
        return;
      }
    }

    this.isSending = true;
    this.setLoading(true);

    try {
      await this.inputOptions.onSend?.(message);
      this.clear();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('发送失败，请重试');
    } finally {
      this.isSending = false;
      this.setLoading(false);
    }
  }

  private setLoading(loading: boolean): void {
    if (!this.sendBtn) return;

    if (loading) {
      this.sendBtn.disabled = true;
      this.sendBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
      `;
      this.sendBtn.style.backgroundColor = '#9ca3af';
    } else {
      this.sendBtn.disabled = false;
      this.sendBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      this.sendBtn.style.backgroundColor = '#2563eb';
    }
  }

  setValue(text: string): void {
    if (this.textarea) {
      this.textarea.value = text;
      autoResizeTextarea(this.textarea, 200);
    }
  }

  getValue(): string {
    return this.textarea?.value || '';
  }

  clear(): void {
    if (this.textarea) {
      this.textarea.value = '';
      this.textarea.style.height = 'auto';
    }
  }

  focus(): void {
    this.textarea?.focus();
  }

  update(): void {
    // 输入框组件不需要更新
  }
}

// 添加旋转动画
const style = document.createElement('style');
style.textContent += `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default InputArea;
