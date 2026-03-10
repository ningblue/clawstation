/**
 * MiniMax OAuth Service
 * 实现 MiniMax OAuth Device Code 流程
 * 参考: lib/openclaw/extensions/minimax-portal-auth/oauth.ts
 */

import { randomBytes, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import log from "electron-log";

const logger = log.scope("MiniMaxOAuth");

export type MiniMaxRegion = "cn" | "global";

export interface MiniMaxOAuthConfig {
  baseUrl: string;
  clientId: string;
}

export interface MiniMaxOAuthAuthorization {
  user_code: string;
  verification_uri: string;
  expired_in: number;
  interval?: number;
  state: string;
}

export interface MiniMaxOAuthToken {
  access: string;
  refresh: string;
  expires: number;
  resourceUrl?: string;
  notification_message?: string;
}

export interface MiniMaxOAuthSession {
  region: MiniMaxRegion;
  userCode: string;
  verificationUri: string;
  verifier: string;
  expiresAt: number;
  interval: number;
}

const MINIMAX_OAUTH_CONFIG: Record<MiniMaxRegion, MiniMaxOAuthConfig> = {
  cn: {
    baseUrl: "https://api.minimaxi.com",
    clientId: "78257093-7e40-4613-99e0-527b14b39113",
  },
  global: {
    baseUrl: "https://api.minimax.io",
    clientId: "78257093-7e40-4613-99e0-527b14b39113",
  },
};

const MINIMAX_OAUTH_SCOPE = "group_id profile model.completion";
const MINIMAX_OAUTH_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:user_code";
const OAUTH_TOKEN_FILE = "minimax-oauth.json";

/**
 * 生成 PKCE 校验码和挑战码
 */
function generatePkce(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createPkceChallenge(verifier);
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

/**
 * 创建 PKCE S256 挑战码
 */
function createPkceChallenge(verifier: string): string {
  const crypto = require("node:crypto");
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * 将对象转换为 URL 编码格式
 */
function toFormUrlEncoded(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/**
 * 获取 OAuth 会话文件路径
 */
function getOAuthSessionPath(): string {
  const configDir = path.join(os.homedir(), ".clawstation");
  return path.join(configDir, OAUTH_TOKEN_FILE);
}

/**
 * MiniMax OAuth 服务
 */
export class MiniMaxOAuthService {
  private activeSession: MiniMaxOAuthSession | null = null;

  /**
   * 获取 OAuth 端点
   */
  private getEndpoints(region: MiniMaxRegion) {
    const config = MINIMAX_OAUTH_CONFIG[region];
    return {
      codeEndpoint: `${config.baseUrl}/oauth/code`,
      tokenEndpoint: `${config.baseUrl}/oauth/token`,
      clientId: config.clientId,
      baseUrl: config.baseUrl,
    };
  }

  /**
   * 开始 OAuth 流程 - 请求设备码
   */
  async startOAuth(region: MiniMaxRegion): Promise<{
    userCode: string;
    verificationUri: string;
    expiresAt: number;
  }> {
    logger.info(`Starting MiniMax OAuth flow for region: ${region}`);

    const endpoints = this.getEndpoints(region);
    const { verifier, challenge, state } = generatePkce();

    const response = await fetch(endpoints.codeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "x-request-id": randomUUID(),
      },
      body: toFormUrlEncoded({
        response_type: "code",
        client_id: endpoints.clientId,
        scope: MINIMAX_OAUTH_SCOPE,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: state,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MiniMax OAuth authorization failed: ${text || response.statusText}`);
    }

    const payload = (await response.json()) as MiniMaxOAuthAuthorization & { error?: string };

    if (!payload.user_code || !payload.verification_uri) {
      throw new Error(
        payload.error ??
          "MiniMax OAuth authorization returned an incomplete payload (missing user_code or verification_uri)."
      );
    }

    if (payload.state !== state) {
      throw new Error("MiniMax OAuth state mismatch: possible CSRF attack or session corruption.");
    }

    // 保存会话
    this.activeSession = {
      region,
      userCode: payload.user_code,
      verificationUri: payload.verification_uri,
      verifier,
      expiresAt: payload.expired_in,
      interval: payload.interval ?? 2000,
    };

    logger.info(`OAuth session started, userCode: ${payload.user_code}`);

    return {
      userCode: payload.user_code,
      verificationUri: payload.verification_uri,
      expiresAt: payload.expired_in,
    };
  }

  /**
   * 轮询获取 Token
   */
  async pollToken(): Promise<MiniMaxOAuthToken | null> {
    if (!this.activeSession) {
      throw new Error("No active OAuth session. Call startOAuth first.");
    }

    const session = this.activeSession;
    const endpoints = this.getEndpoints(session.region);

    const response = await fetch(endpoints.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: toFormUrlEncoded({
        grant_type: MINIMAX_OAUTH_GRANT_TYPE,
        client_id: endpoints.clientId,
        user_code: session.userCode,
        code_verifier: session.verifier,
      }),
    });

    const text = await response.text();
    let payload: any;

    try {
      payload = JSON.parse(text);
    } catch {
      logger.error("Failed to parse OAuth response:", text);
      throw new Error("MiniMax OAuth failed to parse response.");
    }

    if (!response.ok) {
      const message = payload?.base_resp?.status_msg ?? text;
      throw new Error(`MiniMax OAuth failed: ${message}`);
    }

    // 检查状态
    if (payload.status === "error") {
      throw new Error("An error occurred. Please try again later");
    }

    if (payload.status !== "success") {
      // 仍在等待用户授权
      return null;
    }

    // 授权成功
    if (!payload.access_token || !payload.refresh_token || !payload.expired_in) {
      throw new Error("MiniMax OAuth returned incomplete token payload.");
    }

    const token: MiniMaxOAuthToken = {
      access: payload.access_token,
      refresh: payload.refresh_token,
      expires: payload.expired_in,
      resourceUrl: payload.resource_url,
      notification_message: payload.notification_message,
    };

    // 保存 token
    await this.saveToken(session.region, token);

    // 清除会话
    this.activeSession = null;

    logger.info("MiniMax OAuth completed successfully");
    return token;
  }

  /**
   * 检查是否已授权
   */
  hasActiveSession(): boolean {
    return this.activeSession !== null;
  }

  /**
   * 获取当前会话信息
   */
  getSession(): MiniMaxOAuthSession | null {
    return this.activeSession;
  }

  /**
   * 取消当前 OAuth 流程
   */
  cancelOAuth(): void {
    this.activeSession = null;
    logger.info("OAuth session cancelled");
  }

  /**
   * 保存 Token 到文件
   */
  private async saveToken(region: MiniMaxRegion, token: MiniMaxOAuthToken): Promise<void> {
    const tokenPath = getOAuthSessionPath();
    const data = {
      region,
      ...token,
      savedAt: Date.now(),
    };

    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));
    logger.info(`Token saved to ${tokenPath}`);
  }

  /**
   * 加载已保存的 Token
   */
  loadSavedToken(): (MiniMaxOAuthToken & { region: MiniMaxRegion }) | null {
    try {
      const tokenPath = getOAuthSessionPath();
      if (!fs.existsSync(tokenPath)) {
        return null;
      }

      const content = fs.readFileSync(tokenPath, "utf8");
      const data = JSON.parse(content);

      // 检查 token 是否过期
      if (data.expires && Date.now() > data.expires * 1000) {
        logger.warn("Saved token has expired");
        return null;
      }

      return {
        region: data.region,
        access: data.access,
        refresh: data.refresh,
        expires: data.expires,
        resourceUrl: data.resourceUrl,
        notification_message: data.notification_message,
      };
    } catch (error) {
      logger.error("Failed to load saved token:", error);
      return null;
    }
  }

  /**
   * 删除已保存的 Token
   */
  clearSavedToken(): void {
    try {
      const tokenPath = getOAuthSessionPath();
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
        logger.info("Token cleared");
      }
    } catch (error) {
      logger.error("Failed to clear token:", error);
    }
  }

  /**
   * 刷新 Token
   */
  async refreshToken(refreshToken: string, region: MiniMaxRegion): Promise<MiniMaxOAuthToken> {
    const endpoints = this.getEndpoints(region);

    const response = await fetch(endpoints.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: toFormUrlEncoded({
        grant_type: "refresh_token",
        client_id: endpoints.clientId,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed: ${text || response.statusText}`);
    }

    const payload = await response.json();

    if (payload.status !== "success" || !payload.access_token) {
      throw new Error("Token refresh returned invalid response");
    }

    const token: MiniMaxOAuthToken = {
      access: payload.access_token,
      refresh: payload.refresh_token || refreshToken,
      expires: payload.expired_in || Date.now() / 1000 + 3600,
      resourceUrl: payload.resource_url,
      notification_message: payload.notification_message,
    };

    await this.saveToken(region, token);
    return token;
  }
}

// 导出单例
export const miniMaxOAuthService = new MiniMaxOAuthService();
