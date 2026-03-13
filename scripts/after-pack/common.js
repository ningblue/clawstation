/**
 * 共享工具函数
 */

/**
 * 解析 electron-builder 的架构值
 */
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

/**
 * 安全执行命令，失败不抛出
 */
function safeExec(command, options = {}) {
  const { execSync } = require('child_process');
  try {
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    console.warn(`⚠️ Command failed: ${command}`);
    console.warn(`   Error: ${error.message}`);
    return null;
  }
}

module.exports = {
  resolveArch,
  safeExec,
};
