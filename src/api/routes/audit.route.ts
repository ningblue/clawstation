// src/api/routes/audit.route.ts

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getAuditLogs, getAuditLogsByUser, getAuditLogsByAction, cleanupOldAuditLogs } from '../../backend/services/audit.service';
import { AuditAction } from '../../models/audit.model';

/**
 * 审计日志相关的API路由
 */
export function setupAuditRoutes(): void {
  // 获取审计日志
  ipcMain.handle('audit:get-logs', async (_event: IpcMainInvokeEvent, params: { limit?: number, offset?: number }) => {
    try {
      const limit = Math.min(params?.limit || 100, 500);
      const offset = params?.offset || 0;
      const logs = await getAuditLogs(limit, offset);
      return { success: true, logs };
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 根据用户ID获取审计日志
  ipcMain.handle('audit:get-logs-by-user', async (_event: IpcMainInvokeEvent, userId: number, limit?: number) => {
    try {
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }
      const logs = await getAuditLogsByUser(userId, Math.min(limit || 100, 500));
      return { success: true, logs };
    } catch (error) {
      console.error('Error getting audit logs by user:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 根据操作类型获取审计日志
  ipcMain.handle('audit:get-logs-by-action', async (_event: IpcMainInvokeEvent, action: AuditAction, limit?: number) => {
    try {
      if (!action || !Object.values(AuditAction).includes(action)) {
        throw new Error('Invalid action type');
      }
      const logs = await getAuditLogsByAction(action, Math.min(limit || 100, 500));
      return { success: true, logs };
    } catch (error) {
      console.error('Error getting audit logs by action:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 清理旧审计日志
  ipcMain.handle('audit:cleanup', async (_event: IpcMainInvokeEvent, olderThanDays: number) => {
    try {
      if (!olderThanDays || olderThanDays < 1) {
        throw new Error('Invalid days parameter');
      }
      const deletedCount = await cleanupOldAuditLogs(olderThanDays);
      return { success: true, deletedCount };
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 导出审计日志
  ipcMain.handle('audit:export', async (_event: IpcMainInvokeEvent, params: { format?: 'json' | 'csv', limit?: number }) => {
    try {
      const logs = await getAuditLogs(Math.min(params?.limit || 1000, 5000), 0);

      if (params?.format === 'csv') {
        // 转换为 CSV 格式
        const headers = ['ID', 'UserID', 'Action', 'Level', 'Details', 'Timestamp', 'IP'];
        const rows = logs.map(log => [
          log.id,
          log.userId || '',
          log.action,
          log.level,
          `"${(log.details || '').replace(/"/g, '""')}"`,
          log.timestamp,
          log.ipAddress || ''
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        return { success: true, data: csv, format: 'csv' };
      }

      // 默认 JSON 格式
      return { success: true, data: JSON.stringify(logs, null, 2), format: 'json' };
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}
