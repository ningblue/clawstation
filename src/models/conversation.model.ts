// src/models/conversation.model.ts
export interface Conversation {
  id: number;
  title: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationInput {
  userId: number;
  title: string;
}

export interface UpdateConversationInput {
  title?: string;
}

// 验证函数
export function validateConversationInput(input: CreateConversationInput): string | null {
  if (!input.userId || input.userId <= 0) {
    return 'Valid user ID is required';
  }

  if (!input.title || input.title.trim().length === 0) {
    return 'Title is required';
  }

  if (input.title.trim().length > 200) {
    return 'Title must not exceed 200 characters';
  }

  return null;
}

export function validateUpdateConversationInput(input: UpdateConversationInput): string | null {
  if (input.title && input.title.trim().length === 0) {
    return 'Title cannot be empty';
  }

  if (input.title && input.title.trim().length > 200) {
    return 'Title must not exceed 200 characters';
  }

  return null;
}