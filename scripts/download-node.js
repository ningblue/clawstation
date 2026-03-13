#!/usr/bin/env node
/**
 * Node.js 运行时下载器 - 入口
 * 在 electron-builder 构建前下载 Node.js 运行时
 */

// 平台处理器
const darwin = require('./download-node/darwin');
const win32 = require('./download-node/win32');
const linux = require('./download-node/linux');

async function main() {
  // 解析命令行参数
  let targetPlatform = process.argv[2] || process.platform;
  const targetArch = process.argv[3] || process.arch;

  // 规范化平台名
  const normalizedPlatform = targetPlatform === 'darwin' ? 'mac' :
                              targetPlatform === 'win32' ? 'win' :
                              targetPlatform;

  // 分发到平台处理器
  switch (normalizedPlatform) {
    case 'mac':
      await darwin.download(targetArch);
      break;

    case 'win':
      await win32.download(targetArch);
      break;

    case 'linux':
      await linux.download(targetArch);
      break;

    default:
      console.error(`❌ Unsupported platform: ${targetPlatform}`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
