// src/models/audit.model.ts
export enum AuditLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

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

export interface AuditLog {
  id: number;
  userId: number | null;
  action: AuditAction;
  details: string;
  timestamp: string;
  ip?: string;
}

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

// 验证函数
export function validateAuditEvent(event: AuditEvent): string | null {
  if (!event.action) {
    return 'Action is required';
  }

  if (!Object.values(AuditAction).includes(event.action)) {
    return 'Invalid audit action';
  }

  if (!event.level || !Object.values(AuditLevel).includes(event.level)) {
    return 'Valid audit level is required';
  }

  if (!event.details || event.details.trim().length === 0) {
    return 'Details are required';
  }

  if (event.details.length > 1000) {
    return 'Details must not exceed 1000 characters';
  }

  return null;
}