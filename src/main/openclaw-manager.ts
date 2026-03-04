import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { app } from "electron";
import * as fs from "fs";
import log from "electron-log";
import {
  OPENCLAW_PORT,
  OPENCLAW_PROCESS_NAME,
  OPENCLAW_BIND_ADDRESS,
} from "../shared/constants";

export class OpenClawManager {
  private childProcess: ChildProcess | null = null;
  private readonly log = log.scope("OpenClawManager");

  async start(): Promise<void> {
    try {
      // 确定OpenClaw可执行文件路径
      let openclawPath: string;

      if (app.isPackaged) {
        // 生产环境：Contents/Resources/openclaw/wrapper.js
        // process.resourcesPath 指向 Contents/Resources
        openclawPath = path.join(
          process.resourcesPath,
          "openclaw",
          "wrapper.js",
        );
      } else {
        // 开发环境：resources/openclaw/wrapper.js
        // __dirname 是 src/main 编译后的位置，通常在 dist/main
        // 项目根目录是 path.resolve(__dirname, '../../')
        openclawPath = path.resolve(
          __dirname,
          "../../resources/openclaw/wrapper.js",
        );
      }

      // 检查OpenClaw是否存在
      if (!fs.existsSync(openclawPath)) {
        throw new Error(
          `OpenClaw executable not found at: ${openclawPath}. Please run 'npm run build:openclaw' first.`,
        );
      }

      console.log("[OpenClawManager] Using OpenClaw at:", openclawPath);

      const port = process.env.OPENCLAW_PORT || String(OPENCLAW_PORT);

      // 准备环境变量
      const env = {
        ...process.env,
        OPENCLAW_MODE: "embedded",
        OPENCLAW_GATEWAY_PORT: port,
        // Set process name for the wrapper to pick up
        OPENCLAW_PROCESS_NAME: OPENCLAW_PROCESS_NAME,
      };

      // 启动OpenClaw子进程
      this.childProcess = spawn(
        process.execPath, // 使用Electron内置的Node.js
        [
          openclawPath,
          "gateway",
          "run",
          "--bind",
          "loopback",
          "--port",
          port,
          "--force",
        ],
        {
          env,
          stdio: ["pipe", "pipe", "pipe"],
          cwd: path.dirname(openclawPath),
        },
      );

      // 监听输出
      this.childProcess.stdout?.on("data", (data) => {
        this.log.info(data.toString());
      });

      this.childProcess.stderr?.on("data", (data) => {
        this.log.error(data.toString());
      });

      this.childProcess.on("error", (error) => {
        this.log.error("OpenClaw process error:", error);
      });

      this.childProcess.on("close", (code) => {
        this.log.info(`OpenClaw process exited with code ${code}`);
        this.childProcess = null;
      });

      this.log.info(
        `Started OpenClaw process with PID: ${this.childProcess.pid}`,
      );

      // 等待一段时间以确保服务启动
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      this.log.error("Failed to start OpenClaw:", error);
      throw error;
    }
  }

  stop(): void {
    if (this.childProcess) {
      this.log.info("Stopping OpenClaw process...");
      this.childProcess.kill();
      this.childProcess = null;
    }
  }

  isRunning(): boolean {
    return this.childProcess !== null && this.childProcess.exitCode === null;
  }
}
