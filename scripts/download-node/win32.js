/**
 * Node.js 下载器 - Windows 平台
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const common = require('./common');

/**
 * 解压 zip 文件（Windows）
 */
function extract(archivePath, destDir) {
  console.log(`[Windows] Extracting: ${archivePath}`);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    // 优先使用 tar (Windows 10+ 自带)
    execSync(`tar -xf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  } catch (e) {
    // 回退到 PowerShell
    console.log('[Windows] tar failed, using PowerShell...');
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: 'inherit' }
    );
  }
}

/**
 * 下载 Windows 版本的 Node.js
 */
async function download(targetArch) {
  const downloadDir = common.getDownloadDir();

  // Windows 使用 zip 格式
  const nodePlatform = 'win';
  const electronBuilderPlatform = 'win';
  const ext = 'zip';

  // 构建下载 URL（华为镜像优先，官方 CDN 回退）
  // 平台名称映射：Node.js 官方下载使用 'win' 而不是 'win32'
  const nodePlatform = platform === 'win32' ? 'win' : platform === 'darwin' ? 'darwin' : platform;
  const filename = `node-v${common.NODE_VERSION}-${nodePlatform}-${targetArch}.${ext}`;
  const mirrorUrl = `https://mirrors.huaweicloud.com/nodejs/v${common.NODE_VERSION}/${filename}`;
  const officialUrl = `https://nodejs.org/dist/v${common.NODE_VERSION}/${filename}`;
  const urls = [mirrorUrl, officialUrl];

  // 确保目录存在
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const archivePath = path.join(downloadDir, filename);
  const extractDir = path.join(downloadDir, `${electronBuilderPlatform}-${targetArch}`);

  console.log(`\n📦 [Windows] Downloading Node.js ${common.NODE_VERSION} for ${electronBuilderPlatform}-${targetArch}\n`);

  // 下载
  await common.downloadFile(urls, archivePath);

  // 解压
  extract(archivePath, extractDir);

  // 重命名
  const finalFolder = common.renameToStandard(extractDir, nodePlatform, targetArch);

  // 删除压缩包
  fs.unlinkSync(archivePath);

  // 验证
  common.verifyNodeBinary(finalFolder, 'win');

  return finalFolder;
}

module.exports = {
  download,
  extract,
};
