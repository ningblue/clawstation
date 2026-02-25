import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs';

let db: Database.Database | null = null;

export interface Conversation {
  id: number;
  title: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  preferences: string; // JSON字符串
}

export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  details: string;
  timestamp: string;
  ip?: string;
}

export async function setupDatabase(): Promise<Database.Database> {
  // 确保用户数据目录存在
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'clawstation.db');

  // 连接数据库
  db = new Database(dbPath);

  // 创建用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      preferences TEXT DEFAULT '{}'
    )
  `);

  // 创建对话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      userId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // 创建消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversationId INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  // 创建审计日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip TEXT,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // 创建索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(userId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversationId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)');

  // 插入默认管理员用户（如果不存在）
  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const result = stmt.get() as { count: number };

  if (result.count === 0) {
    db.exec("INSERT INTO users (username, email, preferences) VALUES ('admin', 'admin@clawstation.local', '{}')");
  }

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call setupDatabase() first.');
  }
  return db;
}

// 用户相关操作
export function getUserById(id: number): User | null {
  const stmt = getDatabase().prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as User | null;
}

export function getUserByUsername(username: string): User | null {
  const stmt = getDatabase().prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username) as User | null;
}

export function createUser(username: string, email: string, preferences: object = {}): User {
  const db = getDatabase();
  const preferencesStr = JSON.stringify(preferences);

  const stmt = db.prepare('INSERT INTO users (username, email, preferences) VALUES (?, ?, ?)');
  const result = stmt.run(username, email, preferencesStr);

  return {
    id: result.lastInsertRowid as number,
    username,
    email,
    createdAt: new Date().toISOString(),
    preferences: preferencesStr
  };
}

// 对话相关操作
export function getConversationsByUserId(userId: number): Conversation[] {
  const stmt = getDatabase().prepare('SELECT * FROM conversations WHERE userId = ? ORDER BY updatedAt DESC');
  return stmt.all(userId) as Conversation[];
}

export function getConversationById(id: number): Conversation | null {
  const stmt = getDatabase().prepare('SELECT * FROM conversations WHERE id = ?');
  return stmt.get(id) as Conversation | null;
}

export function createConversation(userId: number, title: string): Conversation {
  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO conversations (userId, title) VALUES (?, ?)');
  const result = stmt.run(userId, title);

  return {
    id: result.lastInsertRowid as number,
    userId,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function updateConversationTitle(id: number, title: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE conversations SET title = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
  const result = stmt.run(title, id);
  return result.changes > 0;
}

// 消息相关操作
export function getMessagesByConversationId(conversationId: number): Message[] {
  const stmt = getDatabase().prepare('SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC');
  return stmt.all(conversationId) as Message[];
}

export function createMessage(conversationId: number, role: 'user' | 'assistant', content: string): Message {
  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO messages (conversationId, role, content) VALUES (?, ?, ?)');
  const result = stmt.run(conversationId, role, content);

  return {
    id: result.lastInsertRowid as number,
    conversationId,
    role,
    content,
    timestamp: new Date().toISOString()
  };
}

export function deleteConversation(id: number): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}