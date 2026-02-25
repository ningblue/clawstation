// ClawStation 主入口文件
// 这是 ClasStation 桌面应用的主文件，负责初始化应用程序的核心功能
// 该应用作为一个独立的 Electron 应用程序，集成了 OpenClaw AI 引擎

import { app, BrowserWindow } from 'electron';
import * as path from 'path';

// 功能模块导入
import { OpenClawManager } from './main/openclaw-manager';
import { setupDatabase } from './main/database';
import { setupSecurity } from './main/security';
import { setupAudit } from './main/audit';
import { setupIpcHandlers } from './main/ipc-handlers';

// 主窗口引用
export let mainWindow: BrowserWindow | null = null;
let openclawManager: OpenClawManager | null = null;

/**
 * 创建应用程序主窗口
 */
async function createMainWindow() {
  // 设置安全策略
  setupSecurity();

  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../resources/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
    frame: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
  });

  // 加载应用主页面
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    // 开发模式下，可能需要连接到webpack dev server
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 窗口事件监听
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 初始化应用程序
 */
async function initializeApp() {
  // 检查是否只有一个实例运行
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  // 初始化数据库
  await setupDatabase();

  // 初始化审计系统
  setupAudit();

  // 启动OpenClaw服务
  openclawManager = new OpenClawManager();
  await openclawManager.start();

  // 设置IPC处理器
  setupIpcHandlers();

  // 创建主窗口
  await createMainWindow();

  // 应用激活时的处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

/**
 * 应用程序就绪后初始化
 */
app.whenReady().then(initializeApp);

/**
 * 窗口全部关闭时的处理
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 应用退出前的清理工作
 */
app.on('before-quit', () => {
  // 停止OpenClaw服务
  openclawManager?.stop();
});

export { mainWindow, openclawManager };