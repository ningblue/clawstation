/**
 * macOS 平台打包后处理
 * - 解压对应架构的 openclaw
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { resolveArch } = require('./common');

/**
 * 解压 openclaw.7z 到应用包
 * @param {string} appOutDir - 应用输出目录
 * @param {string} appName - 应用名称
 * @param {string} targetArch - 目标架构
 */
function extractOpenClaw(appOutDir, appName, targetArch) {
  const resourcesPath = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
  const archivePath = path.join(resourcesPath, `openclaw-${targetArch}.7z`);
  const extractPath = path.join(resourcesPath, 'openclaw');

  if (!fs.existsSync(archivePath)) {
    console.warn('⚠️  [macOS] openclaw archive not found:', archivePath);
    return false;
  }

  // 如果已存在 openclaw 目录，先删除
  if (fs.existsSync(extractPath)) {
    console.log('🗑️  [macOS] Removing existing openclaw directory...');
    fs.rmSync(extractPath, { recursive: true, force: true });
  }

  // 确保目标目录存在
  if (!fs.existsSync(extractPath)) {
    fs.mkdirSync(extractPath, { recursive: true });
  }

  // 解压 7z 文件
  console.log(`📦 [macOS] Extracting openclaw-${targetArch}.7z...`);
  try {
    // 尝试使用 7z 命令
    execSync(`7z x "${archivePath}" -o"${extractPath}" -y`, { stdio: 'inherit' });
  } catch (error) {
    // 备用：尝试使用系统 unzip（如果用户安装了 p7zip）
    console.log('📦 [macOS] 7z not found, trying p7zip-unzip...');
    try {
      execSync(`7za x "${archivePath}" -o"${extractPath}" -y`, { stdio: 'inherit' });
    } catch (error2) {
      console.error('⚠️  [macOS] Failed to extract openclaw:', error2.message);
      return false;
    }
  }

  // 删除 7z 文件（节省空间）
  fs.unlinkSync(archivePath);

  // 处理嵌套目录问题（7z 可能解压出 openclaw/openclaw/）
  const nestedPath = path.join(extractPath, 'openclaw');
  if (fs.existsSync(nestedPath) && fs.statSync(nestedPath).isDirectory()) {
    console.log('📦 [macOS] Fixing nested directory structure...');
    // 将嵌套目录的内容移动到外层
    const files = fs.readdirSync(nestedPath);
    for (const file of files) {
      const src = path.join(nestedPath, file);
      const dest = path.join(extractPath, file);
      fs.renameSync(src, dest);
    }
    fs.rmdirSync(nestedPath);
  }

  console.log('✅ [macOS] openclaw extracted successfully');
  return true;
}

/**
 * macOS 平台处理入口
 */
function processMac(context) {
  const appOutDir = context?.appOutDir;
  const appName = context?.packager?.appInfo?.productFilename;
  const targetArch = resolveArch(context?.arch);

  if (!appOutDir || !appName) {
    console.warn('⚠️  [macOS] Missing appOutDir or appName');
    return;
  }

  console.log(`\n🍎 Processing macOS package (${targetArch})...\n`);

  // 解压对应架构的 openclaw
  extractOpenClaw(appOutDir, appName, targetArch);

  console.log('✅ [macOS] afterPack completed\n');
}

module.exports = {
  processMac,
  extractOpenClaw,
};
