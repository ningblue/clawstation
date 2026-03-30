/**
 * Node.js 下载器 - 共享模块
 */

const NODE_VERSION = process.env.NODE_VERSION || '22.14.0';
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * 获取 Node.js 版本号
 */
function getNodeVersion() {
  return NODE_VERSION;
}

/**
 * 获取下载目录
 */
function getDownloadDir() {
  return path.join(__dirname, '..', '..', 'resources', 'node');
}

/**
 * 平台名称映射
 * - nodePlatform: Node.js 官方下载 URL 使用的平台名
 * - electronBuilderPlatform: electron-builder ${os} 变量使用的平台名
 */
function getPlatformNames(targetPlatform) {
  const normalized = targetPlatform === 'darwin' ? 'mac' :
                     targetPlatform === 'win32' ? 'win' :
                     targetPlatform;

  const electronBuilderPlatform = normalized;
  const nodePlatform = normalized === 'mac' ? 'darwin' : normalized;
  const ext = normalized === 'win' ? 'zip' : 'tar.gz';

  return { electronBuilderPlatform, nodePlatform, ext };
}

/**
 * 下载文件（支持重定向和备用 URL）
 */
function downloadFile(urls, dest) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  let currentIndex = 0;

  return new Promise((resolve, reject) => {
    const tryNext = () => {
      if (currentIndex >= urlList.length) {
        reject(new Error('All download URLs failed'));
        return;
      }

      const url = urlList[currentIndex++];
      console.log(`Downloading: ${url}`);

      // Clean up any partial file
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }

      const file = fs.createWriteStream(dest);

      const request = (targetUrl) => {
        https.get(targetUrl, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // Follow redirect to next URL
            const location = response.headers.location;
            if (location && !location.startsWith('http')) {
              // Relative redirect - reconstruct URL
              const base = new URL(targetUrl);
              request(new URL(location, base).href);
            } else {
              request(location);
            }
            return;
          }

          if (response.statusCode !== 200) {
            file.close();
            tryNext();
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', (err) => {
          fs.unlink(dest, () => {});
          tryNext();
        });
      };

      request(url);
    };

    tryNext();
  });
}

/**
 * 重命名解压后的目录为标准名称 'node'
 */
function renameToStandard(extractDir, nodePlatform, targetArch) {
  const extractedFolder = path.join(extractDir, `node-v${NODE_VERSION}-${nodePlatform}-${targetArch}`);
  const finalFolder = path.join(extractDir, 'node');

  if (fs.existsSync(finalFolder)) {
    fs.rmSync(finalFolder, { recursive: true, force: true });
  }

  if (!fs.existsSync(extractedFolder)) {
    // Windows zip 解压后可能没有子目录
    if (fs.existsSync(path.join(extractDir, 'node.exe'))) {
      // 已经是正确的结构
      return extractDir;
    }
    throw new Error(`Extracted folder not found: ${extractedFolder}`);
  }

  fs.renameSync(extractedFolder, finalFolder);
  return finalFolder;
}

/**
 * 验证 Node.js 二进制文件是否存在
 */
function verifyNodeBinary(finalFolder, platform) {
  const nodeBinary = platform === 'win'
    ? path.join(finalFolder, 'node.exe')
    : path.join(finalFolder, 'bin', 'node');

  if (fs.existsSync(nodeBinary)) {
    console.log(`\n✅ Node.js downloaded successfully: ${nodeBinary}\n`);
    return nodeBinary;
  } else {
    throw new Error(`Node binary not found at ${nodeBinary}`);
  }
}

module.exports = {
  NODE_VERSION,
  getNodeVersion,
  getDownloadDir,
  getPlatformNames,
  downloadFile,
  renameToStandard,
  verifyNodeBinary,
};
