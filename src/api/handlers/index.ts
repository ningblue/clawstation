// src/api/handlers/index.ts

import { ipcMain } from 'electron';
import { OpenClawManager } from '../../backend/services/openclaw.service';
import { setupUserRoutes } from '../routes/user.route';
import { setupConversationRoutes } from '../routes/conversation.route';
import { setupMessageRoutes } from '../routes/message.route';
import { setupOpenClawRoutes } from '../routes/openclaw.route';
import { setupOpenClawMonitorRoutes } from '../routes/openclaw-monitor.route';
import { setupAuditRoutes } from '../routes/audit.route';
import { setupReminderHandlers } from './reminders';
import { setupMiniMaxOAuthRoutes } from '../routes/minimax-oauth.route';

// 跟踪已注册的处理器
let handlersInitialized = false;
let openClawHandlersInitialized = false;

// 导出 IPC 处理器封装
export * from './ipc.handler';

/**
 * 初始化所有API路由
 */
export function initializeApiHandlers(openclawManager?: OpenClawManager): void {
  console.log('Initializing API handlers...');

  // 避免重复注册基础处理器
  if (!handlersInitialized) {
    setupUserRoutes();
    setupConversationRoutes();
    setupMessageRoutes();
    setupAuditRoutes();
    setupReminderHandlers();
    handlersInitialized = true;
    console.log('Basic API handlers registered');
  }

  // 如果提供了OpenClaw管理器，设置相关路由
  if (openclawManager && !openClawHandlersInitialized) {
    setupOpenClawRoutes(openclawManager);
    setupOpenClawMonitorRoutes(openclawManager);
    setupMiniMaxOAuthRoutes(openclawManager);
    openClawHandlersInitialized = true;
    console.log('OpenClaw routes initialized');
  }

  console.log('All API handlers initialized');
}