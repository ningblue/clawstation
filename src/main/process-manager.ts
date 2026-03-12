import { exec, spawn } from "child_process";
import * as net from "net";
import * as os from "os";
import log from "electron-log";

const logger = log.scope("ProcessManager");

/**
 * 进程管理器
 * 负责管理 clawstation-engine 进程的启动前检查和退出清理
 * 确保对用户完全无感知，不会出现端口占用错误
 */
export class ProcessManager {
  private readonly processName: string;
  private readonly port: number;
  private isCleaningUp = false;

  constructor(processName: string, port: number) {
    this.processName = processName;
    this.port = port;
  }

  /**
   * 检查端口是否被占用
   */
  private async isPortInUse(): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      server.once("listening", () => {
        server.close(() => resolve(false));
      });

      server.listen(this.port, "127.0.0.1");
    });
  }

  /**
   * 获取占用指定端口的进程信息
   */
  private async getProcessByPort(): Promise<{ pid: number; name: string } | null> {
    return new Promise((resolve) => {
      const platform = os.platform();
      let command: string;

      if (platform === "darwin" || platform === "linux") {
        // macOS/Linux: 使用 lsof
        command = `lsof -ti:${this.port} -sTCP:LISTEN`;
      } else if (platform === "win32") {
        // Windows: 使用 netstat
        command = `netstat -ano | findstr :${this.port} | findstr LISTENING`;
      } else {
        resolve(null);
        return;
      }

      exec(command, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
          return;
        }

        const lines = stdout.trim().split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let pid: number | null = null;

          if (platform === "darwin" || platform === "linux") {
            // lsof 直接返回 PID
            pid = parseInt(trimmed, 10);
          } else if (platform === "win32") {
            // Windows netstat 格式: TCP    0.0.0.0:18791    0.0.0.0:0    LISTENING    12345
            const parts = trimmed.split(/\s+/);
            const lastPart = parts[parts.length - 1];
            if (lastPart) {
              pid = parseInt(lastPart, 10);
            }
          }

          if (pid && !isNaN(pid)) {
            // 获取进程名
            this.getProcessName(pid).then((name) => {
              resolve({ pid, name: name || "unknown" });
            });
            return;
          }

          resolve(null);
        }

        resolve(null);
      });
    });
  }

  /**
   * 获取进程名称
   */
  private async getProcessName(pid: number): Promise<string | null> {
    return new Promise((resolve) => {
      const platform = os.platform();
      let command: string;

      if (platform === "darwin" || platform === "linux") {
        command = `ps -p ${pid} -o comm=`;
      } else if (platform === "win32") {
        command = `tasklist /FI "PID eq ${pid}" /FO CSV /NH`;
      } else {
        resolve(null);
        return;
      }

      exec(command, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
          return;
        }

        let name = stdout.trim();

        // Windows 格式: "process.exe","1234",...
        if (platform === "win32" && name.startsWith('"')) {
          const match = name.match(/^"([^"]+)"/);
          name = match?.[1] ?? name;
        }

        resolve(name);
      });
    });
  }

  /**
   * 检查进程是否是我们的 clawstation-engine
   */
  private isOurProcess(processName: string): boolean {
    const lowerName = processName.toLowerCase();
    return (
      lowerName.includes(this.processName.toLowerCase()) ||
      lowerName.includes("openclaw") ||
      lowerName.includes("clawstation")
    );
  }

  /**
   * 终止指定进程
   */
  private async killProcess(pid: number, processName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const platform = os.platform();
      let command: string;

      if (platform === "darwin" || platform === "linux") {
        command = `kill -9 ${pid}`;
      } else if (platform === "win32") {
        command = `taskkill /F /PID ${pid}`;
      } else {
        resolve(false);
        return;
      }

      exec(command, (error) => {
        if (error) {
          logger.error(`Failed to kill process ${processName} (PID: ${pid}):`, error);
          resolve(false);
        } else {
          logger.info(`Killed process ${processName} (PID: ${pid})`);
          resolve(true);
        }
      });
    });
  }

  /**
   * 查找所有 clawstation-engine 相关进程
   */
  private async findAllOurProcesses(): Promise<Array<{ pid: number; name: string }>> {
    return new Promise((resolve) => {
      const platform = os.platform();
      let command: string;

      if (platform === "darwin" || platform === "linux") {
        // ps aux 然后过滤
        command = `ps aux | grep -E "(clawstation-engine|openclaw)" | grep -v grep`;
      } else if (platform === "win32") {
        // tasklist 过滤
        command = `tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH`;
      } else {
        resolve([]);
        return;
      }

      exec(command, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve([]);
          return;
        }

        const processes: Array<{ pid: number; name: string }> = [];
        const lines = stdout.trim().split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (platform === "darwin" || platform === "linux") {
            // ps aux 格式: user  PID  %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 11) {
              const pidStr = parts[1];
              if (pidStr) {
                const pid = parseInt(pidStr, 10);
                const command = parts.slice(10).join(" ");
                if (pid && !isNaN(pid) && this.isOurProcess(command)) {
                  processes.push({ pid, name: command });
                }
              }
            }
          } else if (platform === "win32") {
            // Windows CSV 格式: "node.exe","1234",...
            // 需要进一步检查命令行参数
            const match = trimmed.match(/^"([^"]+)"\s*,\s*"(\d+)"/);
            if (match) {
              const nameMatch = match[1];
              const pidStr = match[2];
              if (nameMatch && pidStr) {
                const pid = parseInt(pidStr, 10);
                // 对于 Windows，我们需要额外的命令行检查
                this.getProcessCommandLine(pid).then((cmdline) => {
                  if (cmdline && this.isOurProcess(cmdline)) {
                    processes.push({ pid, name: nameMatch });
                  }
                });
              }
            }
          }
        }

        resolve(processes);
      });
    });
  }

  /**
   * 获取 Windows 进程的命令行参数
   */
  private async getProcessCommandLine(pid: number): Promise<string | null> {
    return new Promise((resolve) => {
      // 使用 wmic 获取命令行
      exec(`wmic process where "ProcessId=${pid}" get CommandLine /value`, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * 确保端口可用
   * 如果端口被占用，检查是否是旧实例，如果是则终止它
   * @returns true 表示端口已可用，false 表示无法释放端口（被其他应用占用）
   */
  async ensurePortAvailable(): Promise<boolean> {
    if (this.isCleaningUp) {
      logger.info("Cleanup in progress, waiting...");
      await this.waitForCleanup();
    }

    const inUse = await this.isPortInUse();
    if (!inUse) {
      logger.info(`Port ${this.port} is available`);
      return true;
    }

    logger.info(`Port ${this.port} is in use, checking process...`);

    const processInfo = await this.getProcessByPort();
    if (!processInfo) {
      logger.warn(`Port ${this.port} is in use but cannot identify process`);
      // 等待一下再检查，可能是刚释放的
      await new Promise((r) => setTimeout(r, 500));
      return !(await this.isPortInUse());
    }

    logger.info(`Port ${this.port} is used by ${processInfo.name} (PID: ${processInfo.pid})`);

    // 无论是不是我们的进程，都尝试终止它（因为我们必须使用这个端口）
    if (this.isOurProcess(processInfo.name)) {
      logger.info(`Killing old ${this.processName} instance...`);
    } else {
      logger.warn(`Port ${this.port} is used by ${processInfo.name}. Terminating it to free the port...`);
    }

    const killed = await this.killProcess(processInfo.pid, processInfo.name);

    if (killed) {
      // 等待端口释放
      let attempts = 0;
      while (await this.isPortInUse()) {
        if (attempts++ > 10) {
          logger.error(`Port ${this.port} still in use after killing process`);
          return false;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      logger.info(`Port ${this.port} is now available`);
      return true;
    }

    return false;
  }

  /**
   * 清理所有相关进程
   * 在应用退出时调用
   */
  async cleanupAllProcesses(): Promise<void> {
    if (this.isCleaningUp) {
      return;
    }

    this.isCleaningUp = true;
    logger.info("Cleaning up all clawstation-engine processes...");

    try {
      // 先终止已知的子进程（如果有）
      if (this.childPid) {
        await this.killProcess(this.childPid, this.processName);
        this.childPid = null;
      }

      // 查找并终止所有相关进程
      const processes = await this.findAllOurProcesses();
      logger.info(`Found ${processes.length} processes to clean up`);

      for (const proc of processes) {
        await this.killProcess(proc.pid, proc.name);
      }

      // 最后检查端口是否释放
      let attempts = 0;
      while ((await this.isPortInUse()) && attempts < 10) {
        await new Promise((r) => setTimeout(r, 200));
        attempts++;
      }

      logger.info("Cleanup completed");
    } catch (error) {
      logger.error("Error during cleanup:", error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  private childPid: number | null = null;

  /**
   * 注册子进程 PID
   * 用于退出时的清理
   */
  registerChildProcess(pid: number): void {
    this.childPid = pid;
  }

  /**
   * 注销子进程 PID
   */
  unregisterChildProcess(): void {
    this.childPid = null;
  }

  /**
   * 等待清理完成
   */
  private async waitForCleanup(): Promise<void> {
    let attempts = 0;
    while (this.isCleaningUp && attempts < 50) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }
  }

  /**
   * 强制清理（同步方式，用于紧急退出）
   */
  forceCleanup(): void {
    if (this.childPid) {
      try {
        process.kill(this.childPid, "SIGKILL");
        logger.info(`Force killed process ${this.childPid}`);
      } catch (e) {
        // 进程可能已经退出
      }
    }
  }
}

/**
 * 全局 ProcessManager 实例
 */
let globalProcessManager: ProcessManager | null = null;

/**
 * 获取或创建 ProcessManager 实例
 */
export function getProcessManager(processName: string, port: number): ProcessManager {
  if (!globalProcessManager) {
    globalProcessManager = new ProcessManager(processName, port);
  }
  return globalProcessManager;
}

/**
 * 设置全局 ProcessManager 实例
 */
export function setProcessManager(manager: ProcessManager): void {
  globalProcessManager = manager;
}
