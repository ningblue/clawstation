// src/api/index.ts

/**
 * API 层统一导出
 * BMAD 架构 - API Layer
 */

// 类型定义
export * from './types';

// 处理器
export * from './handlers';

// 中间件
export * from './middleware/auth.middleware';

// 路由（按需导出）
export { setupUserRoutes } from './routes/user.route';
export { setupConversationRoutes } from './routes/conversation.route';
export { setupMessageRoutes } from './routes/message.route';
export { setupOpenClawRoutes } from './routes/openclaw.route';
export { setupAuditRoutes } from './routes/audit.route';
export { setupOpenClawMonitorRoutes } from './routes/openclaw-monitor.route';
export { setupModelConfigRoutes } from './routes/model-config.route';
