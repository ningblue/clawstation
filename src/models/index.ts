// src/models/index.ts
// 数据模型层统一导出

// 用户模型
export {
  User,
  CreateUserInput,
  UpdateUserInput,
  validateUserInput,
} from './user.model';

// 对话模型
export {
  Conversation,
  CreateConversationInput,
  UpdateConversationInput,
  validateConversationInput,
  validateUpdateConversationInput,
} from './conversation.model';

// 消息模型
export {
  Message,
  CreateMessageInput,
  validateMessageInput,
  sanitizeMessageContent,
} from './message.model';

// 审计模型
export {
  AuditLog,
  AuditEvent,
  AuditAction,
  AuditLevel,
  validateAuditEvent,
} from './audit.model';
