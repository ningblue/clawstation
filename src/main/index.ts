import { app, BrowserWindow, ipcMain, Menu, shell, dialog, Tray, nativeImage } from 'electron';
import { exec } from 'child_process';

// 设置应用名称（进程名会显示为 clawstation）
app.setName('clawstation');

// 扩展App类型以支持isQuitting属性
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}
import * as path from 'path';
import { OpenClawManager } from '../backend/services/openclaw.service';
import { initializeDatabase } from '../data/database';
import { setupSecurity } from './security';
import { setupAudit } from './audit';
import { initializeApiHandlers } from '../api/handlers';

export let mainWindow: BrowserWindow | null = null;
export let openclawManager: OpenClawManager | null = null;
let tray: Tray | null = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

async function createWindow() {
  // 设置安全策略
  setupSecurity();

  // 初始化数据库
  await initializeDatabase();

  // 初始化审计系统
  setupAudit();

  // 注册应用级IPC处理器
  setupIpcHandlers();

  // 先注册基础的API处理器（用户、会话、消息、审计）
  // 必须在窗口加载之前注册，否则前端调用会失败
  initializeApiHandlers();

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
    show: false, // 先隐藏窗口，等待加载完成后再显示
  });

  // 设置菜单
  setupMenu();

  // 初始化OpenClaw管理器（不自动启动，由用户手动控制）
  openclawManager = new OpenClawManager();

  // 注册OpenClaw相关路由
  // 这样当窗口加载完成时，所有IPC处理器都已就绪
  console.log('Registering OpenClaw routes...');
  initializeApiHandlers(openclawManager);
  console.log('OpenClaw routes registered');

  // 创建系统托盘
  createTray();

  // 自动启动AI引擎（后台运行，不阻塞窗口显示）
  console.log('Starting AI engine in background...');
  openclawManager.start()
    .then(() => {
      console.log('AI engine started successfully');
      broadcastEngineStatus();
    })
    .catch((err) => {
      console.error('Failed to start AI engine:', err);
    });

  // 加载应用主页面
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 窗口显示后再打开开发者工具
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (!app.isPackaged) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // 窗口关闭时最小化到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // 窗口事件监听
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 当窗口加载完成后，发送OpenClaw状态事件
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('Window finished loading, sending openclaw:ready event');
    if (openclawManager && mainWindow) {
      mainWindow.webContents.send('openclaw:ready', {
        isRunning: openclawManager.isRunning(),
        port: openclawManager.getConfig().port,
      });
    }
  });
}

function setupMenu() {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: '文件',
      submenu: [
        { label: '新建对话', accelerator: 'CmdOrCtrl+N', click: () => {
          mainWindow?.webContents.send('new-conversation');
        }},
        { type: 'separator' as const },
        { role: 'close' as const }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(process.platform === 'darwin' ? [
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: '查找',
            accelerator: 'Command+F',
            click: () => {
              mainWindow?.webContents.send('toggle-search');
            }
          }
        ] : [
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: '查找',
            accelerator: 'Ctrl+F',
            click: () => {
              mainWindow?.webContents.send('toggle-search');
            }
          }
        ])
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' as const },
          { role: 'front' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '文档',
          click: async () => {
            await shell.openExternal('https://docs.clawstation.ai');
          }
        },
        {
          label: '反馈问题',
          click: async () => {
            await shell.openExternal('https://github.com/clawstation/clawstation/issues');
          }
        },
        { type: 'separator' as const },
        { role: 'about' as const }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

/**
 * 初始化基础的API处理器（用户、会话、消息、审计）
 * 必须在窗口加载之前调用
 */
function initializeBasicApiHandlers(): void {
  console.log('Initializing basic API handlers...');
  const { setupUserRoutes } = require('../api/routes/user.route');
  const { setupConversationRoutes } = require('../api/routes/conversation.route');
  const { setupMessageRoutes } = require('../api/routes/message.route');
  const { setupAuditRoutes } = require('../api/routes/audit.route');

  setupUserRoutes();
  setupConversationRoutes();
  setupMessageRoutes();
  setupAuditRoutes();
  console.log('Basic API handlers initialized');
}

/**
 * 初始化OpenClaw相关的API处理器
 * 需要在OpenClaw启动后调用
 */
function initializeOpenClawApiHandlers(openclawManager: any): void {
  console.log('Initializing OpenClaw API handlers...');
  const { setupOpenClawRoutes } = require('../api/routes/openclaw.route');
  const { setupOpenClawMonitorRoutes } = require('../api/routes/openclaw-monitor.route');

  setupOpenClawRoutes(openclawManager);
  setupOpenClawMonitorRoutes(openclawManager);
  console.log('OpenClaw API handlers initialized');
}

function setupIpcHandlers() {
  // 处理退出请求
  ipcMain.handle('app-exit', async () => {
    app.isQuitting = true;
    // 先停止内部引擎
    openclawManager?.stop();
    // 强制关闭端口 18791 上的进程
    await killProcessOnPort(18791);
    // 然后退出应用
    app.quit();
  });

  // 处理重启请求
  ipcMain.handle('app-restart', async () => {
    app.relaunch();
    app.exit(0);
  });

  // 获取应用信息
  ipcMain.handle('get-app-info', async () => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
    };
  });

  // 打开外部链接
  ipcMain.handle('open-external-url', async (_, url: string) => {
    await shell.openExternal(url);
  });

  // 显示错误对话框
  ipcMain.handle('show-error-dialog', async (_, options: { title: string; message: string }) => {
    await dialog.showErrorBox(options.title, options.message);
  });
}

let isInitializing = false;

/**
 * 广播引擎状态到所有窗口
 */
function broadcastEngineStatus() {
  if (mainWindow && openclawManager) {
    const status = openclawManager.isRunning();
    mainWindow.webContents.send('openclaw:status-changed', {
      isRunning: status,
      port: openclawManager.getConfig().port,
    });
    // 更新托盘菜单状态
    updateTrayMenu();
  }
}

/**
 * 创建系统托盘
 */
function createTray() {
  try {
    // 创建托盘图标
    let trayIcon: Electron.NativeImage;

    // 尝试加载资源目录中的图标
    let iconPath: string;

    if (app.isPackaged) {
      // 生产环境：从 extraResources 中获取
      // 图标在 /Applications/ClawStation.app/Contents/Resources/resources/icon.png
      iconPath = path.join(process.resourcesPath, 'resources/icon.png');

      // 备用方案
      if (!require('fs').existsSync(iconPath)) {
        iconPath = '/Applications/ClawStation.app/Contents/Resources/resources/icon.png';
      }
    } else {
      // 开发环境
      iconPath = path.join(__dirname, '../../resources/icon.png');
    }

    console.log('[Tray] Looking for icon at:', iconPath);

    if (require('fs').existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
      if (process.platform === 'darwin') {
        trayIcon.setTemplateImage(true);
      }
      console.log('[Tray] Icon loaded successfully');
    } else {
      console.log('[Tray] Icon not found, using empty icon');
      // 创建一个简单的彩色图标作为 fallback
      trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('ClawStation - AI数字员工');

    // 构建托盘菜单
    updateTrayMenu();

    // 点击托盘图标显示/隐藏窗口
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

/**
 * 更新托盘菜单
 */
function updateTrayMenu() {
  if (!tray) return;

  const isEngineRunning = openclawManager?.isRunning() || false;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主页面',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: isEngineRunning ? '🔴 AI引擎运行中' : '⚪ AI引擎已停止',
      enabled: false
    },
    {
      label: '重启AI引擎',
      click: async () => {
        if (openclawManager) {
          try {
            await openclawManager.restart();
            broadcastEngineStatus();
          } catch (error) {
            console.error('Failed to restart engine from tray:', error);
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        // 停止内部引擎
        openclawManager?.stop();
        // 设置退出标志后立即退出，before-quit 事件会处理端口清理
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(async () => {
  if (isInitializing) return;
  isInitializing = true;
  await createWindow();

  app.on('activate', () => {
    // 如果窗口已关闭或隐藏，重新显示窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      recreateWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

// 仅用于 activate 事件重新创建窗口（不重新启动 OpenClaw）
async function recreateWindow() {
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
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (!app.isPackaged) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // 窗口关闭时最小化到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupMenu();
}

app.on('window-all-closed', () => {
  // 保持后台运行，不自动退出
  // 应用会保持托盘图标运行
});

/**
 * 强制关闭指定端口上的进程
 */
function killProcessOnPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    // 使用 lsof 查找占用端口的进程
    exec(`lsof -t -i:${port}`, (error, stdout) => {
      if (error || !stdout.trim()) {
        // 没有进程占用端口
        resolve();
        return;
      }

      // 获取 PID 列表
      const pids = stdout.trim().split('\n').filter(Boolean);

      // 终止每个进程
      let completed = 0;
      if (pids.length === 0) {
        resolve();
        return;
      }

      pids.forEach((pid) => {
        exec(`kill -9 ${pid}`, (killErr) => {
          completed++;
          if (completed === pids.length) {
            console.log(`[ClawStation] Killed processes on port ${port}: ${pids.join(', ')}`);
            resolve();
          }
        });
      });
    });
  });
}

app.on('before-quit', async (event) => {
  // 设置退出标志，让窗口可以正常关闭
  app.isQuitting = true;

  // 先停止内部引擎
  openclawManager?.stop();

  // 强制关闭端口 18791 上的进程（外部引擎）
  await killProcessOnPort(18791);
});