// src/data/index.ts
// 数据访问层统一导出

// 数据库连接
export {
  initializeDatabase,
  getDatabase,
} from './database';

// 仓库类
export { UserRepository } from './repositories/user.repository';
export { ConversationRepository } from './repositories/conversation.repository';
export { MessageRepository } from './repositories/message.repository';
export { AuditRepository } from './repositories/audit.repository';
