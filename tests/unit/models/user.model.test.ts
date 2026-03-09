// Tests for User Model
import {
  User,
  CreateUserInput,
  UpdateUserInput,
  validateUserInput
} from '../../../src/models/user.model';

describe('User Model', () => {
  describe('validateUserInput', () => {
    it('should return null for valid input', () => {
      const input: CreateUserInput = {
        username: 'testuser',
        email: 'test@example.com',
        preferences: { theme: 'dark' }
      };

      expect(validateUserInput(input)).toBeNull();
    });

    it('should return error for username less than 3 characters', () => {
      const input: CreateUserInput = {
        username: 'ab',
        email: 'test@example.com'
      };

      expect(validateUserInput(input)).toBe('Username must be at least 3 characters long');
    });

    it('should return error for empty username', () => {
      const input: CreateUserInput = {
        username: '',
        email: 'test@example.com'
      };

      expect(validateUserInput(input)).toBe('Username must be at least 3 characters long');
    });

    it('should return error for whitespace-only username', () => {
      const input: CreateUserInput = {
        username: '   ',
        email: 'test@example.com'
      };

      expect(validateUserInput(input)).toBe('Username must be at least 3 characters long');
    });

    it('should return error for missing email', () => {
      const input: CreateUserInput = {
        username: 'testuser',
        email: ''
      };

      expect(validateUserInput(input)).toBe('Valid email is required');
    });

    it('should return error for invalid email format', () => {
      const input: CreateUserInput = {
        username: 'testuser',
        email: 'invalid-email'
      };

      expect(validateUserInput(input)).toBe('Valid email is required');
    });

    it('should return error for email without domain', () => {
      const input: CreateUserInput = {
        username: 'testuser',
        email: 'test@'
      };

      expect(validateUserInput(input)).toBe('Valid email is required');
    });

    it('should return error for email without @ symbol', () => {
      const input: CreateUserInput = {
        username: 'testuser',
        email: 'test.example.com'
      };

      expect(validateUserInput(input)).toBe('Valid email is required');
    });

    it('should accept valid email with subdomain', () => {
      const input: CreateUserInput = {
        username: 'testuser',
        email: 'test@sub.domain.com'
      };

      expect(validateUserInput(input)).toBeNull();
    });

    it('should accept valid email with plus sign', () => {
      const input: CreateUserInput = {
        username: 'testuser',
        email: 'test+tag@example.com'
      };

      expect(validateUserInput(input)).toBeNull();
    });

    it('should handle optional preferences', () => {
      const input: CreateUserInput = {
        username: 'testuser',
        email: 'test@example.com'
      };

      expect(validateUserInput(input)).toBeNull();
    });
  });

  describe('User interface', () => {
    it('should create a valid User object', () => {
      const user: User = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
        preferences: JSON.stringify({ theme: 'dark' })
      };

      expect(user.id).toBe(1);
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.preferences).toBe('{"theme":"dark"}');
    });
  });
});
