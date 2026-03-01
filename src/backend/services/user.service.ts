// src/backend/services/user.service.ts
import { User, CreateUserInput, UpdateUserInput, validateUserInput } from '../../models/user.model';
import { UserRepository } from '../../data/repositories/user.repository';
import { validateInput } from './security.service';

export class UserService {
  /**
   * 根据ID获取用户
   */
  static async getUserById(id: number): Promise<User | null> {
    try {
      // 输入验证
      if (!id || id <= 0) {
        throw new Error('Invalid user ID');
      }

      return UserRepository.findById(id);
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * 根据用户名获取用户
   */
  static async getUserByUsername(username: string): Promise<User | null> {
    try {
      // 输入验证和清理
      if (!username) {
        throw new Error('Username is required');
      }

      const sanitizedUsername = validateInput(username, 50);
      return UserRepository.findByUsername(sanitizedUsername);
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  /**
   * 创建新用户
   */
  static async createUser(userData: CreateUserInput): Promise<User> {
    try {
      // 验证输入数据
      const validationError = validateUserInput(userData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError}`);
      }

      // 验证和清理输入
      const sanitizedUsername = validateInput(userData.username, 50);
      const sanitizedEmail = validateInput(userData.email, 100);

      // 检查用户是否已存在
      const existingUser = UserRepository.findByUsername(sanitizedUsername);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      const existingEmail = UserRepository.findByEmail(sanitizedEmail);
      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // 创建用户
      return UserRepository.create({
        ...userData,
        username: sanitizedUsername,
        email: sanitizedEmail
      });
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * 更新用户信息
   */
  static async updateUser(id: number, userData: UpdateUserInput): Promise<User | null> {
    try {
      // 输入验证
      if (!id || id <= 0) {
        throw new Error('Invalid user ID');
      }

      // 验证更新数据
      if (userData.username) {
        const sanitizedUsername = validateInput(userData.username, 50);
        userData.username = sanitizedUsername;

        // 检查用户名是否已被其他用户使用
        const existingUser = UserRepository.findByUsername(sanitizedUsername);
        if (existingUser && existingUser.id !== id) {
          throw new Error('Username already exists');
        }
      }

      if (userData.email) {
        const sanitizedEmail = validateInput(userData.email, 100);
        userData.email = sanitizedEmail;

        // 检查邮箱是否已被其他用户使用
        const existingEmail = UserRepository.findByEmail(sanitizedEmail);
        if (existingEmail && existingEmail.id !== id) {
          throw new Error('Email already exists');
        }
      }

      if (userData.preferences) {
        // 确保偏好设置是有效的JSON
        JSON.stringify(userData.preferences);
      }

      // 更新用户
      return UserRepository.update(id, userData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * 删除用户
   */
  static async deleteUser(id: number): Promise<boolean> {
    try {
      // 输入验证
      if (!id || id <= 0) {
        throw new Error('Invalid user ID');
      }

      // 删除用户
      return UserRepository.delete(id);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * 获取所有用户
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      return UserRepository.findAll();
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }
}