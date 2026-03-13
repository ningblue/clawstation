/**
 * electron-builder afterPack 钩子入口
 * 根据目标平台分发到对应的处理模块
 *
 * Node.js 运行时在构建前通过 download:node 脚本下载
 */
const { resolveArch } = require('./after-pack/common');

// 平台处理模块
const darwinHandler = require('./after-pack/darwin');
const win32Handler = require('./after-pack/win32');
const linuxHandler = require('./after-pack/linux');

/**
 * afterPack 钩子入口
 * @param {Object} context - electron-builder 上下文
 */
module.exports = async function afterPack(context) {
  const targetPlatform = context?.electronPlatformName || process.platform;
  const targetArch = resolveArch(context?.arch);

  console.log(`\n📦 afterPack: ${targetPlatform}-${targetArch}\n`);

  // 根据平台分发到对应的处理模块
  switch (targetPlatform) {
    case 'darwin':
      darwinHandler.processMac(context);
      break;

    case 'win32':
      win32Handler.processWin(context);
      break;

    case 'linux':
      linuxHandler.processLinux(context);
      break;

    default:
      console.warn(`⚠️  Unsupported platform: ${targetPlatform}`);
  }
};
