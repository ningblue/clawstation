// src/data/migrations/001-initial.migration.ts
// 初始数据库迁移 - 创建核心表结构

import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
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
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(userId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)');
}

export function down(db: Database.Database): void {
  // 删除索引
  db.exec('DROP INDEX IF EXISTS idx_audit_action');
  db.exec('DROP INDEX IF EXISTS idx_audit_user');
  db.exec('DROP INDEX IF EXISTS idx_audit_timestamp');
  db.exec('DROP INDEX IF EXISTS idx_messages_conversation');
  db.exec('DROP INDEX IF EXISTS idx_conversations_user');

  // 删除表（按依赖顺序）
  db.exec('DROP TABLE IF EXISTS audit_logs');
  db.exec('DROP TABLE IF EXISTS messages');
  db.exec('DROP TABLE IF EXISTS conversations');
  db.exec('DROP TABLE IF EXISTS users');
}

export function seed(db: Database.Database): void {
  // 插入默认管理员用户（如果不存在）
  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const result = stmt.get() as { count: number };

  if (result.count === 0) {
    db.exec(`
      INSERT INTO users (username, email, preferences)
      VALUES ('admin', 'admin@clawstation.local', '{}')
    `);
  }
}

export const migrationInfo = {
  version: 1,
  name: 'initial',
  description: '创建核心表结构：users, conversations, messages, audit_logs',
  timestamp: '2026-02-26T00:00:00Z',
};
