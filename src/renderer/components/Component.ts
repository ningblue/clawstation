// 组件基类 - 所有 UI 组件的基类

import { eventBus, EventCallback } from '../utils/event-bus.js';

export interface ComponentOptions {
  id?: string;
  className?: string;
  attributes?: Record<string, string>;
}

export abstract class Component {
  protected element: HTMLElement | null = null;
  protected parent: HTMLElement | null = null;
  protected options: ComponentOptions;  // 公共属性供子类使用
  protected eventListeners: Map<string, EventCallback[]> = new Map();
  protected isMounted = false;
  protected isDestroyed = false;

  constructor(options: ComponentOptions = {}) {
    this.options = options;
  }

  /**
   * 创建组件的 DOM 元素
   * 子类必须实现此方法
   */
  protected abstract render(): HTMLElement;

  /**
   * 获取组件的 DOM 元素
   */
  getElement(): HTMLElement | null {
    return this.element;
  }

  /**
   * 挂载组件到指定容器
   */
  mount(parent: HTMLElement): this {
    if (this.isDestroyed) {
      console.warn('Cannot mount a destroyed component');
      return this;
    }

    if (!this.element) {
      this.element = this.render();
      this.applyOptions();
    }

    this.parent = parent;
    parent.appendChild(this.element);
    this.isMounted = true;
    this.onMount();

    return this;
  }

  /**
   * 卸载组件
   */
  unmount(): this {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.isMounted = false;
    this.onUnmount();
    return this;
  }

  /**
   * 销毁组件
   */
  destroy(): void {
    this.unmount();
    this.removeAllEventListeners();
    this.element = null;
    this.parent = null;
    this.isDestroyed = true;
    this.onDestroy();
  }

  /**
   * 应用选项到元素
   */
  protected applyOptions(): void {
    if (!this.element) return;

    if (this.options.id) {
      this.element.id = this.options.id;
    }

    if (this.options.className) {
      this.element.className = this.options.className;
    }

    if (this.options.attributes) {
      Object.entries(this.options.attributes).forEach(([key, value]) => {
        this.element!.setAttribute(key, value as string);
      });
    }
  }

  /**
   * 添加事件监听器（自动管理）
   */
  protected addEventListener(
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options);

    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler as EventCallback);
  }

  /**
   * 移除所有事件监听器
   */
  protected removeAllEventListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * 订阅全局事件
   */
  protected subscribe(event: string, callback: EventCallback): void {
    eventBus.on(event, callback);
  }

  /**
   * 取消订阅全局事件
   */
  protected unsubscribe(event: string, callback: EventCallback): void {
    eventBus.off(event, callback);
  }

  /**
   * 触发自定义事件
   */
  protected emit(event: string, ...args: any[]): void {
    eventBus.emit(event, ...args);
  }

  /**
   * 显示组件
   */
  show(): void {
    if (this.element) {
      this.element.style.display = '';
    }
  }

  /**
   * 隐藏组件
   */
  hide(): void {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * 切换显示/隐藏
   */
  toggle(): void {
    if (this.element) {
      if (this.element.style.display === 'none') {
        this.show();
      } else {
        this.hide();
      }
    }
  }

  /**
   * 添加 CSS 类
   */
  addClass(className: string): void {
    this.element?.classList.add(className);
  }

  /**
   * 移除 CSS 类
   */
  removeClass(className: string): void {
    this.element?.classList.remove(className);
  }

  /**
   * 切换 CSS 类
   */
  toggleClass(className: string): void {
    this.element?.classList.toggle(className);
  }

  /**
   * 检查是否有 CSS 类
   */
  hasClass(className: string): boolean {
    return this.element?.classList.contains(className) ?? false;
  }

  /**
   * 生命周期钩子 - 挂载后调用
   */
  protected onMount(): void {
    // 子类可重写
  }

  /**
   * 生命周期钩子 - 卸载后调用
   */
  protected onUnmount(): void {
    // 子类可重写
  }

  /**
   * 生命周期钩子 - 销毁后调用
   */
  protected onDestroy(): void {
    // 子类可重写
  }

  /**
   * 更新组件
   */
  abstract update(data?: any): void;
}

export default Component;
