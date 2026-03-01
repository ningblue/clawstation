// src/backend/services/audit.service.ts
import { AuditRepository } from '../../data/repositories/audit.repository';
import { AuditEvent, AuditAction, AuditLevel } from '../../models/audit.model';

/**
 * 记录审计事件
 */
export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    // 验证事件
    if (!event.action) {
      console.warn('Audit event missing action');
      return;
    }

    if (!Object.values(AuditAction).includes(event.action)) {
      console.warn(`Invalid audit action: ${event.action}`);
      return;
    }

    if (!event.level || !Object.values(AuditLevel).includes(event.level)) {
      event.level = AuditLevel.INFO; // 默认值
    }

    if (!event.details || event.details.trim().length === 0) {
      console.warn('Audit event missing details');
      return;
    }

    // 创建审计记录
    AuditRepository.create(event);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * 获取审计日志
 */
export async function getAuditLogs(limit: number = 100, offset: number = 0): Promise<any[]> {
  try {
    return AuditRepository.findAll(limit, offset);
  } catch (error) {
    console.error('Failed to retrieve audit logs:', error);
    return [];
  }
}

/**
 * 根据用户ID获取审计日志
 */
export async function getAuditLogsByUser(userId: number, limit: number = 100): Promise<any[]> {
  try {
    return AuditRepository.findByUserId(userId, limit);
  } catch (error) {
    console.error('Failed to retrieve audit logs for user:', error);
    return [];
  }
}

/**
 * 根据操作类型获取审计日志
 */
export async function getAuditLogsByAction(action: AuditAction, limit: number = 100): Promise<any[]> {
  try {
    return AuditRepository.findByAction(action, limit);
  } catch (error) {
    console.error('Failed to retrieve audit logs by action:', error);
    return [];
  }
}

/**
 * 清理旧的审计日志
 */
export async function cleanupOldAuditLogs(olderThanDays: number): Promise<number> {
  try {
    return AuditRepository.deleteOlderThan(olderThanDays);
  } catch (error) {
    console.error('Failed to cleanup old audit logs:', error);
    return 0;
  }
}