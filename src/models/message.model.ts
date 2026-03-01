// src/models/message.model.ts
export interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface CreateMessageInput {
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
}

// 验证函数
export function validateMessageInput(input: CreateMessageInput): string | null {
  if (!input.conversationId || input.conversationId <= 0) {
    return 'Valid conversation ID is required';
  }

  if (!input.role || (input.role !== 'user' && input.role !== 'assistant')) {
    return 'Role must be either "user" or "assistant"';
  }

  if (!input.content || input.content.trim().length === 0) {
    return 'Content is required';
  }

  if (input.content.length > 10000) { // 10k character limit
    return 'Content must not exceed 10,000 characters';
  }

  return null;
}

export function sanitizeMessageContent(content: string): string {
  // 移除潜在的恶意内容
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .trim();
}