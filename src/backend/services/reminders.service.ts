/**
 * 提醒服务
 * 管理定时任务和提醒的创建、触发、推送
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import { BrowserWindow } from 'electron';
import type { OpenClawManager } from './openclaw.service';
import type { MessageService } from './message.service';
import { notificationManager, ReminderNotificationData } from '../../main/notification';

// 提醒接口
export interface Reminder {
  id: string;
  message: string;
  schedule: string;
  scheduleText: string;
  sessionId: number;
  sessionName?: string;
  enabled: boolean;
  createdAt: string;
  lastRun?: string;
  nextRun?: string;
  lastError?: string;
}

// 创建提醒输入
export interface CreateReminderInput {
  message: string;
  schedule: string;
  sessionId: number;
  sessionName?: string;
  enabled?: boolean;
}

// OpenClaw cron 任务接口
interface OpenClawCronJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: { kind: string; expr?: string; everyMs?: number; at?: string; tz?: string };
  payload: {
    kind: string;
    message?: string;
    text?: string;
    sessionId?: number;
    sessionName?: string;
  };
  state: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
    lastError?: string;
    lastDurationMs?: number;
  };
}

// Cron list 结果接口
interface CronListResult {
  jobs?: OpenClawCronJob[];
}

/**
 * 提醒服务
 * 负责与 OpenClaw cron 系统交互，管理提醒的 CRUD 和触发
 */
export class RemindersService extends EventEmitter {
  private openclawManager: OpenClawManager | null = null;
  private messageService: MessageService | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    super();
  }

  /**
   * 设置依赖
   */
  setOpenClawManager(manager: OpenClawManager): void {
    this.openclawManager = manager;
  }

  setMessageService(service: MessageService): void {
    this.messageService = service;
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * 调用 OpenClaw RPC
   */
  private async rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.openclawManager) {
      throw new Error('OpenClaw manager not initialized');
    }

    const config = this.openclawManager.getConfig();
    const url = `http://127.0.0.1:${config.port}/rpc`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params: params || {},
        }),
      });

      const result = await response.json() as { error?: { message?: string }; result?: unknown };

      if (result.error) {
        throw new Error(result.error.message || 'RPC error');
      }

      return result.result;
    } catch (error) {
      log.error(`[RemindersService] RPC call failed: ${method}`, error);
      throw error;
    }
  }

  /**
   * 列出所有提醒
   */
  async listReminders(): Promise<Reminder[]> {
    try {
      const result = await this.rpc('cron.list', { includeDisabled: true }) as CronListResult;
      const jobs: OpenClawCronJob[] = result?.jobs || [];

      // 过滤出提醒类型的任务（我们创建的）
      const reminders = jobs
        .filter(job => job.payload?.kind === 'clawstation_reminder')
        .map(this.transformOpenClawJobToReminder.bind(this)) as Reminder[];

      return reminders;
    } catch (error) {
      log.error('[RemindersService] Failed to list reminders:', error);
      // 如果 OpenClaw 未启动，返回空列表而不是抛出错误
      if (String(error).includes('ECONNREFUSED') || String(error).includes('fetch failed')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * 创建提醒
   */
  async createReminder(input: CreateReminderInput): Promise<Reminder> {
    const id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const cronExpr = this.parseSchedule(input.schedule);

    try {
      // 调用 OpenClaw cron.add
      await this.rpc('cron.add', {
        id,
        name: `提醒: ${input.message.substring(0, 30)}...`,
        schedule: { kind: 'cron', expr: cronExpr },
        payload: {
          kind: 'clawstation_reminder',
          message: input.message,
          sessionId: input.sessionId,
          sessionName: input.sessionName,
        },
        enabled: input.enabled ?? true,
        wakeMode: 'next-heartbeat',
        sessionTarget: 'isolated',
      });

      log.info(`[RemindersService] Created reminder: ${id}`);

      // 返回创建的提醒
      return {
        id,
        message: input.message,
        schedule: cronExpr,
        scheduleText: this.scheduleToText(cronExpr),
        sessionId: input.sessionId,
        sessionName: input.sessionName,
        enabled: input.enabled ?? true,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      log.error('[RemindersService] Failed to create reminder:', error);
      throw error;
    }
  }

  /**
   * 删除提醒
   */
  async deleteReminder(id: string): Promise<void> {
    try {
      await this.rpc('cron.remove', { id });
      log.info(`[RemindersService] Deleted reminder: ${id}`);
    } catch (error) {
      log.error('[RemindersService] Failed to delete reminder:', error);
      throw error;
    }
  }

  /**
   * 切换提醒启用状态
   */
  async toggleReminder(id: string, enabled: boolean): Promise<void> {
    try {
      await this.rpc('cron.update', { id, patch: { enabled } });
      log.info(`[RemindersService] Toggled reminder ${id} to ${enabled}`);
    } catch (error) {
      log.error('[RemindersService] Failed to toggle reminder:', error);
      throw error;
    }
  }

  /**
   * 更新提醒
   */
  async updateReminder(id: string, updates: Partial<CreateReminderInput>): Promise<void> {
    try {
      const patch: Record<string, unknown> = {};

      if (updates.message) {
        patch.payload = {
          kind: 'clawstation_reminder',
          message: updates.message,
          sessionId: updates.sessionId,
          sessionName: updates.sessionName,
        };
        patch.name = `提醒: ${updates.message.substring(0, 30)}...`;
      }

      if (updates.schedule) {
        patch.schedule = { kind: 'cron', expr: this.parseSchedule(updates.schedule) };
      }

      if (typeof updates.enabled === 'boolean') {
        patch.enabled = updates.enabled;
      }

      await this.rpc('cron.update', { id, patch });
      log.info(`[RemindersService] Updated reminder: ${id}`);
    } catch (error) {
      log.error('[RemindersService] Failed to update reminder:', error);
      throw error;
    }
  }

  /**
   * 手动触发提醒
   */
  async triggerReminder(id: string): Promise<void> {
    try {
      await this.rpc('cron.run', { id, mode: 'force' });
      log.info(`[RemindersService] Manually triggered reminder: ${id}`);
    } catch (error) {
      log.error('[RemindersService] Failed to trigger reminder:', error);
      throw error;
    }
  }

  /**
   * 处理提醒触发（由 OpenClaw cron 系统调用）
   * 这个方法会在 OpenClaw 触发 cron 任务时被调用
   */
  async handleReminderTrigger(data: {
    id: string;
    payload: {
      message: string;
      sessionId: number;
      sessionName?: string;
    };
  }): Promise<void> {
    const { id, payload } = data;
    log.info(`[RemindersService] Handling reminder trigger: ${id}`);

    try {
      // 1. 在数据库中创建 AI 消息
      if (this.messageService) {
        // 使用 MessageService 的静态方法或实例方法
        const MessageServiceClass = this.messageService.constructor as typeof MessageService;
        if (typeof MessageServiceClass.createMessage === 'function') {
          await MessageServiceClass.createMessage({
            conversationId: payload.sessionId,
            role: 'assistant',
            content: `⏰ 提醒：${payload.message}`,
          });
        }
      }

      // 2. 显示桌面通知
      const notificationData: ReminderNotificationData = {
        reminderId: id,
        message: payload.message,
        sessionId: payload.sessionId,
        sessionName: payload.sessionName,
      };

      notificationManager.showReminder(notificationData);

      // 3. 通知渲染进程更新消息列表
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('reminder:triggered', {
          reminderId: id,
          message: payload.message,
          sessionId: payload.sessionId,
        });
      }

      log.info(`[RemindersService] Reminder trigger handled successfully: ${id}`);
    } catch (error) {
      log.error(`[RemindersService] Failed to handle reminder trigger: ${id}`, error);
    }
  }

  /**
   * 解析调度表达式
   * 支持自然语言和标准 cron 表达式
   */
  private parseSchedule(schedule: string): string {
    // 如果已经是 cron 表达式，直接返回
    if (/^[\d*/,-]+\s+[\d*/,-]+\s+[\d*/,-]+\s+[\d*/,-]+\s+[\d*/,-]+$/.test(schedule)) {
      return schedule;
    }

    // 解析自然语言
    const now = new Date();
    const lowerSchedule = schedule.toLowerCase();

    // 每分钟
    if (lowerSchedule.includes('每分钟') || lowerSchedule === 'every minute') {
      return '* * * * *';
    }

    // 每小时
    if (lowerSchedule.includes('每小时') || lowerSchedule === 'every hour') {
      return '0 * * * *';
    }

    // 每天
    if (lowerSchedule.includes('每天')) {
      const timeMatch = schedule.match(/(\d{1,2})[：:点](\d{1,2})?/);
      if (timeMatch && timeMatch[1]) {
        const hour = timeMatch[1].padStart(2, '0');
        const minute = (timeMatch[2] || '00').padStart(2, '0');
        return `${minute} ${hour} * * *`;
      }
      return '0 9 * * *'; // 默认每天早上9点
    }

    // 每周
    if (lowerSchedule.includes('每周') || lowerSchedule.includes('每星期')) {
      const dayMap: Record<string, number> = {
        '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
      };
      for (const [day, num] of Object.entries(dayMap)) {
        if (schedule.includes(day)) {
          return `0 9 * * ${num}`;
        }
      }
      return '0 9 * * 1'; // 默认每周一
    }

    // X分钟后
    const minutesMatch = schedule.match(/(\d+)\s*分钟/);
    if (minutesMatch && minutesMatch[1]) {
      const minutes = parseInt(minutesMatch[1], 10);
      const target = new Date(now.getTime() + minutes * 60 * 1000);
      return `${target.getMinutes()} ${target.getHours()} ${target.getDate()} ${(target.getMonth() + 1)} *`;
    }

    // X小时后
    const hoursMatch = schedule.match(/(\d+)\s*小时/);
    if (hoursMatch && hoursMatch[1]) {
      const hours = parseInt(hoursMatch[1], 10);
      const target = new Date(now.getTime() + hours * 60 * 60 * 1000);
      return `${target.getMinutes()} ${target.getHours()} ${target.getDate()} ${(target.getMonth() + 1)} *`;
    }

    // 默认：每天早上9点
    log.warn(`[RemindersService] Unrecognized schedule format: ${schedule}, using default`);
    return '0 9 * * *';
  }

  /**
   * 将 cron 表达式转换为人类可读文本
   */
  private scheduleToText(cron: string): string {
    const parts = cron.split(' ');
    if (parts.length !== 5) return cron;

    const minute = parts[0] ?? '';
    const hour = parts[1] ?? '';
    const dayOfMonth = parts[2] ?? '';
    const dayOfWeek = parts[4] ?? '';

    if (minute === '*') return '每分钟';
    if (minute.startsWith('*/')) return `每 ${minute.slice(2)} 分钟`;
    if (hour === '*' && minute === '0') return '每小时';

    if (dayOfWeek !== '*') {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const dayIndex = parseInt(dayOfWeek, 10);
      if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex <= 6) {
        return `每${days[dayIndex]} ${hour}:${minute.padStart(2, '0')}`;
      }
    }

    if (dayOfMonth !== '*') {
      return `每月${dayOfMonth}日 ${hour}:${minute.padStart(2, '0')}`;
    }

    if (hour !== '*') {
      return `每天 ${hour}:${minute.padStart(2, '0')}`;
    }

    return cron;
  }

  /**
   * 转换 OpenClaw 任务格式为提醒格式
   */
  private transformOpenClawJobToReminder(job: OpenClawCronJob): Reminder {
    const payload = job.payload || {};
    const state = job.state || {};

    return {
      id: job.id,
      message: payload.message || '',
      schedule: job.schedule?.expr || '',
      scheduleText: this.scheduleToText(job.schedule?.expr || ''),
      sessionId: payload.sessionId || 0,
      sessionName: payload.sessionName,
      enabled: job.enabled,
      createdAt: new Date(job.createdAtMs).toISOString(),
      lastRun: state.lastRunAtMs ? new Date(state.lastRunAtMs).toISOString() : undefined,
      nextRun: state.nextRunAtMs ? new Date(state.nextRunAtMs).toISOString() : undefined,
      lastError: state.lastError,
    };
  }
}

// 导出单例
export const remindersService = new RemindersService();
