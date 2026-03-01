// src/data/repositories/conversation.repository.ts
import { getDatabase } from '../database';
import { Conversation, CreateConversationInput, UpdateConversationInput } from '../../models/conversation.model';

export class ConversationRepository {
  /**
   * 根据ID获取对话
   */
  static findById(id: number): Conversation | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
    return stmt.get(id) as Conversation | null;
  }

  /**
   * 根据用户ID获取对话列表
   */
  static findByUserId(userId: number): Conversation[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM conversations WHERE userId = ? ORDER BY updatedAt DESC');
    return stmt.all(userId) as Conversation[];
  }

  /**
   * 创建新对话
   */
  static create(conversationData: CreateConversationInput): Conversation {
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO conversations (userId, title) VALUES (?, ?)');
    const result = stmt.run(conversationData.userId, conversationData.title);

    return {
      id: result.lastInsertRowid as number,
      userId: conversationData.userId,
      title: conversationData.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * 更新对话
   */
  static update(id: number, conversationData: UpdateConversationInput): Conversation | null {
    const db = getDatabase();
    const updates: string[] = [];
    const params: any[] = [];

    if (conversationData.title) {
      updates.push('title = ?');
      params.push(conversationData.title);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    const stmt = db.prepare(`UPDATE conversations SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
    const result = stmt.run(...params);

    return result.changes > 0 ? this.findById(id) : null;
  }

  /**
   * 删除对话
   */
  static delete(id: number): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 批量删除用户的对话
   */
  static deleteByUserId(userId: number): number {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM conversations WHERE userId = ?');
    const result = stmt.run(userId);
    return result.changes as number;
  }

  /**
   * 获取所有对话
   */
  static findAll(): Conversation[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM conversations ORDER BY updatedAt DESC');
    return stmt.all() as Conversation[];
  }
}