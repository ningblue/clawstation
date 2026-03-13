import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  dialog,
  Tray,
  nativeImage,
} from "electron";
import { exec } from "child_process";
import log from "electron-log";

// Admin Platform SDK
// import { ClawstationAdminSDK } from "@clawstation/admin-sdk";

// 配置日志
log.transports.file.level = "info";
log.transports.console.level = "info";
console.log = log.log;
console.error = log.error;
console.info = log.info;
console.warn = log.warn;

// 设置应用名称（进程名会显示为 clawstation）
app.setName("clawstation");

// 扩展App类型以支持isQuitting属性
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}
import * as path from "path";
import { OpenClawManager } from "../backend/services/openclaw.service";
import { OPENCLAW_PORT, OPENCLAW_PROCESS_NAME } from "../shared/constants";
import { getProcessManager } from "./process-manager";
import { initializeDatabase } from "../data/database";
import { setupSecurity } from "./security";
import { setupAudit } from "./audit";
import { initializeApiHandlers } from "../api/handlers";

export let mainWindow: BrowserWindow | null = null;
export let openclawManager: OpenClawManager | null = null;
let tray: Tray | null = null;

// Admin Platform SDK
// let adminSDK: ClawstationAdminSDK | null = null;

let latestEngineStatus: {
  isRunning: boolean;
  isHealthy: boolean;
  error?: string;
} = {
  isRunning: false,
  isHealthy: false,
};

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

async function createWindow() {
  try {
    // 设置安全策略
    setupSecurity();

    // 初始化数据库
    try {
      await initializeDatabase();
    } catch (dbError) {
      log.error("Failed to initialize database:", dbError);
      dialog.showErrorBox(
        "Database Error",
        "Failed to initialize database. The application may not function correctly.\n" +
          String(dbError),
      );
    }

    // 初始化审计系统
    setupAudit();

    // 初始化 Admin Platform SDK（非阻塞）
    // initializeAdminSDK().catch((err) => {
    //   log.error("Failed to initialize Admin SDK:", err);
    // });

    // 注册应用级IPC处理器
    setupIpcHandlers();

    // 先注册基础的API处理器（用户、会话、消息、审计）
    // 必须在窗口加载之前注册，否则前端调用会失败
    initializeApiHandlers();

    // 创建浏览器窗口
    const isMac = process.platform === "darwin";
    mainWindow = new BrowserWindow({
      height: 800,
      width: 1200,
      minWidth: 800,
      minHeight: 600,
      icon: path.join(__dirname, "../resources/icon.png"),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "../preload/index.js"),
      },
      frame: false,
      titleBarStyle: "hidden",
      ...(isMac && { trafficLightPosition: { x: 15, y: 15 } }),
      show: false, // 先隐藏窗口，等待加载完成后再显示
    });

    // 设置菜单
    setupMenu();

    // 初始化OpenClaw管理器（不自动启动，由用户手动控制）
    openclawManager = new OpenClawManager();
    attachOpenClawEventHandlers();

    // 注册OpenClaw相关路由

    // 这样当窗口加载完成时，所有IPC处理器都已就绪
    console.log("Registering OpenClaw routes...");
    initializeApiHandlers(openclawManager);
    console.log("OpenClaw routes registered");

    // 创建系统托盘
    createTray();

    // 自动启动AI引擎（后台运行，不阻塞窗口显示）
    console.log("Starting AI engine in background...");
    openclawManager
      .start()
      .then(() => {
        console.log("AI engine started successfully");
        broadcastEngineStatus();
      })
      .catch((err) => {
        console.error("Failed to start AI engine:", err);
        broadcastEngineStatus();
        // 在生产环境显示错误弹窗，帮助用户诊断问题
        if (app.isPackaged) {
          const logPath = log.transports.file.getFile().path;
          dialog.showErrorBox(
            "AI Engine Startup Error",
            `Failed to start AI engine.\n\nError: ${err.message}\n\nPlease check the log file for more details:\n${logPath}`,
          );
        }
      });

    // 加载应用主页面
    const entryUrl = path.join(__dirname, "../renderer/index.html");
    console.log("Loading entry URL:", entryUrl);
    mainWindow.loadFile(entryUrl).catch((e) => {
      console.error("Failed to load entry URL:", e);
    });

    // 窗口显示后再打开开发者工具
    mainWindow.once("ready-to-show", () => {
      console.log("Window ready to show");
      mainWindow?.show();
      if (!app.isPackaged) {
        mainWindow?.webContents.openDevTools();
      }
    });

    // Failsafe: Show window after 5 seconds if ready-to-show didn't fire
    setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) {
        console.warn("Window ready-to-show timed out, forcing show");
        mainWindow.show();
        // 在生产环境遇到白屏时，打开 DevTools 有助于调试
        // mainWindow.webContents.openDevTools();
      }
    }, 5000);

    // 窗口关闭时最小化到托盘而不是退出
    mainWindow.on("close", (event) => {
      if (!app.isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });

    // 窗口事件监听
    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    // 处理外部链接点击 - 在系统浏览器中打开
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      // 在系统默认浏览器中打开外部链接
      shell.openExternal(url);
      return { action: "deny" }; // 阻止在应用内打开
    });

    // 拦截导航事件，防止在应用内跳转到外部链接
    mainWindow.webContents.on("will-navigate", (event, url) => {
      // 检查是否是外部链接（非本地文件）
      if (!url.startsWith("file://")) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    // 当窗口加载完成后，发送OpenClaw状态事件
    mainWindow.webContents.once("did-finish-load", async () => {
      console.log("Window finished loading, sending openclaw:ready event");
      if (openclawManager && mainWindow) {
        await broadcastEngineStatus();
        mainWindow.webContents.send("openclaw:ready", {
          isRunning: latestEngineStatus.isRunning,
          isHealthy: latestEngineStatus.isHealthy,
          error: latestEngineStatus.error,
          port: openclawManager.getConfig().port,
        });
      }
    });
  } catch (err) {
    log.error("Fatal error during window creation:", err);
    dialog.showErrorBox(
      "Startup Error",
      "A fatal error occurred during startup.\n" + String(err),
    );
  }
}

function setupMenu() {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "文件",
      submenu: [
        {
          label: "新建对话",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow?.webContents.send("new-conversation");
          },
        },
        { type: "separator" as const },
        { role: "close" as const },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        ...(process.platform === "darwin"
          ? [
              { role: "selectAll" as const },
              { type: "separator" as const },
              {
                label: "查找",
                accelerator: "Command+F",
                click: () => {
                  mainWindow?.webContents.send("toggle-search");
                },
              },
            ]
          : [
              { role: "selectAll" as const },
              { type: "separator" as const },
              {
                label: "查找",
                accelerator: "Ctrl+F",
                click: () => {
                  mainWindow?.webContents.send("toggle-search");
                },
              },
            ]),
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload" as const },
        { role: "forceReload" as const },
        { role: "toggleDevTools" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(process.platform === "darwin"
          ? [{ type: "separator" as const }, { role: "front" as const }]
          : [{ role: "close" as const }]),
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "文档",
          click: async () => {
            await shell.openExternal("https://docs.clawstation.ai");
          },
        },
        {
          label: "反馈问题",
          click: async () => {
            await shell.openExternal(
              "https://github.com/clawstation/clawstation/issues",
            );
          },
        },
        { type: "separator" as const },
        { role: "about" as const },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

/**
 * 初始化基础的API处理器（用户、会话、消息、审计）
 * 必须在窗口加载之前调用
 */
function initializeBasicApiHandlers(): void {
  console.log("Initializing basic API handlers...");
  const { setupUserRoutes } = require("../api/routes/user.route");
  const {
    setupConversationRoutes,
  } = require("../api/routes/conversation.route");
  const { setupMessageRoutes } = require("../api/routes/message.route");
  const { setupAuditRoutes } = require("../api/routes/audit.route");

  setupUserRoutes();
  setupConversationRoutes();
  setupMessageRoutes();
  setupAuditRoutes();
  console.log("Basic API handlers initialized");
}

/**
 * 初始化OpenClaw相关的API处理器
 * 需要在OpenClaw启动后调用
 */
function initializeOpenClawApiHandlers(openclawManager: any): void {
  console.log("Initializing OpenClaw API handlers...");
  const { setupOpenClawRoutes } = require("../api/routes/openclaw.route");
  const {
    setupOpenClawMonitorRoutes,
  } = require("../api/routes/openclaw-monitor.route");

  setupOpenClawRoutes(openclawManager);
  setupOpenClawMonitorRoutes(openclawManager);
  console.log("OpenClaw API handlers initialized");
}

function setupIpcHandlers() {
  // 处理退出请求
  ipcMain.handle("app-exit", async () => {
    app.isQuitting = true;
    // 使用 ProcessManager 优雅地停止引擎并清理所有相关进程
    if (openclawManager) {
      await openclawManager.stop();
    }
    // 然后退出应用
    app.quit();
  });

  // 处理重启请求
  ipcMain.handle("app-restart", async () => {
    app.relaunch();
    app.exit(0);
  });

  // 获取应用信息
  ipcMain.handle("get-app-info", async () => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
    };
  });

  // 打开外部链接
  ipcMain.handle("open-external-url", async (_, url: string) => {
    await shell.openExternal(url);
  });

  // 显示错误对话框
  ipcMain.handle(
    "show-error-dialog",
    async (_, options: { title: string; message: string }) => {
      await dialog.showErrorBox(options.title, options.message);
    },
  );

  // 显示确认对话框
  ipcMain.handle(
    "show-confirm-dialog",
    async (
      _,
      options: {
        title: string;
        message: string;
        buttons?: string[];
        defaultId?: number;
        cancelId?: number;
      },
    ) => {
      const result = await dialog.showMessageBox({
        type: "question",
        title: options.title,
        message: options.title,
        detail: options.message,
        buttons: options.buttons || ["确认", "取消"],
        defaultId: options.defaultId ?? 0,
        cancelId: options.cancelId ?? 1,
      });
      return result.response;
    },
  );

  // 窗口控制 IPC 处理
  ipcMain.handle("window:minimize", () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle("window:maximize", () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        return false;
      } else {
        mainWindow.maximize();
        return true;
      }
    }
    return false;
  });

  ipcMain.handle("window:close", () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  ipcMain.handle("window:isMaximized", () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // 屏幕截图
  ipcMain.handle("window:capture", async () => {
    if (mainWindow) {
      try {
        const image = await mainWindow.capturePage();
        return image.toDataURL();
      } catch (e) {
        console.error("Failed to capture screen:", e);
        return null;
      }
    }
    return null;
  });
}

let isInitializing = false;

/**
 * 初始化 Admin Platform SDK
 */
// async function initializeAdminSDK(): Promise<void> {
//   try {
//     log.info("[AdminSDK] Initializing...");

//     // 创建 SDK 实例（配置从环境变量或配置文件加载）
//     // adminSDK = new ClawstationAdminSDK({
//     //   appVersion: app.getVersion(),
//     //   autoRegister: true,
//     //   autoHeartbeat: true,
//     //   debug: !app.isPackaged, // 开发模式启用调试
//     // });

//     // 初始化 SDK
//     // await adminSDK.init();

//     // log.info("[AdminSDK] Initialized successfully");
//     // log.info("[AdminSDK] Device ID:", await adminSDK.getDeviceId());

//     // 开始会话追踪
//     // adminSDK.startSession();

//     // 检查更新
//     // const updateInfo = await adminSDK.checkUpdate();
//     // if (updateInfo && typeof updateInfo === 'object') {
//     //   const info = updateInfo as {has_update?: boolean; latest_version?: {version: string}};
//     //   if (info.has_update && info.latest_version) {
//     //     log.info("[AdminSDK] Update available:", info.latest_version.version);
//     //     // 可以在这里触发更新提示
//     //   }
//     // }
//   } catch (error) {
//     log.error("[AdminSDK] Initialization failed:", error);
//     // SDK 初始化失败不应影响应用启动
//     // adminSDK = null;
//   }
// }

// /**
//  * 清理 Admin Platform SDK
//  */
// async function destroyAdminSDK(): Promise<void> {
//   if (adminSDK) {
//     try {
//       await adminSDK.endSession();
//       adminSDK.destroy();
//       log.info("[AdminSDK] Destroyed");
//     } catch (error) {
//       log.error("[AdminSDK] Error during destroy:", error);
//     }
//     adminSDK = null;
//   }
// }

/**
 * 广播引擎状态到所有窗口
 */
async function broadcastEngineStatus() {
  if (!openclawManager) return;

  try {
    const status = await openclawManager.getStatus();
    latestEngineStatus = {
      isRunning: status.isRunning,
      isHealthy: status.isHealthy,
      error: status.error,
    };
  } catch (error) {
    latestEngineStatus = {
      isRunning: false,
      isHealthy: false,
      error: (error as Error).message,
    };
  }

  if (mainWindow) {
    mainWindow.webContents.send("openclaw:status-changed", {
      ...latestEngineStatus,
      port: openclawManager.getConfig().port,
    });
  }

  // 更新托盘菜单状态
  updateTrayMenu();
}

function attachOpenClawEventHandlers() {
  if (!openclawManager) return;

  const syncStatus = () => {
    broadcastEngineStatus().catch((err) => {
      console.error("Failed to sync engine status:", err);
    });
  };

  openclawManager.on("started", syncStatus);
  openclawManager.on("stopped", syncStatus);
  openclawManager.on("error", syncStatus);
  openclawManager.on("health_check_failed", syncStatus);
  openclawManager.on("restarting", syncStatus);
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
      // 图标在 /Applications/XClaw.app/Contents/Resources/resources/icon.png
      iconPath = path.join(process.resourcesPath, "resources/icon.png");

      // 备用方案
      if (!require("fs").existsSync(iconPath)) {
        iconPath =
          "/Applications/XClaw.app/Contents/Resources/resources/icon.png";
      }
    } else {
      // 开发环境
      iconPath = path.join(__dirname, "../../resources/icon.png");
    }

    console.log("[Tray] Looking for icon at:", iconPath);

    if (require("fs").existsSync(iconPath)) {
      trayIcon = nativeImage
        .createFromPath(iconPath)
        .resize({ width: 16, height: 16 });
      if (process.platform === "darwin") {
        trayIcon.setTemplateImage(true);
      }
      console.log("[Tray] Icon loaded successfully");
    } else {
      console.log("[Tray] Icon not found, using empty icon");
      // 创建一个简单的彩色图标作为 fallback
      trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    tray.setToolTip("XClaw - AI数字员工");

    // 构建托盘菜单
    updateTrayMenu();

    // 点击托盘图标显示/隐藏窗口
    tray.on("click", () => {
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
    console.error("Failed to create tray:", error);
  }
}

/**
 * 更新托盘菜单
 */
function updateTrayMenu() {
  if (!tray) return;

  const isEngineRunning = latestEngineStatus.isRunning;
  const isEngineHealthy = latestEngineStatus.isHealthy;

  const statusLabel = !isEngineRunning
    ? "⚪ AI引擎已停止"
    : isEngineHealthy
      ? "🟢 AI引擎运行中"
      : "🟠 AI引擎异常";

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "打开主页面",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: statusLabel,
      enabled: false,
    },
    ...(!isEngineHealthy && latestEngineStatus.error
      ? [
          {
            label: `错误: ${latestEngineStatus.error}`,
            enabled: false,
          } as Electron.MenuItemConstructorOptions,
        ]
      : []),

    {
      label: "重启AI引擎",
      click: async () => {
        if (openclawManager) {
          try {
            await openclawManager.restart();
            await broadcastEngineStatus();
          } catch (error) {
            console.error("Failed to restart engine from tray:", error);
          }
        }
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: async () => {
        app.isQuitting = true;
        // 使用 ProcessManager 优雅地停止引擎
        if (openclawManager) {
          await openclawManager.stop();
        }
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(async () => {
  if (isInitializing) return;
  isInitializing = true;
  await createWindow();

  app.on("activate", () => {
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
  const isMac = process.platform === "darwin";
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "../resources/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/index.js"),
    },
    frame: false,
    titleBarStyle: "hidden",
    ...(isMac && { trafficLightPosition: { x: 15, y: 15 } }),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (!app.isPackaged) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // 窗口关闭时最小化到托盘而不是退出
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  setupMenu();
}

app.on("window-all-closed", () => {
  // 保持后台运行，不自动退出
  // 应用会保持托盘图标运行
});

/**
 * 强制关闭指定端口上的进程
 * @param port 端口号
 * @param processNameFilter 进程名过滤（用于精确匹配内置服务）
 */
function killProcessOnPort(
  port: number,
  processNameFilter?: string,
): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      exec(`netstat -ano -p tcp | findstr :${port}`, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve();
          return;
        }

        const pids = Array.from(
          new Set(
            stdout
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const match = line.match(/\s(\d+)$/);
                return match?.[1] || "";
              })
              .filter((pid) => pid && pid !== "0" && pid !== "4"),
          ),
        );

        if (pids.length === 0) {
          resolve();
          return;
        }

        if (processNameFilter) {
          console.log(
            `[X-Claw] Windows port cleanup ignores processNameFilter=${processNameFilter}, kill by PID on port only`,
          );
        }

        killPids(pids, port, processNameFilter);
        resolve();
      });
      return;
    }

    // 使用 lsof 查找占用端口的进程
    exec(`lsof -t -i:${port}`, (error, stdout) => {
      if (error || !stdout.trim()) {
        // 没有进程占用端口
        resolve();
        return;
      }

      // 获取 PID 列表
      const pids = stdout.trim().split("\n").filter(Boolean);

      if (pids.length === 0) {
        resolve();
        return;
      }

      // 如果有进程名过滤，先检查每个进程的名称
      if (processNameFilter) {
        let completed = 0;
        const pidsToKill: string[] = [];

        pids.forEach((pid) => {
          // 获取进程的实际进程名
          exec(`ps -p ${pid} -o comm=`, (_err, nameOutput) => {
            const processName = nameOutput.trim().toLowerCase();
            // 检查进程名是否包含过滤关键词（精确匹配）
            if (processName.includes(processNameFilter.toLowerCase())) {
              pidsToKill.push(pid);
            }
            completed++;
            if (completed === pids.length) {
              if (pidsToKill.length > 0) {
                killPids(pidsToKill, port, processNameFilter);
              }
              resolve();
            }
          });
        });
      } else {
        // 没有过滤条件，杀死所有占用端口的进程
        killPids(pids, port);
        resolve();
      }
    });
  });
}

/**
 * 杀死指定的 PID 列表
 */
function killPids(pids: string[], port: number, filter?: string): void {
  let completed = 0;
  if (pids.length === 0) {
    return;
  }

  pids.forEach((pid) => {
    const cmd =
      process.platform === "win32"
        ? `taskkill /F /T /PID ${pid}`
        : `kill -9 ${pid}`;

    exec(cmd, () => {
      completed++;
      if (completed === pids.length) {
        const filterMsg = filter ? ` (matched: ${filter})` : "";
        console.log(
          `[X-Claw] Killed processes on port ${port}${filterMsg}: ${pids.join(
            ", ",
          )}`,
        );
      }
    });
  });
}

app.on("before-quit", async (event) => {
  // 设置退出标志，让窗口可以正常关闭
  app.isQuitting = true;

  // 阻止立即退出，等待清理完成
  event.preventDefault();

  try {
    console.log("Cleaning up before quit...");
    // 清理 Admin Platform SDK
    // await destroyAdminSDK();

    // 使用 ProcessManager 优雅地停止引擎并清理所有相关进程
    if (openclawManager) {
      await openclawManager.stop();
    }

    // 最后清理所有残留进程（保险措施）
    const processManager = getProcessManager(
      OPENCLAW_PROCESS_NAME,
      OPENCLAW_PORT,
    );
    await processManager.cleanupAllProcesses();
    console.log("Cleanup completed.");
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    // 清理完成后真正退出
    app.exit(0);
  }
});

// 处理 SIGINT 和 SIGTERM 信号，确保优雅退出
process.on("SIGINT", () => {
  console.log("Received SIGINT, quitting...");
  app.quit();
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, quitting...");
  app.quit();
});
