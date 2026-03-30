/**
 * Node.js 下载器 - macOS 平台
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const common = require('./common');

/**
 * 解压 tar.gz 文件
 */
function extract(archivePath, destDir) {
  console.log(`[macOS] Extracting: ${archivePath}`);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
}

/**
 * 下载 macOS 版本的 Node.js
 */
async function download(targetArch) {
  const downloadDir = common.getDownloadDir();

  // macOS 使用 tar.gz 格式
  const nodePlatform = 'darwin';
  const electronBuilderPlatform = 'mac';
  const ext = 'tar.gz';

  // 构建下载 URL（华为镜像优先，官方 CDN 回退）
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

  console.log(`\n📦 [macOS] Downloading Node.js ${common.NODE_VERSION} for ${electronBuilderPlatform}-${targetArch}\n`);

  // 下载
  await common.downloadFile(urls, archivePath);

  // 解压
  extract(archivePath, extractDir);

  // 重命名
  const finalFolder = common.renameToStandard(extractDir, nodePlatform, targetArch);

  // 删除压缩包
  fs.unlinkSync(archivePath);

  // 验证
  common.verifyNodeBinary(finalFolder, 'mac');

  return finalFolder;
}

module.exports = {
  download,
  extract,
};
