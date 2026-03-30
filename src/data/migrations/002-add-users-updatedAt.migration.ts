// src/data/migrations/002-add-users-updatedAt.migration.ts
// 迁移：为 users 表添加 updatedAt 字段

import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  db.exec(`
    ALTER TABLE users ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    ALTER TABLE users DROP COLUMN updatedAt
  `);
}

export const migrationInfo = {
  version: 2,
  name: 'add-users-updatedAt',
  description: '为 users 表添加 updatedAt 字段',
  timestamp: '2026-03-21T00:00:00Z',
};