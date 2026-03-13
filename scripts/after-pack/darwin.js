/**
 * macOS 平台打包后处理
 * - 解压 openclaw.zip
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * 解压 openclaw.zip 到应用包
 */
function extractOpenClaw(appOutDir, appName) {
  const resourcesPath = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
  const zipPath = path.join(resourcesPath, 'openclaw.zip');
  const extractPath = path.join(resourcesPath, 'openclaw');

  if (!fs.existsSync(zipPath)) {
    console.warn('⚠️  [macOS] openclaw.zip not found:', zipPath);
    return false;
  }

  // 如果已存在 openclaw 目录，先删除
  if (fs.existsSync(extractPath)) {
    console.log('🗑️  [macOS] Removing existing openclaw directory...');
    fs.rmSync(extractPath, { recursive: true, force: true });
  }

  // 解压 zip 文件
  console.log('📦 [macOS] Extracting openclaw.zip...');
  try {
    execSync(`unzip -q "${zipPath}" -d "${extractPath}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('⚠️  [macOS] Failed to extract openclaw:', error.message);
    return false;
  }

  // 删除 zip 文件（节省空间）
  fs.unlinkSync(zipPath);

  console.log('✅ [macOS] openclaw extracted successfully');
  return true;
}

/**
 * macOS 平台处理入口
 */
function processMac(context) {
  const appOutDir = context?.appOutDir;
  const appName = context?.packager?.appInfo?.productFilename;

  if (!appOutDir || !appName) {
    console.warn('⚠️  [macOS] Missing appOutDir or appName');
    return;
  }

  console.log('\n🍎 Processing macOS package...\n');

  // 解压 openclaw.zip
  extractOpenClaw(appOutDir, appName);

  console.log('✅ [macOS] afterPack completed\n');
}

module.exports = {
  processMac,
  extractOpenClaw,
};
