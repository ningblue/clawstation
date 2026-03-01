// src/backend/services/message.service.ts
import { Message, CreateMessageInput, sanitizeMessageContent, validateMessageInput } from '../../models/message.model';
import { MessageRepository } from '../../data/repositories/message.repository';
import { validateInput } from './security.service';
import { ConversationService } from './conversation.service';

export class MessageService {
  /**
   * 获取对话中的所有消息
   */
  static async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    try {
      // 输入验证
      if (!conversationId || conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      // 验证对话是否存在
      const conversation = await ConversationService.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation does not exist');
      }

      return MessageRepository.findByConversationId(conversationId);
    } catch (error) {
      console.error('Error getting messages by conversation ID:', error);
      throw error;
    }
  }

  /**
   * 获取最新消息
   */
  static async getLatestMessages(conversationId: number, limit: number = 10): Promise<Message[]> {
    try {
      // 输入验证
      if (!conversationId || conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      if (limit <= 0 || limit > 100) {
        throw new Error('Limit must be between 1 and 100');
      }

      // 验证对话是否存在
      const conversation = await ConversationService.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation does not exist');
      }

      return MessageRepository.findLatest(conversationId, limit);
    } catch (error) {
      console.error('Error getting latest messages:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取单条消息
   */
  static async getMessageById(id: number): Promise<Message | null> {
    try {
      // 输入验证
      if (!id || id <= 0) {
        throw new Error('Invalid message ID');
      }

      return MessageRepository.findById(id);
    } catch (error) {
      console.error('Error getting message by ID:', error);
      throw error;
    }
  }

  /**
   * 创建新消息
   */
  static async createMessage(messageData: CreateMessageInput): Promise<Message> {
    try {
      // 验证输入数据
      const validationError = validateMessageInput(messageData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError}`);
      }

      // 验证和清理输入
      const sanitizedContent = validateInput(messageData.content, 10000);
      const cleanContent = sanitizeMessageContent(sanitizedContent);

      // 验证对话是否存在
      const conversation = await ConversationService.getConversationById(messageData.conversationId);
      if (!conversation) {
        throw new Error('Conversation does not exist');
      }

      // 创建消息
      return MessageRepository.create({
        ...messageData,
        content: cleanContent
      });
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  /**
   * 删除消息
   */
  static async deleteMessage(id: number): Promise<boolean> {
    try {
      // 输入验证
      if (!id || id <= 0) {
        throw new Error('Invalid message ID');
      }

      // 检查消息是否存在
      const existingMessage = MessageRepository.findById(id);
      if (!existingMessage) {
        throw new Error('Message does not exist');
      }

      // 删除消息
      return MessageRepository.delete(id);
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  /**
   * 删除对话中的所有消息
   */
  static async deleteMessagesByConversationId(conversationId: number): Promise<number> {
    try {
      // 输入验证
      if (!conversationId || conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      // 验证对话是否存在
      const conversation = await ConversationService.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation does not exist');
      }

      // 删除对话中的所有消息
      return MessageRepository.deleteByConversationId(conversationId);
    } catch (error) {
      console.error('Error deleting messages by conversation ID:', error);
      throw error;
    }
  }

  /**
   * 获取所有消息
   */
  static async getAllMessages(): Promise<Message[]> {
    try {
      return MessageRepository.findAll();
    } catch (error) {
      console.error('Error getting all messages:', error);
      throw error;
    }
  }
}