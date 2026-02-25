import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron';
import * as path from 'path';
import { OpenClawManager } from './openclaw-manager';
import { setupDatabase } from './database';
import { setupSecurity } from './security';
import { setupAudit } from './audit';
import { setupIpcHandlers } from './ipc-handlers';

export let mainWindow: BrowserWindow | null = null;
let openclawManager: OpenClawManager | null = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

async function createWindow() {
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
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  }

  // 窗口事件监听
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 设置菜单
  setupMenu();

  // 初始化数据库
  await setupDatabase();

  // 初始化审计系统
  setupAudit();

  // 启动OpenClaw服务
  openclawManager = new OpenClawManager();
  await openclawManager.start();

  // 设置IPC处理器
  setupIpcHandlers();
}

function setupMenu() {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: '文件',
      submenu: [
        { label: '新建对话', accelerator: 'CmdOrCtrl+N', click: () => {
          mainWindow?.webContents.send('new-conversation');
        }},
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(process.platform === 'darwin' ? [
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: '查找',
            accelerator: 'Command+F',
            click: () => {
              mainWindow?.webContents.send('toggle-search');
            }
          }
        ] : [
          { role: 'selectAll' },
          { type: 'separator' },
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
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
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
        { type: 'separator' },
        { role: 'about' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

function setupIpcHandlers() {
  // 处理退出请求
  ipcMain.handle('app-exit', async () => {
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

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 应用退出前清理
  openclawManager?.stop();
});