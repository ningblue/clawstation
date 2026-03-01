// src/data/database.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import { User } from '../models/user.model';
import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';
import { AuditLog } from '../models/audit.model';

let db: Database.Database | null = null;

export async function initializeDatabase(): Promise<Database.Database> {
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
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}