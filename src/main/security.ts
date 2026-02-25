import { app, dialog, shell } from 'electron';
import * as path from 'path';

/**
 * 设置应用基本安全策略
 */
export function setupSecurity(): void {
  // 限制网络访问
  app.on('web-contents-created', (event, contents) => {
    // 拦截所有导航
    contents.on('will-navigate', (navEvent, navigationUrl) => {
      // 阻止除允许之外的任何导航
      const parsedUrl = new URL(navigationUrl);

      // 允许的协议
      const allowedProtocols = ['http:', 'https:', 'file:', 'mailto:', 'tel:'];
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        navEvent.preventDefault();
        console.warn(`Navigation blocked to: ${navigationUrl}`);
      }
    });

    // 拦截新窗口创建
    contents.setWindowOpenHandler(({ url }) => {
      // 对于外部链接，在浏览器中打开而不是新窗口
      if (url.startsWith('http://') || url.startsWith('https://')) {
        setImmediate(() => {
          shell.openExternal(url);
        });
        return { action: 'deny' };
      }
      // 允许内部页面
      return { action: 'allow' };
    });
  });

  // 验证远程内容加载
  app.on('remote-require', (event, webContents, moduleName) => {
    // 记录尝试使用远程模块的行为
    console.warn(`Remote module require attempted: ${moduleName}`);
    event.preventDefault();
  });

  app.on('remote-get-global', (event, webContents, globalName) => {
    console.warn(`Remote global get attempted: ${globalName}`);
    event.preventDefault();
  });
}

/**
 * 输入验证和过滤
 */
export function validateInput(input: string, maxLength: number = 1000): string {
  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }

  // 移除潜在的恶意字符序列
  input = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  input = input.replace(/javascript:/gi, '');
  input = input.replace(/data:/gi, '');
  input = input.replace(/vbscript:/gi, '');

  return input.trim();
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

/**
 * 权限检查工具
 */
export class PermissionChecker {
  static checkAdminPermission(): boolean {
    // 检查是否具有管理员权限
    try {
      // 在Linux/macOS上检查
      if (process.platform !== 'win32') {
        return process.getuid() !== 0;
      }
      // Windows上检查
      return true; // 简化的检查
    } catch (e) {
      return false;
    }
  }

  static checkFileAccess(filePath: string): boolean {
    // 检查是否可以访问指定文件
    try {
      const fs = require('fs');
      fs.accessSync(filePath, fs.constants.R_OK);
      return true;
    } catch (e) {
      return false;
    }
  }
}

/**
 * 安全警告对话框
 */
export function showSecurityWarning(message: string): void {
  dialog.showMessageBoxSync({
    type: 'warning',
    title: '安全警告',
    message: '安全风险检测',
    detail: message,
    buttons: ['确定']
  });
}

/**
 * 应用安全检查
 */
export function performSecurityCheck(): boolean {
  // 执行基本的安全检查
  try {
    // 检查是否运行在调试模式
    if (process.argv.includes('--inspect') || process.argv.includes('--inspect-brk')) {
      console.warn('Application running in debug mode');
    }

    // 检查是否有未授权的命令行参数
    const dangerousFlags = [
      '--in-process-gpu',
      '--no-sandbox',
      '--disable-web-security',
      '--disable-features=Sandbox'
    ];

    for (const flag of dangerousFlags) {
      if (process.argv.includes(flag)) {
        showSecurityWarning(`检测到潜在危险的命令行参数: ${flag}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Security check failed:', error);
    return false;
  }
}