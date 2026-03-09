// Tests for Audit Model
import {
  AuditLog,
  AuditEvent,
  AuditLevel,
  AuditAction,
  validateAuditEvent
} from '../../../src/models/audit.model';

describe('Audit Model', () => {
  describe('validateAuditEvent', () => {
    it('should return null for valid audit event', () => {
      const event: AuditEvent = {
        action: AuditAction.USER_LOGIN,
        level: AuditLevel.INFO,
        details: 'User logged in successfully'
      };

      expect(validateAuditEvent(event)).toBeNull();
    });

    it('should return error for missing action', () => {
      const event = {
        level: AuditLevel.INFO,
        details: 'Some details'
      } as AuditEvent;

      expect(validateAuditEvent(event)).toBe('Action is required');
    });

    it('should return error for invalid action', () => {
      const event = {
        action: 'INVALID_ACTION',
        level: AuditLevel.INFO,
        details: 'Some details'
      } as AuditEvent;

      expect(validateAuditEvent(event)).toBe('Invalid audit action');
    });

    it('should return error for missing level', () => {
      const event = {
        action: AuditAction.USER_LOGIN,
        details: 'Some details'
      } as AuditEvent;

      expect(validateAuditEvent(event)).toBe('Valid audit level is required');
    });

    it('should return error for invalid level', () => {
      const event = {
        action: AuditAction.USER_LOGIN,
        level: 'INVALID_LEVEL',
        details: 'Some details'
      } as AuditEvent;

      expect(validateAuditEvent(event)).toBe('Valid audit level is required');
    });

    it('should return error for missing details', () => {
      const event = {
        action: AuditAction.USER_LOGIN,
        level: AuditLevel.INFO,
        details: ''
      } as AuditEvent;

      expect(validateAuditEvent(event)).toBe('Details are required');
    });

    it('should return error for whitespace-only details', () => {
      const event: AuditEvent = {
        action: AuditAction.USER_LOGIN,
        level: AuditLevel.INFO,
        details: '   '
      };

      expect(validateAuditEvent(event)).toBe('Details are required');
    });

    it('should return error for details exceeding 1000 characters', () => {
      const event: AuditEvent = {
        action: AuditAction.USER_LOGIN,
        level: AuditLevel.INFO,
        details: 'a'.repeat(1001)
      };

      expect(validateAuditEvent(event)).toBe('Details must not exceed 1000 characters');
    });

    it('should accept details with exactly 1000 characters', () => {
      const event: AuditEvent = {
        action: AuditAction.USER_LOGIN,
        level: AuditLevel.INFO,
        details: 'a'.repeat(1000)
      };

      expect(validateAuditEvent(event)).toBeNull();
    });

    it('should accept all valid audit actions', () => {
      const validActions = Object.values(AuditAction);

      validActions.forEach(action => {
        const event: AuditEvent = {
          action,
          level: AuditLevel.INFO,
          details: `Test ${action}`
        };
        expect(validateAuditEvent(event)).toBeNull();
      });
    });

    it('should accept all valid audit levels', () => {
      const validLevels = Object.values(AuditLevel);

      validLevels.forEach(level => {
        const event: AuditEvent = {
          action: AuditAction.USER_LOGIN,
          level,
          details: `Test ${level}`
        };
        expect(validateAuditEvent(event)).toBeNull();
      });
    });

    it('should accept event with optional userId', () => {
      const event: AuditEvent = {
        userId: 1,
        action: AuditAction.USER_LOGIN,
        level: AuditLevel.INFO,
        details: 'User logged in'
      };

      expect(validateAuditEvent(event)).toBeNull();
    });

    it('should accept event with all optional fields', () => {
      const event: AuditEvent = {
        userId: 1,
        action: AuditAction.USER_LOGIN,
        level: AuditLevel.INFO,
        details: 'User logged in',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session-123',
        timestamp: new Date()
      };

      expect(validateAuditEvent(event)).toBeNull();
    });
  });

  describe('AuditAction enum', () => {
    it('should have all expected actions', () => {
      expect(AuditAction.USER_LOGIN).toBe('USER_LOGIN');
      expect(AuditAction.USER_LOGOUT).toBe('USER_LOGOUT');
      expect(AuditAction.CONVERSATION_CREATE).toBe('CONVERSATION_CREATE');
      expect(AuditAction.MESSAGE_SEND).toBe('MESSAGE_SEND');
      expect(AuditAction.MESSAGE_DELETE).toBe('MESSAGE_DELETE');
      expect(AuditAction.CONFIG_UPDATE).toBe('CONFIG_UPDATE');
      expect(AuditAction.FILE_ACCESS).toBe('FILE_ACCESS');
      expect(AuditAction.SECURITY_EVENT).toBe('SECURITY_EVENT');
      expect(AuditAction.SYSTEM_ERROR).toBe('SYSTEM_ERROR');
    });
  });

  describe('AuditLevel enum', () => {
    it('should have all expected levels', () => {
      expect(AuditLevel.INFO).toBe('INFO');
      expect(AuditLevel.WARN).toBe('WARN');
      expect(AuditLevel.ERROR).toBe('ERROR');
      expect(AuditLevel.CRITICAL).toBe('CRITICAL');
    });
  });

  describe('AuditLog interface', () => {
    it('should create a valid AuditLog object', () => {
      const now = new Date().toISOString();
      const log: AuditLog = {
        id: 1,
        userId: 1,
        action: AuditAction.USER_LOGIN,
        details: 'User logged in',
        timestamp: now,
        ip: '192.168.1.1'
      };

      expect(log.id).toBe(1);
      expect(log.userId).toBe(1);
      expect(log.action).toBe(AuditAction.USER_LOGIN);
      expect(log.details).toBe('User logged in');
      expect(log.timestamp).toBe(now);
      expect(log.ip).toBe('192.168.1.1');
    });

    it('should allow null userId', () => {
      const log: AuditLog = {
        id: 1,
        userId: null,
        action: AuditAction.SYSTEM_ERROR,
        details: 'System error occurred',
        timestamp: new Date().toISOString()
      };

      expect(log.userId).toBeNull();
    });
  });
});
