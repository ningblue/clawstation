// src/data/repositories/user.repository.ts
import { getDatabase } from '../database';
import { User, CreateUserInput, UpdateUserInput } from '../../models/user.model';

export class UserRepository {
  /**
   * 根据ID获取用户
   */
  static findById(id: number): User | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | null;
  }

  /**
   * 根据用户名获取用户
   */
  static findByUsername(username: string): User | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | null;
  }

  /**
   * 根据邮箱获取用户
   */
  static findByEmail(email: string): User | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | null;
  }

  /**
   * 创建新用户
   */
  static create(userData: CreateUserInput): User {
    const db = getDatabase();
    const preferencesStr = JSON.stringify(userData.preferences || {});

    const stmt = db.prepare('INSERT INTO users (username, email, preferences) VALUES (?, ?, ?)');
    const result = stmt.run(userData.username, userData.email, preferencesStr);

    return {
      id: result.lastInsertRowid as number,
      username: userData.username,
      email: userData.email,
      createdAt: new Date().toISOString(),
      preferences: preferencesStr
    };
  }

  /**
   * 更新用户信息
   */
  static update(id: number, userData: UpdateUserInput): User | null {
    const db = getDatabase();
    const updates: string[] = [];
    const params: any[] = [];

    if (userData.username) {
      updates.push('username = ?');
      params.push(userData.username);
    }

    if (userData.email) {
      updates.push('email = ?');
      params.push(userData.email);
    }

    if (userData.preferences) {
      updates.push('preferences = ?');
      params.push(JSON.stringify(userData.preferences));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
    const result = stmt.run(...params);

    return result.changes > 0 ? this.findById(id) : null;
  }

  /**
   * 删除用户
   */
  static delete(id: number): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 获取所有用户
   */
  static findAll(): User[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users ORDER BY createdAt DESC');
    return stmt.all() as User[];
  }
}