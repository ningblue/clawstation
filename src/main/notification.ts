/**
 * 桌面通知模块
 * 处理系统通知和提醒推送
 */

import { Notification, BrowserWindow, app, shell } from 'electron';
import * as path from 'path';
import log from 'electron-log';

let mainWindow: BrowserWindow | null = null;

export interface ReminderNotificationData {
  reminderId: string;
  message: string;
  sessionId: number;
  sessionName?: string;
}

/**
 * 设置主窗口引用（用于点击通知时跳转）
 */
export function setNotificationMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

/**
 * 检查通知权限
 */
export async function checkNotificationPermission(): Promise<boolean> {
  if (!Notification.isSupported()) {
    log.warn('[Notification] Notifications are not supported on this system');
    return false;
  }

  // macOS 不需要显式请求权限，Windows 需要系统设置
  return true;
}

/**
 * 显示提醒通知
 */
export function showReminderNotification(data: ReminderNotificationData): Notification | null {
  if (!Notification.isSupported()) {
    log.warn('[Notification] Notifications not supported, skipping');
    return null;
  }

  try {
    const notification = new Notification({
      title: '⏰ 提醒',
      body: data.message,
      subtitle: data.sessionName ? `来自: ${data.sessionName}` : undefined,
      silent: false,
      hasReply: false,
      // 通知图标
      icon: getNotificationIcon(),
    });

    // 点击通知时跳转到对应会话
    notification.on('click', () => {
      log.info(`[Notification] User clicked notification for reminder ${data.reminderId}`);

      // 显示并聚焦主窗口
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();

        // 通知渲染进程切换到对应会话
        mainWindow.webContents.send('reminder:navigate-to-session', {
          sessionId: data.sessionId,
          reminderId: data.reminderId,
        });
      }
    });

    // 通知关闭事件
    notification.on('close', () => {
      log.debug(`[Notification] Notification closed for reminder ${data.reminderId}`);
    });

    notification.show();
    log.info(`[Notification] Showed notification: ${data.message.substring(0, 50)}...`);

    return notification;
  } catch (error) {
    log.error('[Notification] Failed to show notification:', error);
    return null;
  }
}

/**
 * 显示简单通知
 */
export function showSimpleNotification(title: string, body: string): Notification | null {
  if (!Notification.isSupported()) {
    return null;
  }

  try {
    const notification = new Notification({
      title,
      body,
      silent: false,
      icon: getNotificationIcon(),
    });

    notification.show();
    return notification;
  } catch (error) {
    log.error('[Notification] Failed to show simple notification:', error);
    return null;
  }
}

/**
 * 获取通知图标路径
 */
function getNotificationIcon(): string | undefined {
  try {
    let iconPath: string;

    if (app.isPackaged) {
      iconPath = path.join(process.resourcesPath, 'resources', 'icon.png');
    } else {
      iconPath = path.join(__dirname, '../../resources/icon.png');
    }

    // 检查文件是否存在
    const fs = require('fs');
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 通知管理器类
 * 管理活动通知和防止重复
 */
export class NotificationManager {
  private activeNotifications: Map<string, Notification> = new Map();
  private readonly deduplicationWindowMs = 5000; // 5秒内相同提醒不重复通知

  /**
   * 显示提醒通知（带去重）
   */
  showReminder(data: ReminderNotificationData): Notification | null {
    const key = data.reminderId;
    const now = Date.now();

    // 检查是否有相同提醒刚刚显示过
    const existing = this.activeNotifications.get(key);
    if (existing) {
      log.debug(`[NotificationManager] Skipping duplicate notification for ${key}`);
      return null;
    }

    const notification = showReminderNotification(data);
    if (notification) {
      this.activeNotifications.set(key, notification);

      // 通知关闭后从活动列表移除
      notification.on('close', () => {
        this.activeNotifications.delete(key);
      });

      // 设置去重窗口后自动清理
      setTimeout(() => {
        this.activeNotifications.delete(key);
      }, this.deduplicationWindowMs);
    }

    return notification;
  }

  /**
   * 清除所有活动通知
   */
  clearAll(): void {
    for (const notification of this.activeNotifications.values()) {
      try {
        notification.close();
      } catch {
        // 忽略关闭错误
      }
    }
    this.activeNotifications.clear();
  }
}

// 导出单例
export const notificationManager = new NotificationManager();
