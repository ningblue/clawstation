// 事件总线 - 用于组件间通信

export type EventCallback = (...args: any[]) => void;

class EventBus {
  private events: Map<string, EventCallback[]> = new Map();

  // 订阅事件
  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  // 取消订阅
  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 触发事件
  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // 一次性订阅
  once(event: string, callback: EventCallback): void {
    const onceCallback = (...args: any[]) => {
      this.off(event, onceCallback);
      callback(...args);
    };
    this.on(event, onceCallback);
  }

  // 清除所有事件
  clear(): void {
    this.events.clear();
  }
}

// 全局事件总线实例
export const eventBus = new EventBus();

// 预定义的事件名称
export const Events = {
  // 会话相关
  CONVERSATION_CREATED: 'conversation:created',
  CONVERSATION_SELECTED: 'conversation:selected',
  CONVERSATION_DELETED: 'conversation:deleted',
  CONVERSATION_UPDATED: 'conversation:updated',

  // 消息相关
  MESSAGE_SENT: 'message:sent',
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_LOADING: 'message:loading',

  // 用户相关
  USER_UPDATED: 'user:updated',
  SETTINGS_CHANGED: 'settings:changed',

  // 引擎相关
  ENGINE_STATUS_CHANGED: 'engine:status:changed',
  ENGINE_RESTARTED: 'engine:restarted',

  // UI相关
  TOAST_SHOW: 'toast:show',
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',
  SIDEBAR_TOGGLE: 'sidebar:toggle',

  // 审计日志
  AUDIT_LOG_REFRESH: 'audit:log:refresh',
} as const;
