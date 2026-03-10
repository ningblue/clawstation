/**
 * 提醒状态管理 Store
 * 管理定时任务/提醒的状态
 */

import { useState, useEffect, useCallback } from 'react';

// 提醒接口
export interface Reminder {
  id: string;
  message: string;           // 提醒内容
  schedule: string;          // cron 表达式
  scheduleText: string;      // 人类可读的调度描述
  sessionId: number;         // 绑定的会话 ID
  sessionName?: string;      // 会话名称
  enabled: boolean;          // 是否启用
  createdAt: string;         // 创建时间
  lastRun?: string;          // 上次运行时间
  nextRun?: string;          // 下次运行时间
  lastError?: string;        // 上次错误
}

// 创建提醒输入
export interface CreateReminderInput {
  message: string;
  schedule: string;          // cron 表达式或自然语言
  sessionId: number;
  sessionName?: string;
  enabled?: boolean;
}

// 提醒状态
export interface RemindersState {
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
}

/**
 * 提醒状态管理 Hook
 */
export function useRemindersStore() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载提醒列表
   */
  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.invoke('reminder:list');
      if (result.success) {
        setReminders(result.reminders || []);
      } else {
        setError(result.error || '加载提醒失败');
      }
    } catch (err) {
      console.error('Failed to load reminders:', err);
      setError(err instanceof Error ? err.message : '加载提醒失败');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 创建提醒
   */
  const createReminder = useCallback(async (input: CreateReminderInput): Promise<Reminder | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.invoke('reminder:create', input);
      if (result.success && result.reminder) {
        setReminders(prev => [...prev, result.reminder]);
        return result.reminder;
      } else {
        setError(result.error || '创建提醒失败');
        return null;
      }
    } catch (err) {
      console.error('Failed to create reminder:', err);
      setError(err instanceof Error ? err.message : '创建提醒失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 删除提醒
   */
  const deleteReminder = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.invoke('reminder:delete', id);
      if (result.success) {
        setReminders(prev => prev.filter(r => r.id !== id));
        return true;
      } else {
        setError(result.error || '删除提醒失败');
        return false;
      }
    } catch (err) {
      console.error('Failed to delete reminder:', err);
      setError(err instanceof Error ? err.message : '删除提醒失败');
      return false;
    }
  }, []);

  /**
   * 切换提醒启用状态
   */
  const toggleReminder = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
    try {
      const result = await window.electronAPI.invoke('reminder:toggle', { id, enabled });
      if (result.success) {
        setReminders(prev =>
          prev.map(r => r.id === id ? { ...r, enabled } : r)
        );
        return true;
      } else {
        setError(result.error || '切换提醒状态失败');
        return false;
      }
    } catch (err) {
      console.error('Failed to toggle reminder:', err);
      setError(err instanceof Error ? err.message : '切换提醒状态失败');
      return false;
    }
  }, []);

  /**
   * 手动触发提醒
   */
  const triggerReminder = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.invoke('reminder:trigger', id);
      if (result.success) {
        // 刷新列表以获取最新状态
        await loadReminders();
        return true;
      } else {
        setError(result.error || '触发提醒失败');
        return false;
      }
    } catch (err) {
      console.error('Failed to trigger reminder:', err);
      setError(err instanceof Error ? err.message : '触发提醒失败');
      return false;
    }
  }, [loadReminders]);

  /**
   * 更新提醒
   */
  const updateReminder = useCallback(async (id: string, updates: Partial<CreateReminderInput>): Promise<boolean> => {
    try {
      const result = await window.electronAPI.invoke('reminder:update', { id, updates });
      if (result.success) {
        setReminders(prev =>
          prev.map(r => r.id === id ? { ...r, ...updates } : r)
        );
        return true;
      } else {
        setError(result.error || '更新提醒失败');
        return false;
      }
    } catch (err) {
      console.error('Failed to update reminder:', err);
      setError(err instanceof Error ? err.message : '更新提醒失败');
      return false;
    }
  }, []);

  /**
   * 清空错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 监听提醒触发事件
   */
  useEffect(() => {
    const handleReminderTriggered = (_event: any, data: { reminderId: string; message: string }) => {
      // 更新提醒的最后运行时间
      setReminders(prev =>
        prev.map(r =>
          r.id === data.reminderId
            ? { ...r, lastRun: new Date().toISOString() }
            : r
        )
      );
    };

    // 注册监听器
    window.electronAPI.onReminderTriggered?.(handleReminderTriggered);

    return () => {
      window.electronAPI.removeReminderTriggeredListener?.(handleReminderTriggered);
    };
  }, []);

  return {
    reminders,
    loading,
    error,
    loadReminders,
    createReminder,
    deleteReminder,
    toggleReminder,
    triggerReminder,
    updateReminder,
    clearError,
  };
}

export default useRemindersStore;
