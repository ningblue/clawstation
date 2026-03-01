// Toast 通知组件

import { Component } from './Component.js';
import { createElement } from '../utils/dom-utils.js';
import { eventBus, Events } from '../utils/event-bus.js';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export class Toast extends Component {
  private container: HTMLElement;
  private toasts: Map<string, HTMLElement> = new Map();
  private toastIdCounter = 0;

  constructor() {
    super({ id: 'toastContainer' });
    this.container = this.createContainer();
    document.body.appendChild(this.container);

    // 监听全局 toast 事件
    eventBus.on(Events.TOAST_SHOW, (options: ToastOptions) => {
      this.showToast(options);
    });
  }

  protected override render(): HTMLElement {
    return this.container;
  }

  private createContainer(): HTMLElement {
    const container = createElement('div', 'toast-container');
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    return container;
  }

  showToast(options: ToastOptions): string {
    const id = `toast-${++this.toastIdCounter}`;
    const { message, type = 'info', duration = 3000 } = options;

    const toast = createElement('div', `toast toast-${type}`);
    toast.id = id;
    toast.style.cssText = `
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 200px;
      max-width: 400px;
      background-color: ${this.getBackgroundColor(type)};
    `;

    // 添加图标
    const icon = this.getIcon(type);
    toast.innerHTML = `${icon}<span>${message}</span>`;

    // 添加关闭按钮
    const closeBtn = createElement('button', 'toast-close');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      margin-left: auto;
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      opacity: 0.7;
    `;
    closeBtn.onclick = () => this.hideToast(id);
    toast.appendChild(closeBtn);

    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    // 自动隐藏
    if (duration > 0) {
      setTimeout(() => this.hideToast(id), duration);
    }

    return id;
  }

  hideToast(id: string): void {
    const toast = this.toasts.get(id);
    if (toast) {
      toast.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => {
        toast.remove();
        this.toasts.delete(id);
      }, 300);
    }
  }

  success(message: string, duration?: number): string {
    return this.showToast({ message, type: 'success', duration });
  }

  error(message: string, duration?: number): string {
    return this.showToast({ message, type: 'error', duration });
  }

  info(message: string, duration?: number): string {
    return this.showToast({ message, type: 'info', duration });
  }

  warning(message: string, duration?: number): string {
    return this.showToast({ message, type: 'warning', duration });
  }

  private getBackgroundColor(type: string): string {
    const colors: Record<string, string> = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    return colors[type] ?? '#3b82f6';
  }

  private getIcon(type: string): string {
    const icons: Record<string, string> = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return `<span style="font-size: 16px;">${icons[type] || icons['info']}</span>`;
  }

  override update(): void {
    // Toast 组件不需要更新
  }

  override destroy(): void {
    this.toasts.forEach((toast, id) => this.hideToast(id));
    this.container.remove();
    super.destroy();
  }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// 导出单例
export const toast = new Toast();
export default toast;
