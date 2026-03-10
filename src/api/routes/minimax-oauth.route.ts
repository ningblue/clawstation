// src/api/routes/minimax-oauth.route.ts
// MiniMax OAuth IPC 路由

import { ipcMain, IpcMainInvokeEvent } from "electron";
import {
  miniMaxOAuthService,
  MiniMaxRegion,
} from "../../backend/services/minimax-oauth.service";
import { OpenClawManager } from "../../backend/services/openclaw.service";

export function setupMiniMaxOAuthRoutes(openclawManager: OpenClawManager): void {
  // 开始 OAuth 流程
  ipcMain.handle(
    "minimax:oauth:start",
    async (_event: IpcMainInvokeEvent, region: MiniMaxRegion = "global") => {
      try {
        const result = await miniMaxOAuthService.startOAuth(region);
        return { success: true, ...result };
      } catch (error) {
        console.error("Error starting MiniMax OAuth:", error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  // 轮询 Token
  ipcMain.handle("minimax:oauth:poll", async (_event: IpcMainInvokeEvent) => {
    try {
      const token = await miniMaxOAuthService.pollToken();
      if (token) {
        // 获取当前会话的 region
        const session = miniMaxOAuthService.getSession();
        if (session) {
          // 保存到配置
          const configManager = openclawManager.getConfigManager();

          // 设置 OAuth 标记和基础配置
          const baseUrl =
            session.region === "cn"
              ? "https://api.minimaxi.com/anthropic"
              : "https://api.minimax.io/anthropic";

          // 设置 OAuth token (使用特殊标记)
          configManager.setApiKey("main", "minimax-portal", "minimax-oauth", baseUrl);
          configManager.setApiKey("default", "minimax-portal", "minimax-oauth", baseUrl);

          // 添加 auth profile (OAuth token 存储在 key 字段)
          configManager.setAuthProfile("main", "minimax-portal", {
            type: "oauth",
            provider: "minimax-portal",
            key: token.access,
            refreshToken: token.refresh,
            expiresAt: token.expires,
          });

          configManager.setAuthProfile("default", "minimax-portal", {
            type: "oauth",
            provider: "minimax-portal",
            key: token.access,
            refreshToken: token.refresh,
            expiresAt: token.expires,
          });

          return {
            success: true,
            token: {
              access: token.access.slice(0, 10) + "...",
              resourceUrl: token.resourceUrl,
              notification: token.notification_message,
            },
          };
        }
      }
      return { success: true, pending: true };
    } catch (error) {
      console.error("Error polling MiniMax OAuth:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 取消 OAuth
  ipcMain.handle("minimax:oauth:cancel", async (_event: IpcMainInvokeEvent) => {
    try {
      miniMaxOAuthService.cancelOAuth();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 检查是否有已保存的 token
  ipcMain.handle("minimax:oauth:status", async (_event: IpcMainInvokeEvent) => {
    try {
      const savedToken = miniMaxOAuthService.loadSavedToken();
      const configManager = openclawManager.getConfigManager();
      const hasProfile = configManager.hasAuthProfile("main", "minimax-portal");

      return {
        success: true,
        configured: !!savedToken || hasProfile,
        hasSavedToken: !!savedToken,
        region: savedToken?.region,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 清除 OAuth 配置
  ipcMain.handle("minimax:oauth:clear", async (_event: IpcMainInvokeEvent) => {
    try {
      miniMaxOAuthService.clearSavedToken();

      const configManager = openclawManager.getConfigManager();
      configManager.removeAuthProfile("main", "minimax-portal");
      configManager.removeAuthProfile("default", "minimax-portal");

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
