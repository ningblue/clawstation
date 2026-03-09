// Tests for Message Model
import {
  Message,
  CreateMessageInput,
  validateMessageInput,
  sanitizeMessageContent
} from '../../../src/models/message.model';

describe('Message Model', () => {
  describe('validateMessageInput', () => {
    it('should return null for valid user message', () => {
      const input: CreateMessageInput = {
        conversationId: 1,
        role: 'user',
        content: 'Hello, this is a test message'
      };

      expect(validateMessageInput(input)).toBeNull();
    });

    it('should return null for valid assistant message', () => {
      const input: CreateMessageInput = {
        conversationId: 1,
        role: 'assistant',
        content: 'This is a response from the assistant'
      };

      expect(validateMessageInput(input)).toBeNull();
    });

    it('should return error for invalid conversation ID (zero)', () => {
      const input: CreateMessageInput = {
        conversationId: 0,
        role: 'user',
        content: 'Test message'
      };

      expect(validateMessageInput(input)).toBe('Valid conversation ID is required');
    });

    it('should return error for invalid conversation ID (negative)', () => {
      const input: CreateMessageInput = {
        conversationId: -1,
        role: 'user',
        content: 'Test message'
      };

      expect(validateMessageInput(input)).toBe('Valid conversation ID is required');
    });

    it('should return error for missing conversation ID', () => {
      const input = {
        role: 'user',
        content: 'Test message'
      } as CreateMessageInput;

      expect(validateMessageInput(input)).toBe('Valid conversation ID is required');
    });

    it('should return error for invalid role', () => {
      const input = {
        conversationId: 1,
        role: 'invalid',
        content: 'Test message'
      } as CreateMessageInput;

      expect(validateMessageInput(input)).toBe('Role must be either "user" or "assistant"');
    });

    it('should return error for missing role', () => {
      const input = {
        conversationId: 1,
        role: '',
        content: 'Test message'
      } as CreateMessageInput;

      expect(validateMessageInput(input)).toBe('Role must be either "user" or "assistant"');
    });

    it('should return error for empty content', () => {
      const input: CreateMessageInput = {
        conversationId: 1,
        role: 'user',
        content: ''
      };

      expect(validateMessageInput(input)).toBe('Content is required');
    });

    it('should return error for whitespace-only content', () => {
      const input: CreateMessageInput = {
        conversationId: 1,
        role: 'user',
        content: '   '
      };

      expect(validateMessageInput(input)).toBe('Content is required');
    });

    it('should return error for content exceeding 10000 characters', () => {
      const input: CreateMessageInput = {
        conversationId: 1,
        role: 'user',
        content: 'a'.repeat(10001)
      };

      expect(validateMessageInput(input)).toBe('Content must not exceed 10,000 characters');
    });

    it('should accept content with exactly 10000 characters', () => {
      const input: CreateMessageInput = {
        conversationId: 1,
        role: 'user',
        content: 'a'.repeat(10000)
      };

      expect(validateMessageInput(input)).toBeNull();
    });
  });

  describe('sanitizeMessageContent', () => {
    it('should return clean content unchanged', () => {
      const content = 'This is a clean message';
      expect(sanitizeMessageContent(content)).toBe(content);
    });

    it('should remove script tags', () => {
      const content = '<script>alert("xss")</script>Hello';
      expect(sanitizeMessageContent(content)).toBe('Hello');
    });

    it('should remove complex script tags', () => {
      const content = '<script type="text/javascript">document.location="evil.com"</script>Hello';
      expect(sanitizeMessageContent(content)).toBe('Hello');
    });

    it('should remove javascript: protocol', () => {
      const content = 'javascript:alert("xss")';
      expect(sanitizeMessageContent(content)).toBe('alert("xss")');
    });

    it('should remove data: protocol', () => {
      const content = 'data:text/html,<script>alert("xss")</script>';
      expect(sanitizeMessageContent(content)).toBe('text/html,<script>alert("xss")</script>');
    });

    it('should remove vbscript: protocol', () => {
      const content = 'vbscript:msgbox("xss")';
      expect(sanitizeMessageContent(content)).toBe('msgbox("xss")');
    });

    it('should trim whitespace', () => {
      const content = '  Hello World  ';
      expect(sanitizeMessageContent(content)).toBe('Hello World');
    });

    it('should handle multiple malicious patterns', () => {
      const content = '<script>evil</script> javascript:alert("xss") data:evil';
      const result = sanitizeMessageContent(content);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('data:');
    });
  });

  describe('Message interface', () => {
    it('should create a valid Message object', () => {
      const now = new Date().toISOString();
      const message: Message = {
        id: 1,
        conversationId: 1,
        role: 'user',
        content: 'Hello',
        timestamp: now
      };

      expect(message.id).toBe(1);
      expect(message.conversationId).toBe(1);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
      expect(message.timestamp).toBe(now);
    });

    it('should allow assistant role', () => {
      const message: Message = {
        id: 2,
        conversationId: 1,
        role: 'assistant',
        content: 'Hello back',
        timestamp: new Date().toISOString()
      };

      expect(message.role).toBe('assistant');
    });
  });
});
