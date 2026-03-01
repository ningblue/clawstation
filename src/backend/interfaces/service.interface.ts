// src/backend/interfaces/service.interface.ts
// 服务层接口契约定义

import { Conversation, CreateConversationInput, UpdateConversationInput } from '../../models/conversation.model';
import { Message, CreateMessageInput } from '../../models/message.model';
import { User, CreateUserInput, UpdateUserInput } from '../../models/user.model';
import { AuditEvent } from '../../models/audit.model';

/**
 * 对话服务接口
 */
export interface IConversationService {
  getConversationById(id: number): Promise<Conversation | null>;
  getConversationsByUserId(userId: number): Promise<Conversation[]>;
  createConversation(data: CreateConversationInput): Promise<Conversation>;
  updateConversation(id: number, data: UpdateConversationInput): Promise<Conversation | null>;
  deleteConversation(id: number): Promise<boolean>;
  deleteConversationsByUserId(userId: number): Promise<number>;
}

/**
 * 消息服务接口
 */
export interface IMessageService {
  getMessageById(id: number): Promise<Message | null>;
  getMessagesByConversationId(conversationId: number): Promise<Message[]>;
  createMessage(data: CreateMessageInput): Promise<Message>;
  deleteMessagesByConversationId(conversationId: number): Promise<number>;
}

/**
 * 用户服务接口
 */
export interface IUserService {
  getUserById(id: number): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
  createUser(data: CreateUserInput): Promise<User>;
  updateUser(id: number, data: UpdateUserInput): Promise<User | null>;
  deleteUser(id: number): Promise<boolean>;
}

/**
 * 审计服务接口
 */
export interface IAuditService {
  logEvent(event: AuditEvent): Promise<void>;
  getLogs(limit?: number, offset?: number): Promise<any[]>;
  getLogsByUser(userId: number, limit?: number): Promise<any[]>;
  cleanupOldLogs(olderThanDays: number): Promise<number>;
}

/**
 * OpenClaw 服务接口
 */
export interface IOpenClawService {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
  getStatus(): Promise<OpenClawStatus>;
  sendQuery(message: string, conversationId?: number): Promise<string>;
}

/**
 * OpenClaw 状态
 */
export interface OpenClawStatus {
  isRunning: boolean;
  isHealthy: boolean;
  pid?: number;
  uptime?: number;
  version?: string;
  error?: string;
  port: number;
}

/**
 * 安全服务接口
 */
export interface ISecurityService {
  validateInput(input: string, maxLength?: number): string;
  validateFilePath(filePath: string): boolean;
  filterContent(content: string): boolean;
}
