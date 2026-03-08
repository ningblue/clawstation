// src/api/routes/openclaw-monitor.route.ts
/**
 * OpenClaw 状态监控和诊断 API 路由
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { OpenClawManager } from '../../backend/services/openclaw.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import log from 'electron-log';


/**
 * 日志条目接口
 */
interface LogEntry {
  timestamp: string;
  level: string;
  subsystem: string;
  message: string;
}

/**
 * 设置 OpenClaw 监控路由
 */
export function setupOpenClawMonitorRoutes(openclawManager: OpenClawManager): void {
  // 获取详细状态（包含诊断信息）
  ipcMain.handle('openclaw:monitor:status', async (_event: IpcMainInvokeEvent) => {
    try {
      const status = await openclawManager.getStatus();
      const configManager = openclawManager.getConfigManager();

      // 获取配置验证结果
      const validation = openclawManager.validateConfiguration();

      // 获取网关配置
      const gatewayConfig = configManager.getGatewayConfig();

      // 获取 agents 详细信息
      const agentsConfig = configManager.getAgentsConfig();

      return {
        success: true,
        status: {
          ...status,
          validation,
          gateway: {
            port: gatewayConfig?.port,
            bind: gatewayConfig?.bind,
            mode: gatewayConfig?.mode,
            authMode: gatewayConfig?.auth?.mode,
            chatCompletionsEnabled: gatewayConfig?.http?.endpoints?.chatCompletions?.enabled,
          },
          agents: {
            count: agentsConfig?.list?.length || 0,
            defaultAgent: agentsConfig?.list?.find(a => a.default)?.id,
            list: agentsConfig?.list?.map(a => ({
              id: a.id,
              name: a.name,
              default: a.default,
              model: typeof a.model === 'string' ? a.model : a.model?.primary,
            })),
          },
        },
      };
    } catch (error) {
      console.error('Error getting monitor status:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取日志
  ipcMain.handle('openclaw:monitor:logs', async (_event: IpcMainInvokeEvent, options?: {
    lines?: number;
    level?: 'debug' | 'info' | 'warn' | 'error';
    subsystem?: string;
  }) => {
    try {
      const stateLogDir = path.join(os.homedir(), '.clawstation', 'logs');
      const candidatePaths = [
        path.join(stateLogDir, 'openclaw.log'),
        path.join(stateLogDir, 'gateway.log'),
        path.join(stateLogDir, 'openclaw-gateway.log'),
        log.transports.file.getFile().path,
      ];

      const existingPaths = candidatePaths.filter((p) => !!p && fs.existsSync(p));
      if (existingPaths.length === 0) {
        return { success: true, logs: [], checkedPaths: candidatePaths };
      }

      const logPath = existingPaths
        .map((p) => ({ p, mtime: fs.statSync(p).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)[0]?.p;

      if (!logPath) {
        return { success: true, logs: [], checkedPaths: candidatePaths };
      }

      const content = fs.readFileSync(logPath, 'utf8');

      const lines = content.split('\n').filter(line => line.trim());

      // 解析日志条目
      const logs: LogEntry[] = [];
      const maxLines = options?.lines || 100;

      for (let i = Math.max(0, lines.length - maxLines); i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        try {
          const entry = JSON.parse(line);
          logs.push({
            timestamp: entry.time || entry.timestamp || new Date().toISOString(),
            level: entry._meta?.logLevelName || 'INFO',
            subsystem: entry['0'] ? JSON.parse(entry['0']).subsystem : 'unknown',
            message: entry['1'] || entry.message || line,
          });
        } catch {
          // 如果解析失败，使用原始行
          logs.push({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            subsystem: 'unknown',
            message: line,
          });
        }
      }

      // 过滤
      let filteredLogs = logs;
      if (options?.level) {
        filteredLogs = filteredLogs.filter(log =>
          log.level.toLowerCase() === options.level?.toLowerCase()
        );
      }
      if (options?.subsystem) {
        filteredLogs = filteredLogs.filter(log =>
          log.subsystem.includes(options.subsystem!)
        );
      }

      return { success: true, logs: filteredLogs, source: logPath };

    } catch (error) {
      console.error('Error getting logs:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取最近的错误
  ipcMain.handle('openclaw:monitor:errors', async (_event: IpcMainInvokeEvent, limit: number = 10) => {
    try {
      const stateLogDir = path.join(os.homedir(), '.clawstation', 'logs');

      const candidatePaths = [
        path.join(stateLogDir, 'openclaw.log'),
        path.join(stateLogDir, 'gateway.log'),
        path.join(stateLogDir, 'openclaw-gateway.log'),
        log.transports.file.getFile().path,
      ];

      const existingPaths = candidatePaths.filter((p) => !!p && fs.existsSync(p));
      if (existingPaths.length === 0) {
        return { success: true, errors: [] };
      }

      const logPath = existingPaths
        .map((p) => ({ p, mtime: fs.statSync(p).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)[0]?.p;

      if (!logPath) {
        return { success: true, errors: [] };
      }

      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const errors: LogEntry[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        try {
          const entry = JSON.parse(line);
          const level = String(entry._meta?.logLevelName || 'INFO');
          const message = String(entry['1'] || entry.message || line);
          const subsystem = entry['0'] ? JSON.parse(entry['0']).subsystem : 'unknown';

          if (level.toLowerCase() === 'error' || /error|failed|exception/i.test(message)) {
            errors.push({
              timestamp: entry.time || entry.timestamp || new Date().toISOString(),
              level,
              subsystem,
              message,
            });
          }
        } catch {
          if (/error|failed|exception/i.test(line)) {
            errors.push({
              timestamp: new Date().toISOString(),
              level: 'ERROR',
              subsystem: 'unknown',
              message: line,
            });
          }
        }
      }

      return { success: true, errors: errors.slice(-limit), source: logPath };
    } catch (error) {
      console.error('Error getting errors:', error);
      return { success: false, error: (error as Error).message };
    }
  });


  // 诊断检查
  ipcMain.handle('openclaw:monitor:diagnose', async (_event: IpcMainInvokeEvent) => {
    const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; code: string }> = [];

    try {
      const configManager = openclawManager.getConfigManager();
      const validation = openclawManager.validateConfiguration();

      // 检查配置有效性
      if (!validation.valid) {
        issues.push(...validation.errors.map(err => ({
          type: 'error' as const,
          message: err,
          code: 'CONFIG_INVALID',
        })));
      }

      // 检查缺失的 API Keys
      if (validation.missingApiKeys.length > 0) {
        issues.push(...validation.missingApiKeys.map(provider => ({
          type: 'error' as const,
          message: `Missing API key for provider: ${provider}`,
          code: 'MISSING_API_KEY',
        })));
      }

      // 检查默认 agent
      const defaultAgent = configManager.getDefaultAgent();
      if (!defaultAgent) {
        issues.push({
          type: 'error' as const,
          message: 'No default agent configured',
          code: 'NO_DEFAULT_AGENT',
        });
      }

      // 检查网关配置
      const gatewayConfig = configManager.getGatewayConfig();
      if (!gatewayConfig?.port) {
        issues.push({
          type: 'error' as const,
          message: 'Gateway port not configured',
          code: 'NO_GATEWAY_PORT',
        });
      }

      if (!gatewayConfig?.auth?.token) {
        issues.push({
          type: 'warning' as const,
          message: 'Gateway auth token not set',
          code: 'NO_AUTH_TOKEN',
        });
      }

      // 检查 Chat Completions 端点
      if (!gatewayConfig?.http?.endpoints?.chatCompletions?.enabled) {
        issues.push({
          type: 'warning' as const,
          message: 'Chat Completions endpoint is not enabled',
          code: 'CHAT_COMPLETIONS_DISABLED',
        });
      }

      // 检查引擎状态
      const status = await openclawManager.getStatus();
      if (!status.isRunning) {
        issues.push({
          type: 'info' as const,
          message: 'OpenClaw engine is not running',
          code: 'ENGINE_NOT_RUNNING',
        });
      } else if (!status.isHealthy) {
        issues.push({
          type: 'error' as const,
          message: 'OpenClaw engine is running but not healthy',
          code: 'ENGINE_UNHEALTHY',
        });
      }

      // 如果没有问题，添加成功信息
      if (issues.length === 0) {
        issues.push({
          type: 'info' as const,
          message: 'All checks passed',
          code: 'ALL_OK',
        });
      }

      return {
        success: true,
        healthy: issues.filter(i => i.type === 'error').length === 0,
        issues,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error running diagnostics:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取系统信息
  ipcMain.handle('openclaw:monitor:system', async (_event: IpcMainInvokeEvent) => {
    try {
      const configDir = path.join(os.homedir(), '.clawstation');
      const agentsDir = path.join(configDir, 'agents');

      // 计算目录大小
      const getDirSize = (dirPath: string): number => {
        let size = 0;
        if (!fs.existsSync(dirPath)) return 0;

        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            size += getDirSize(filePath);
          } else {
            size += stats.size;
          }
        }
        return size;
      };

      // 获取 agent 目录信息
      const getAgentsInfo = () => {
        if (!fs.existsSync(agentsDir)) return [];

        return fs.readdirSync(agentsDir)
          .filter(name => {
            const agentPath = path.join(agentsDir, name);
            return fs.statSync(agentPath).isDirectory();
          })
          .map(name => {
            const agentPath = path.join(agentsDir, name);
            const agentDir = path.join(agentPath, 'agent');
            return {
              id: name,
              size: getDirSize(agentPath),
              hasConfig: fs.existsSync(path.join(agentDir, 'config.json')),
              hasAuth: fs.existsSync(path.join(agentDir, 'auth-profiles.json')),
            };
          });
      };

      return {
        success: true,
        system: {
          configDir,
          configDirExists: fs.existsSync(configDir),
          totalSize: getDirSize(configDir),
          agents: getAgentsInfo(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };
    } catch (error) {
      console.error('Error getting system info:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 导出配置
  ipcMain.handle('openclaw:monitor:export', async (_event: IpcMainInvokeEvent) => {
    try {
      const configManager = openclawManager.getConfigManager();
      const config = configManager.exportConfig();
      return { success: true, config };
    } catch (error) {
      console.error('Error exporting config:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 导入配置
  ipcMain.handle('openclaw:monitor:import', async (_event: IpcMainInvokeEvent, configJson: string) => {
    try {
      const configManager = openclawManager.getConfigManager();
      configManager.importConfig(configJson);
      return { success: true };
    } catch (error) {
      console.error('Error importing config:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}
