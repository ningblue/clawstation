#!/usr/bin/env node
/**
 * 下载 Node.js 运行时，用于打包到应用中
 * 这样用户不需要安装 Node.js 就能运行 OpenClaw
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NODE_VERSION = '22.14.0';
const DOWNLOAD_DIR = path.join(__dirname, '..', 'resources', 'node');

// 获取平台信息
function getPlatformInfo() {
  const platform = process.platform;
  const arch = process.arch;
  
  let nodePlatform, nodeArch, ext;
  
  switch (platform) {
    case 'darwin':
      nodePlatform = 'darwin';
      break;
    case 'win32':
      nodePlatform = 'win';
      ext = 'zip';
      break;
    case 'linux':
      nodePlatform = 'linux';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
  
  switch (arch) {
    case 'x64':
      nodeArch = 'x64';
      break;
    case 'arm64':
      nodeArch = 'arm64';
      break;
    default:
      throw new Error(`Unsupported arch: ${arch}`);
  }
  
  return { platform: nodePlatform, arch: nodeArch, ext: ext || 'tar.gz' };
}

// 下载文件
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    
    const file = fs.createWriteStream(dest);
    
    const request = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // 跟随重定向
          request(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    
    request(url);
  });
}

// 解压文件
function extractFile(archivePath, destDir, ext) {
  console.log(`Extracting: ${archivePath}`);
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  if (ext === 'zip') {
    // Windows 使用 unzip 或 PowerShell
    if (process.platform === 'win32') {
      try {
        // 尝试使用 tar (Windows 10+ 自带)
        execSync(`tar -xf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
      } catch (e) {
        // 回退到 PowerShell
        execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
      }
    } else {
      execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
    }
  } else {
    // tar.gz
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  }
}

// 主函数
async function main() {
  const targetPlatform = process.argv[2] || process.platform;
  const targetArch = process.argv[3] || process.arch;
  
  console.log(`\n📦 Downloading Node.js ${NODE_VERSION} for ${targetPlatform}-${targetArch}\n`);
  
  // 确定下载 URL
  let nodePlatform = targetPlatform === 'win32' ? 'win' : targetPlatform;
  let ext = targetPlatform === 'win32' ? 'zip' : 'tar.gz';
  const filename = `node-v${NODE_VERSION}-${nodePlatform}-${targetArch}.${ext}`;
  
  // 使用国内镜像源 (华为云)
  const mirrorUrl = `https://mirrors.huaweicloud.com/nodejs/v${NODE_VERSION}/${filename}`;
  // 备用源 (npmmirror)
  // const mirrorUrl = `https://npmmirror.com/mirrors/node/v${NODE_VERSION}/${filename}`;
  
  const url = mirrorUrl;
  
  // 创建下载目录
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
  
  const archivePath = path.join(DOWNLOAD_DIR, filename);
  const extractDir = path.join(DOWNLOAD_DIR, `${targetPlatform}-${targetArch}`);
  
  // 下载
  await downloadFile(url, archivePath);
  
  // 解压
  extractFile(archivePath, extractDir, ext);
  
  // 重命名为标准名称
  const extractedFolder = path.join(extractDir, `node-v${NODE_VERSION}-${nodePlatform}-${targetArch}`);
  const finalFolder = path.join(DOWNLOAD_DIR, `${targetPlatform}-${targetArch}`, 'node');
  
  if (fs.existsSync(finalFolder)) {
    fs.rmSync(finalFolder, { recursive: true });
  }
  fs.renameSync(extractedFolder, finalFolder);
  
  // 删除压缩包
  fs.unlinkSync(archivePath);
  
  // 验证
  const nodeBinary = targetPlatform === 'win32' 
    ? path.join(finalFolder, 'node.exe')
    : path.join(finalFolder, 'bin', 'node');
  
  if (fs.existsSync(nodeBinary)) {
    console.log(`\n✅ Node.js downloaded successfully: ${nodeBinary}\n`);
  } else {
    throw new Error(`Node binary not found at ${nodeBinary}`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
