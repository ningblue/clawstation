/**
 * Windows 平台打包后处理
 * - openclaw.zip 由 installer.nsh 在安装时解压
 */
const path = require('path');
const fs = require('fs');

/**
 * Windows 平台处理入口
 * 注意：openclaw.zip 的解压由 installer.nsh 在安装时处理
 */
function processWin(context) {
  const appOutDir = context?.appOutDir;

  if (!appOutDir) {
    console.warn('⚠️  [Windows] Missing appOutDir');
    return;
  }

  console.log('\n🪟 Processing Windows package...\n');

  // Windows 的 openclaw.zip 解压由 installer.nsh 处理
  // 这里可以添加其他 Windows 专属的处理逻辑

  console.log('ℹ️  [Windows] openclaw.zip will be extracted by installer.nsh during installation');
  console.log('✅ [Windows] afterPack completed\n');
}

module.exports = {
  processWin,
};
