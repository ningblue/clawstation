// src/models/user.model.ts
export interface User {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  preferences: string; // JSON字符串
}

export interface CreateUserInput {
  username: string;
  email: string;
  preferences?: object;
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  preferences?: object;
}

// 验证函数
export function validateUserInput(input: CreateUserInput): string | null {
  if (!input.username || input.username.trim().length < 3) {
    return 'Username must be at least 3 characters long';
  }

  if (!input.email || !isValidEmail(input.email)) {
    return 'Valid email is required';
  }

  return null;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}