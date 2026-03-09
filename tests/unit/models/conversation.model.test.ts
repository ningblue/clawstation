// Tests for Conversation Model
import {
  Conversation,
  CreateConversationInput,
  UpdateConversationInput,
  validateConversationInput,
  validateUpdateConversationInput
} from '../../../src/models/conversation.model';

describe('Conversation Model', () => {
  describe('validateConversationInput', () => {
    it('should return null for valid input', () => {
      const input: CreateConversationInput = {
        userId: 1,
        title: 'Test Conversation'
      };

      expect(validateConversationInput(input)).toBeNull();
    });

    it('should return error for invalid user ID (zero)', () => {
      const input: CreateConversationInput = {
        userId: 0,
        title: 'Test Conversation'
      };

      expect(validateConversationInput(input)).toBe('Valid user ID is required');
    });

    it('should return error for invalid user ID (negative)', () => {
      const input: CreateConversationInput = {
        userId: -1,
        title: 'Test Conversation'
      };

      expect(validateConversationInput(input)).toBe('Valid user ID is required');
    });

    it('should return error for missing user ID', () => {
      const input = {
        title: 'Test Conversation'
      } as CreateConversationInput;

      expect(validateConversationInput(input)).toBe('Valid user ID is required');
    });

    it('should return error for empty title', () => {
      const input: CreateConversationInput = {
        userId: 1,
        title: ''
      };

      expect(validateConversationInput(input)).toBe('Title is required');
    });

    it('should return error for whitespace-only title', () => {
      const input: CreateConversationInput = {
        userId: 1,
        title: '   '
      };

      expect(validateConversationInput(input)).toBe('Title is required');
    });

    it('should return error for title exceeding 200 characters', () => {
      const input: CreateConversationInput = {
        userId: 1,
        title: 'a'.repeat(201)
      };

      expect(validateConversationInput(input)).toBe('Title must not exceed 200 characters');
    });

    it('should accept title with exactly 200 characters', () => {
      const input: CreateConversationInput = {
        userId: 1,
        title: 'a'.repeat(200)
      };

      expect(validateConversationInput(input)).toBeNull();
    });

    it('should trim whitespace from title before validation', () => {
      const input: CreateConversationInput = {
        userId: 1,
        title: '  Valid Title  '
      };

      expect(validateConversationInput(input)).toBeNull();
    });
  });

  describe('validateUpdateConversationInput', () => {
    it('should return null for valid update', () => {
      const input: UpdateConversationInput = {
        title: 'Updated Title'
      };

      expect(validateUpdateConversationInput(input)).toBeNull();
    });

    it('should return null for empty update object', () => {
      const input: UpdateConversationInput = {};

      expect(validateUpdateConversationInput(input)).toBeNull();
    });

    it('should return error for empty title in update', () => {
      const input: UpdateConversationInput = {
        title: ''
      };

      expect(validateUpdateConversationInput(input)).toBe('Title cannot be empty');
    });

    it('should return error for whitespace-only title in update', () => {
      const input: UpdateConversationInput = {
        title: '   '
      };

      expect(validateUpdateConversationInput(input)).toBe('Title cannot be empty');
    });

    it('should return error for title exceeding 200 characters in update', () => {
      const input: UpdateConversationInput = {
        title: 'a'.repeat(201)
      };

      expect(validateUpdateConversationInput(input)).toBe('Title must not exceed 200 characters');
    });

    it('should accept title with exactly 200 characters in update', () => {
      const input: UpdateConversationInput = {
        title: 'a'.repeat(200)
      };

      expect(validateUpdateConversationInput(input)).toBeNull();
    });
  });

  describe('Conversation interface', () => {
    it('should create a valid Conversation object', () => {
      const now = new Date().toISOString();
      const conversation: Conversation = {
        id: 1,
        title: 'Test Conversation',
        userId: 1,
        createdAt: now,
        updatedAt: now
      };

      expect(conversation.id).toBe(1);
      expect(conversation.title).toBe('Test Conversation');
      expect(conversation.userId).toBe(1);
      expect(conversation.createdAt).toBe(now);
      expect(conversation.updatedAt).toBe(now);
    });
  });
});
