/**
 * electron-builder afterPack 钩子
 * 在打包时按目标平台/架构下载 Node.js 运行时到 resources/node/<platform>-<arch>/node
 */
const { execSync } = require('child_process');
const path = require('path');

function resolveArch(archValue) {
  if (typeof archValue === 'string' && archValue) {
    return archValue;
  }

  // electron-builder Arch enum: ia32=0, x64=1, armv7l=2, arm64=3, universal=4
  const archMap = {
    0: 'ia32',
    1: 'x64',
    2: 'armv7l',
    3: 'arm64',
    4: 'x64',
  };

  return archMap[archValue] || process.arch;
}

module.exports = async function afterPack(context) {
  const targetPlatform = context?.electronPlatformName || process.platform;
  const targetArch = resolveArch(context?.arch);

  console.log(`\n📦 afterPack: ${targetPlatform}-${targetArch}\n`);

  const scriptPath = path.join(__dirname, 'download-node.js');

  try {
    execSync(`node "${scriptPath}" ${targetPlatform} ${targetArch}`, {
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✅ Node.js runtime downloaded for packaging');
  } catch (error) {
    console.error('⚠️ Failed to download Node.js runtime:', error.message);
    // 不抛出错误，允许构建继续（运行时会有明确错误提示）
  }
};
