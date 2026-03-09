import log from 'electron-log';
import { getDatabase } from '../data/database';
import { AuditLog } from '../models/audit.model';
import * as os from 'os';

// 审计级别枚举
export enum AuditLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// 审计动作类型枚举
export enum AuditAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  CONVERSATION_CREATE = 'CONVERSATION_CREATE',
  MESSAGE_SEND = 'MESSAGE_SEND',
  MESSAGE_DELETE = 'MESSAGE_DELETE',
  CONFIG_UPDATE = 'CONFIG_UPDATE',
  FILE_ACCESS = 'FILE_ACCESS',
  SECURITY_EVENT = 'SECURITY_EVENT',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

// 审计事件接口
export interface AuditEvent {
  userId?: number;
  action: AuditAction;
  level: AuditLevel;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp?: Date;
}

let auditEnabled = true;
let auditLogger: any = null;

/**
 * 初始化审计系统
 */
export function setupAudit(): void {
  console.log('Initializing audit system...');

  // 启用审计
  auditEnabled = true;

  // 添加应用关闭时的清理处理
  process.on('exit', cleanupAudit);
  process.on('SIGINT', cleanupAudit);
  process.on('SIGTERM', cleanupAudit);

  // 记录系统启动审计
  logAudit({
    action: AuditAction.SYSTEM_ERROR,
    level: AuditLevel.INFO,
    details: `X-Claw application started - Version: ${process.env.npm_package_version || 'unknown'}, Platform: ${os.platform()}, Architecture: ${os.arch()}`
  });
}

/**
 * 记录审计事件
 */
export function logAudit(event: AuditEvent): void {
  if (!auditEnabled) return;

  try {
    // 创建标准化的审计日志对象
    const auditLog = {
      id: 0, // 数据库自动生成
      userId: event.userId || null as number | null,
      action: event.action,
      details: event.details,
      timestamp: (event.timestamp || new Date()).toISOString(),
      ip: event.ipAddress
    };

    // 存储到数据库
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (userId, action, details, timestamp, ip)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      auditLog.userId,
      auditLog.action,
      auditLog.details,
      auditLog.timestamp,
      auditLog.ip
    );

    // 同时输出到控制台（仅用于调试）
    console.log(`AUDIT [${event.level}] ${event.action}: ${event.details}`);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * 记录用户登录事件
 */
export function logUserLogin(userId: number, ipAddress?: string): void {
  logAudit({
    userId,
    action: AuditAction.USER_LOGIN,
    level: AuditLevel.INFO,
    details: `User logged in`,
    ipAddress
  });
}

/**
 * 记录用户登出事件
 */
export function logUserLogout(userId: number, ipAddress?: string): void {
  logAudit({
    userId,
    action: AuditAction.USER_LOGOUT,
    level: AuditLevel.INFO,
    details: `User logged out`,
    ipAddress
  });
}

/**
 * 记录消息发送事件
 */
export function logMessageSend(userId: number, conversationId: number, messageId: number, contentLength: number): void {
  logAudit({
    userId,
    action: AuditAction.MESSAGE_SEND,
    level: AuditLevel.INFO,
    details: `Message sent to conversation ${conversationId}, ID: ${messageId}, Length: ${contentLength} chars`
  });
}

/**
 * 记录配置更新事件
 */
export function logConfigUpdate(userId: number, configKey: string, oldValue?: string, newValue?: string): void {
  logAudit({
    userId,
    action: AuditAction.CONFIG_UPDATE,
    level: AuditLevel.INFO,
    details: `Configuration updated: ${configKey}, Old value: ${oldValue || 'none'}, New value: ${newValue || 'none'}`
  });
}

/**
 * 记录安全事件
 */
export function logSecurityEvent(userId: number | undefined, details: string, level: AuditLevel = AuditLevel.WARN): void {
  logAudit({
    userId,
    action: AuditAction.SECURITY_EVENT,
    level,
    details
  });
}

/**
 * 记录文件访问事件
 */
export function logFileAccess(userId: number, filePath: string, action: 'read' | 'write' | 'delete'): void {
  logAudit({
    userId,
    action: AuditAction.FILE_ACCESS,
    level: AuditLevel.INFO,
    details: `File ${action}: ${filePath}`
  });
}

/**
 * 获取审计日志
 */
export function getAuditLogs(limit: number = 100, offset: number = 0): AuditLog[] {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(limit, offset) as AuditLog[];
  } catch (error) {
    console.error('Failed to retrieve audit logs:', error);
    return [];
  }
}

/**
 * 根据用户ID获取审计日志
 */
export function getAuditLogsByUser(userId: number, limit: number = 100): AuditLog[] {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM audit_logs
      WHERE userId = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(userId, limit) as AuditLog[];
  } catch (error) {
    console.error('Failed to retrieve audit logs for user:', error);
    return [];
  }
}

/**
 * 获取特定类型的审计日志
 */
export function getAuditLogsByAction(action: AuditAction, limit: number = 100): AuditLog[] {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM audit_logs
      WHERE action = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(action, limit) as AuditLog[];
  } catch (error) {
    console.error('Failed to retrieve audit logs by action:', error);
    return [];
  }
}

/**
 * 清理审计系统
 */
function cleanupAudit(): void {
  if (auditEnabled) {
    logAudit({
      action: AuditAction.SYSTEM_ERROR,
      level: AuditLevel.INFO,
      details: 'X-Claw application shutting down'
    });

    auditEnabled = false;
  }
}

/**
 * 导出审计数据
 */
export function exportAuditData(outputPath: string, startDate?: Date, endDate?: Date): boolean {
  try {
    const fs = require('fs');

    // 查询审计数据
    let query = 'SELECT * FROM audit_logs ORDER BY timestamp DESC';
    const params: any[] = [];

    if (startDate && endDate) {
      query = 'SELECT * FROM audit_logs WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC';
      params.push(startDate.toISOString(), endDate.toISOString());
    } else if (startDate) {
      query = 'SELECT * FROM audit_logs WHERE timestamp >= ? ORDER BY timestamp DESC';
      params.push(startDate.toISOString());
    } else if (endDate) {
      query = 'SELECT * FROM audit_logs WHERE timestamp <= ? ORDER BY timestamp DESC';
      params.push(endDate.toISOString());
    }

    const db = getDatabase();
    const stmt = db.prepare(query);
    const logs = params.length > 0 ? stmt.all(...params) : stmt.all() as AuditLog[];

    // 写入文件
    const jsonData = JSON.stringify(logs, null, 2);
    fs.writeFileSync(outputPath, jsonData);

    logAudit({
      action: AuditAction.FILE_ACCESS,
      level: AuditLevel.INFO,
      details: `Audit data exported to ${outputPath}, Records: ${logs.length}`
    });

    return true;
  } catch (error) {
    console.error('Failed to export audit data:', error);
    logAudit({
      action: AuditAction.SYSTEM_ERROR,
      level: AuditLevel.ERROR,
      details: `Failed to export audit data: ${(error as Error).message}`
    });
    return false;
  }
}

/**
 * 删除过期审计日志
 */
export function cleanupOldAuditLogs(olderThanDays: number): number {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM audit_logs WHERE timestamp < ?');
    const result = stmt.run(cutoffDate.toISOString());

    const deletedCount = result.changes as number;

    logAudit({
      action: AuditAction.SYSTEM_ERROR,
      level: AuditLevel.INFO,
      details: `Cleaned up ${deletedCount} audit logs older than ${olderThanDays} days`
    });

    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old audit logs:', error);
    return 0;
  }
}