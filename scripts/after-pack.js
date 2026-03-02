/**
 * electron-builder afterPack 钩子
 * 在打包完成后下载 Node.js 运行时
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = async function(context) {
  const { platform, arch } = context.electronPlatformName;
  const targetPlatform = platform;
  const targetArch = arch;
  
  console.log(`\n📦 afterPack: ${targetPlatform}-${targetArch}\n`);
  
  // 调用下载脚本
  const scriptPath = path.join(__dirname, 'download-node.js');
  
  try {
    execSync(`node "${scriptPath}" ${targetPlatform} ${targetArch}`, {
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✅ Node.js runtime downloaded for packaging');
  } catch (error) {
    console.error('⚠️ Failed to download Node.js runtime:', error.message);
    // 不抛出错误，允许构建继续
  }
};
