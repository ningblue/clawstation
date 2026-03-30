#!/usr/bin/env node
/**
 * 开发环境统一设置脚本
 * 下载预编译的 OpenClaw 和 Node.js 运行时
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
  openclaw: {
    version: '2026.3.8',
    repo: 'xclaw/openclaw',
    platforms: {
      win32: { arch: 'x64', ext: '7z' },
      darwin: { arch: process.arch === 'arm64' ? 'arm64' : 'x64', ext: '7z' },
      linux: { arch: 'x64', ext: '7z' }
    }
  },
  node: {
    version: '22.22.2',
    platforms: {
      win32: { arch: 'x64', ext: 'zip' },
      darwin: { arch: 'arm64', ext: 'tar.gz' },
      linux: { arch: 'x64', ext: 'tar.gz' }
    }
  }
};

// 路径
const ROOT_DIR = path.join(__dirname, '..');
const RESOURCES_DIR = path.join(ROOT_DIR, 'resources');
const CACHE_DIR = path.join(ROOT_DIR, '.cache');

// 工具函数
function log(message) {
  console.log(`[setup] ${message}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getPlatform() {
  const platform = process.platform;
  if (platform === 'win32') return 'win32';
  if (platform === 'darwin') return 'darwin';
  if (platform === 'linux') return 'linux';
  throw new Error(`Unsupported platform: ${platform}`);
}

// 下载文件（支持多个 URL 回退）
async function downloadFile(urls, dest) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  
  return new Promise((resolve, reject) => {
    let currentIndex = 0;
    
    const tryNext = () => {
      if (currentIndex >= urlList.length) {
        reject(new Error('All download URLs failed'));
        return;
      }
      
      const url = urlList[currentIndex++];
      console.log(`[setup] Trying: ${url}`);
      
      // 清理部分文件
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      
      const file = fs.createWriteStream(dest);
      
      const request = (targetUrl) => {
        https.get(targetUrl, { timeout: 60000 }, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // 重定向
            const location = response.headers.location;
            if (location && !location.startsWith('http')) {
              // 相对重定向 - 重建 URL
              const base = new URL(targetUrl);
              request(new URL(location, base).href);
            } else {
              request(location);
            }
            return;
          }
          
          if (response.statusCode !== 200) {
            file.close();
            console.log(`[setup] Failed with status ${response.statusCode}`);
            tryNext();
            return;
          }
          
          response.pipe(file);
          
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', (err) => {
          console.log(`[setup] Download error: ${err.message}`);
          fs.unlink(dest, () => {});
          tryNext();
        });
      };
      
      request(url);
    };
    
    tryNext();
  });
}

// 设置 OpenClaw
async function setupOpenClaw() {
  log('Setting up OpenClaw...');

  const platform = getPlatform();
  const config = CONFIG.openclaw.platforms[platform];
  const openclawDir = path.join(RESOURCES_DIR, 'openclaw');

  // 检查是否已存在
  if (fs.existsSync(openclawDir)) {
    log('OpenClaw already exists, checking version...');
    // 可以添加版本检查逻辑
    return;
  }

  // 确保目录存在
  ensureDir(openclawDir);
  ensureDir(CACHE_DIR);

  // 下载地址（使用 GitHub Releases）
  const filename = `openclaw-v${CONFIG.openclaw.version}-${platform}-${config.arch}.${config.ext}`;
  const cachePath = path.join(CACHE_DIR, filename);
  const downloadUrl = `https://github.com/${CONFIG.openclaw.repo}/releases/download/v${CONFIG.openclaw.version}/${filename}`;

  // 检查缓存
  if (fs.existsSync(cachePath)) {
    log(`Using cached ${filename}`);
  } else {
    log(`Downloading ${filename}...`);
    try {
      await downloadFile(downloadUrl, cachePath);
      log('Download complete');
    } catch (error) {
      log(`Download failed: ${error.message}`);
      log('Falling back to local build...');
      // 如果下载失败，使用本地编译
      await setupOpenClawFromLocal();
      return;
    }
  }

  // 解压
  log('Extracting OpenClaw...');
  if (platform === 'win32') {
    const sevenZip = path.join(ROOT_DIR, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
    execSync(`"${sevenZip}" x "${cachePath}" -o"${openclawDir}" -y`);
  } else {
    // macOS/Linux
    ensureDir(openclawDir);
    execSync(`tar -xzf "${cachePath}" -C "${openclawDir}" --strip-components=1`);
  }

  log('OpenClaw setup complete');
}

// 从本地源码编译（fallback）
async function setupOpenClawFromLocal() {
  log('Building OpenClaw from local source...');
  const libOpenClaw = path.join(ROOT_DIR, 'lib', 'openclaw');

  if (!fs.existsSync(libOpenClaw)) {
    throw new Error('Local OpenClaw source not found');
  }

  // 运行原有的构建脚本
  execSync('npm run build:openclaw', { cwd: ROOT_DIR, stdio: 'inherit' });
}

// 设置 Node.js
async function setupNode() {
  log('Setting up Node.js runtime...');

  const platform = getPlatform();
  const config = CONFIG.node.platforms[platform];
  const nodeDir = path.join(RESOURCES_DIR, 'node');

  // 检查是否已存在（使用 electron-builder 期望的目录名）
  const platformKey = platform === 'darwin' ? 'mac' : platform;
  const platformNodeDir = path.join(nodeDir, `${platformKey}-${config.arch}`);
  if (fs.existsSync(platformNodeDir)) {
    log('Node.js already exists');
    return;
  }

  // 确保目录存在
  ensureDir(nodeDir);
  ensureDir(CACHE_DIR);

  // 下载地址（华为镜像优先，官方 CDN 回退）
  const filename = `node-v${CONFIG.node.version}-${platform}-${config.arch}.${config.ext}`;
  const cachePath = path.join(CACHE_DIR, filename);
  const mirrorUrl = `https://mirrors.huaweicloud.com/nodejs/v${CONFIG.node.version}/${filename}`;
  const officialUrl = `https://nodejs.org/dist/v${CONFIG.node.version}/${filename}`;
  const downloadUrls = [mirrorUrl, officialUrl];

  // 检查缓存
  if (fs.existsSync(cachePath)) {
    log(`Using cached ${filename}`);
  } else {
    log(`Downloading Node.js ${CONFIG.node.version}...`);
    await downloadFile(downloadUrls, cachePath);
    log('Download complete');
  }

  // 解压
  log('Extracting Node.js...');
  ensureDir(platformNodeDir);

  if (platform === 'win32') {
    // Windows: 使用 7za 或 PowerShell
    try {
      const sevenZip = path.join(ROOT_DIR, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
      if (fs.existsSync(sevenZip)) {
        execSync(`"${sevenZip}" x "${cachePath}" -o"${platformNodeDir}" -y`);
      } else {
        // 使用 PowerShell
        execSync(`powershell -Command "Expand-Archive -Path '${cachePath}' -DestinationPath '${platformNodeDir}' -Force"`);
      }
    } catch (error) {
      // 手动解压
      log('Using unzip fallback...');
      try {
        execSync(`unzip -o "${cachePath}" -d "${platformNodeDir}"`);
      } catch (e) {
        log('Please manually extract the zip file');
        throw error;
      }
    }

    // 移动文件（Windows 解压后有多层目录）
    const extractedDir = path.join(platformNodeDir, `node-v${CONFIG.node.version}-${platform}-${config.arch}`);
    if (fs.existsSync(extractedDir)) {
      const files = fs.readdirSync(extractedDir);
      for (const file of files) {
        fs.renameSync(path.join(extractedDir, file), path.join(platformNodeDir, file));
      }
      fs.rmdirSync(extractedDir);
    }
  } else {
    // macOS/Linux
    execSync(`tar -xzf "${cachePath}" -C "${platformNodeDir}" --strip-components=1`);
  }

  log('Node.js setup complete');
}

// 主函数
async function main() {
  log('Clawstation Development Environment Setup');
  log('=========================================');

  try {
    // 确保资源目录存在
    ensureDir(RESOURCES_DIR);

    // 设置 OpenClaw
    await setupOpenClaw();

    // 设置 Node.js
    await setupNode();

    log('');
    log('✅ Setup complete! You can now run:');
    log('   npm run dev');
    log('');
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// 运行
main();
