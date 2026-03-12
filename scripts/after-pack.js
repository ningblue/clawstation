/**
 * electron-builder afterPack 钩子
 * 在打包时按目标平台/架构下载 Node.js 运行时到 resources/node/<platform>-<arch>/node
 * 同时解压 openclaw.zip
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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
 * 解压 openclaw.zip 到指定目录
 */
function extractOpenClaw(appOutDir, appName) {
  try {
    const resourcesPath = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
    const zipPath = path.join(resourcesPath, 'openclaw.zip');
    const extractPath = path.join(resourcesPath, 'openclaw');

    if (!fs.existsSync(zipPath)) {
      console.warn('⚠️ openclaw.zip not found:', zipPath);
      return;
    }

    // 如果已存在 openclaw 目录，先删除
    if (fs.existsSync(extractPath)) {
      console.log('🗑️  Removing existing openclaw directory...');
      fs.rmSync(extractPath, { recursive: true, force: true });
    }

    // 解压 zip 文件
    console.log('📦 Extracting openclaw.zip...');
    execSync(`unzip -q "${zipPath}" -d "${extractPath}"`, {
      stdio: 'inherit'
    });

    // 删除 zip 文件（可选，节省空间）
    fs.unlinkSync(zipPath);

    console.log('✅ openclaw extracted successfully');
  } catch (error) {
    console.error('⚠️ Failed to extract openclaw:', error.message);
    // 不抛出错误，允许构建继续
  }
}

module.exports = async function afterPack(context) {
  const targetPlatform = context?.electronPlatformName || process.platform;
  const targetArch = resolveArch(context?.arch);
  const appOutDir = context?.appOutDir;

  console.log(`\n📦 afterPack: ${targetPlatform}-${targetArch}\n`);

  // macOS: 解压 openclaw.zip
  if (targetPlatform === 'darwin' && appOutDir) {
    const appName = context.packager.appInfo.productFilename;
    extractOpenClaw(appOutDir, appName);
  }

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
