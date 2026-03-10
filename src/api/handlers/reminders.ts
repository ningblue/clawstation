/**
 * 提醒 IPC 处理器
 * 处理前端与后端的提醒相关通信
 */

import { ipcMain } from 'electron';
import { remindersService } from '../../backend/services/reminders.service';
import type { CreateReminderInput } from '../../backend/services/reminders.service';
import log from 'electron-log';

/**
 * 注册提醒相关的 IPC 处理器
 */
export function setupReminderHandlers(): void {
  log.info('[ReminderHandlers] Setting up reminder IPC handlers');

  // 列出所有提醒
  ipcMain.handle('reminder:list', async () => {
    try {
      const reminders = await remindersService.listReminders();
      return { success: true, reminders };
    } catch (error) {
      log.error('[ReminderHandlers] Failed to list reminders:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 创建提醒
  ipcMain.handle('reminder:create', async (_event, input: CreateReminderInput) => {
    try {
      const reminder = await remindersService.createReminder(input);
      return { success: true, reminder };
    } catch (error) {
      log.error('[ReminderHandlers] Failed to create reminder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 删除提醒
  ipcMain.handle('reminder:delete', async (_event, id: string) => {
    try {
      await remindersService.deleteReminder(id);
      return { success: true };
    } catch (error) {
      log.error('[ReminderHandlers] Failed to delete reminder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 切换提醒启用状态
  ipcMain.handle('reminder:toggle', async (_event, { id, enabled }: { id: string; enabled: boolean }) => {
    try {
      await remindersService.toggleReminder(id, enabled);
      return { success: true };
    } catch (error) {
      log.error('[ReminderHandlers] Failed to toggle reminder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 更新提醒
  ipcMain.handle('reminder:update', async (_event, { id, updates }: { id: string; updates: Partial<CreateReminderInput> }) => {
    try {
      await remindersService.updateReminder(id, updates);
      return { success: true };
    } catch (error) {
      log.error('[ReminderHandlers] Failed to update reminder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 手动触发提醒
  ipcMain.handle('reminder:trigger', async (_event, id: string) => {
    try {
      await remindersService.triggerReminder(id);
      return { success: true };
    } catch (error) {
      log.error('[ReminderHandlers] Failed to trigger reminder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  log.info('[ReminderHandlers] Reminder IPC handlers registered');
}
