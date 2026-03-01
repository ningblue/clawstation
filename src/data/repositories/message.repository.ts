// src/data/repositories/message.repository.ts
import { getDatabase } from '../database';
import { Message, CreateMessageInput } from '../../models/message.model';

export class MessageRepository {
  /**
   * 根据对话ID获取消息列表
   */
  static findByConversationId(conversationId: number): Message[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC');
    return stmt.all(conversationId) as Message[];
  }

  /**
   * 根据ID获取单条消息
   */
  static findById(id: number): Message | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM messages WHERE id = ?');
    return stmt.get(id) as Message | null;
  }

  /**
   * 创建新消息
   */
  static create(messageData: CreateMessageInput): Message {
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO messages (conversationId, role, content) VALUES (?, ?, ?)');
    const result = stmt.run(messageData.conversationId, messageData.role, messageData.content);

    return {
      id: result.lastInsertRowid as number,
      conversationId: messageData.conversationId,
      role: messageData.role,
      content: messageData.content,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 删除消息
   */
  static delete(id: number): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 删除对话中的所有消息
   */
  static deleteByConversationId(conversationId: number): number {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM messages WHERE conversationId = ?');
    const result = stmt.run(conversationId);
    return result.changes as number;
  }

  /**
   * 获取所有消息
   */
  static findAll(): Message[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM messages ORDER BY timestamp ASC');
    return stmt.all() as Message[];
  }

  /**
   * 获取指定数量的最新消息
   */
  static findLatest(conversationId: number, limit: number): Message[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE conversationId = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(conversationId, limit) as Message[];
  }
}