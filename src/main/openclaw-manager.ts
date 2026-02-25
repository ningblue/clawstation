import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs';
import log from 'electron-log';

export class OpenClawManager {
  private childProcess: ChildProcess | null = null;
  private readonly log = log.scope('OpenClawManager');

  async start(): Promise<void> {
    try {
      // 确定OpenClaw可执行文件路径
      let openclawPath: string;

      if (app.isPackaged) {
        // 生产环境中，OpenClaw可能被打包在资源目录中
        openclawPath = path.join(process.resourcesPath, 'openclaw', 'bin', 'openclaw');

        // 如果不存在，则尝试从node_modules获取
        if (!fs.existsSync(openclawPath)) {
          openclawPath = path.join(__dirname, '../../../node_modules/openclaw/dist/index.js');
        }
      } else {
        // 开发环境中，使用源码路径
        openclawPath = path.join(__dirname, '../../../node_modules/openclaw/dist/index.js');
      }

      // 检查OpenClaw是否存在
      if (!fs.existsSync(openclawPath)) {
        throw new Error(`OpenClaw executable not found at: ${openclawPath}`);
      }

      // 准备环境变量
      const env = {
        ...process.env,
        OPENCLAW_MODE: 'embedded',
        OPENCLAW_GATEWAY_BIND: 'localhost',
        OPENCLAW_GATEWAY_PORT: '18789',
      };

      // 启动OpenClaw子进程
      this.childProcess = spawn(
        process.execPath, // 使用Electron内置的Node.js
        [openclawPath, 'gateway', 'run', '--bind', 'localhost', '--port', '18789'],
        {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: path.dirname(openclawPath),
        }
      );

      // 监听输出
      this.childProcess.stdout?.on('data', (data) => {
        this.log.info(data.toString());
      });

      this.childProcess.stderr?.on('data', (data) => {
        this.log.error(data.toString());
      });

      this.childProcess.on('error', (error) => {
        this.log.error('OpenClaw process error:', error);
      });

      this.childProcess.on('close', (code) => {
        this.log.info(`OpenClaw process exited with code ${code}`);
        this.childProcess = null;
      });

      this.log.info(`Started OpenClaw process with PID: ${this.childProcess.pid}`);

      // 等待一段时间以确保服务启动
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      this.log.error('Failed to start OpenClaw:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.childProcess) {
      this.log.info('Stopping OpenClaw process...');
      this.childProcess.kill();
      this.childProcess = null;
    }
  }

  isRunning(): boolean {
    return this.childProcess !== null && this.childProcess.exitCode === null;
  }
}