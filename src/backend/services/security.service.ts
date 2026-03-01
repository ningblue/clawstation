// src/backend/security.service.ts
import * as path from 'path';

/**
 * 输入验证和过滤函数
 */
export function validateInput(input: string, maxLength: number = 1000): string {
  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }

  // 移除潜在的恶意字符序列
  let cleanInput = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // 移除事件处理器

  return cleanInput.trim();
}

/**
 * 文件路径安全验证
 */
export function validateFilePath(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath);

  // 防止路径遍历攻击
  if (normalizedPath.includes('..') || normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
    return false;
  }

  // 只允许预期的文件扩展名
  const allowedExtensions = ['.txt', '.json', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.mp3', '.mp4'];
  const ext = path.extname(normalizedPath).toLowerCase();

  return allowedExtensions.includes(ext);
}

/**
 * 内容过滤器
 */
export class ContentFilter {
  private static blockedWords: string[] = [
    // 示例：包含敏感或不当内容的词
    'password:',
    'token:',
    'secret:',
    'api_key:',
    'private_key:',
    'ssh_rsa',
    '-----BEGIN'
  ];

  static filterContent(content: string): boolean {
    const lowerContent = content.toLowerCase();

    for (const word of this.blockedWords) {
      if (lowerContent.includes(word.toLowerCase())) {
        return false; // 内容被过滤
      }
    }

    return true; // 内容通过过滤
  }

  static addBlockedWord(word: string): void {
    this.blockedWords.push(word.toLowerCase());
  }
}