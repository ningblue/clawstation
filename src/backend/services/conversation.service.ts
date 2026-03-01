// src/backend/services/conversation.service.ts
import { Conversation, CreateConversationInput, UpdateConversationInput, validateConversationInput, validateUpdateConversationInput } from '../../models/conversation.model';
import { ConversationRepository } from '../../data/repositories/conversation.repository';
import { validateInput } from './security.service';
import { UserService } from './user.service';

export class ConversationService {
  /**
   * 根据ID获取对话
   */
  static async getConversationById(id: number): Promise<Conversation | null> {
    try {
      // 输入验证
      if (!id || id <= 0) {
        throw new Error('Invalid conversation ID');
      }

      return ConversationRepository.findById(id);
    } catch (error) {
      console.error('Error getting conversation by ID:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有对话
   */
  static async getConversationsByUserId(userId: number): Promise<Conversation[]> {
    try {
      // 输入验证
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      // 验证用户是否存在
      const user = await UserService.getUserById(userId);
      if (!user) {
        throw new Error('User does not exist');
      }

      return ConversationRepository.findByUserId(userId);
    } catch (error) {
      console.error('Error getting conversations by user ID:', error);
      throw error;
    }
  }

  /**
   * 创建新对话
   */
  static async createConversation(conversationData: CreateConversationInput): Promise<Conversation> {
    try {
      // 验证输入数据
      const validationError = validateConversationInput(conversationData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError}`);
      }

      // 验证和清理输入
      const sanitizedTitle = validateInput(conversationData.title, 200);

      // 验证用户是否存在
      const user = await UserService.getUserById(conversationData.userId);
      if (!user) {
        throw new Error('User does not exist');
      }

      // 创建对话
      return ConversationRepository.create({
        ...conversationData,
        title: sanitizedTitle
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * 更新对话
   */
  static async updateConversation(id: number, conversationData: UpdateConversationInput): Promise<Conversation | null> {
    try {
      // 输入验证
      if (!id || id <= 0) {
        throw new Error('Invalid conversation ID');
      }

      // 验证更新数据
      if (conversationData.title) {
        const validationError = validateUpdateConversationInput(conversationData);
        if (validationError) {
          throw new Error(`Validation error: ${validationError}`);
        }

        const sanitizedTitle = validateInput(conversationData.title, 200);
        conversationData.title = sanitizedTitle;
      }

      // 检查对话是否存在
      const existingConversation = ConversationRepository.findById(id);
      if (!existingConversation) {
        throw new Error('Conversation does not exist');
      }

      // 更新对话
      return ConversationRepository.update(id, conversationData);
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  }

  /**
   * 删除对话
   */
  static async deleteConversation(id: number): Promise<boolean> {
    try {
      // 输入验证
      if (!id || id <= 0) {
        throw new Error('Invalid conversation ID');
      }

      // 检查对话是否存在
      const existingConversation = ConversationRepository.findById(id);
      if (!existingConversation) {
        throw new Error('Conversation does not exist');
      }

      // 删除对话及其相关消息
      return ConversationRepository.delete(id);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * 删除用户的所有对话
   */
  static async deleteConversationsByUserId(userId: number): Promise<number> {
    try {
      // 输入验证
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      // 验证用户是否存在
      const user = await UserService.getUserById(userId);
      if (!user) {
        throw new Error('User does not exist');
      }

      // 删除用户的所有对话
      return ConversationRepository.deleteByUserId(userId);
    } catch (error) {
      console.error('Error deleting conversations by user ID:', error);
      throw error;
    }
  }
}