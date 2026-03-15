/**
 * OpenClaw WebSocket 客户端
 * 用于订阅 Agent 工具事件（tool-events）
 */

import WebSocket from 'ws';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';

const logger = log.scope('OpenClawWS');

/**
 * Tool 事件数据结构
 */
export interface ToolEventData {
  phase: 'start' | 'update' | 'result';
  name: string;
  toolCallId: string;
  args?: Record<string, unknown>;
  partialResult?: unknown;
  result?: unknown;
  isError?: boolean;
  meta?: unknown;
}

/**
 * Agent 事件 Payload
 */
export interface AgentEventPayload {
  runId: string;
  seq: number;
  stream: 'tool' | 'assistant' | 'lifecycle' | 'error';
  ts: number;
  data: ToolEventData | Record<string, unknown>;
  sessionKey?: string;
}

/**
 * WebSocket 连接配置
 */
interface WSClientConfig {
  host: string;
  port: number;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * OpenClaw WebSocket 客户端
 */
export class OpenClawWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WSClientConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isShuttingDown = false;
  private connId: string | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor(config: WSClientConfig) {
    super();
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  /**
   * 设置主窗口引用（用于发送 IPC 事件）
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * 连接到 OpenClaw WebSocket
   */
  async connect(): Promise<boolean> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      logger.warn('WebSocket already connected or connecting');
      return true;
    }

    if (this.isShuttingDown) {
      logger.warn('Client is shutting down, not connecting');
      return false;
    }

    this.isConnecting = true;
    const wsUrl = `ws://${this.config.host}:${this.config.port}`;

    logger.info(`Connecting to OpenClaw WebSocket: ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', this.handleOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('close', this.handleClose.bind(this));
      this.ws.on('error', this.handleError.bind(this));

      // 等待连接成功
      await this.waitForConnection();
      return true;
    } catch (error) {
      logger.error('Failed to connect to WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
      return false;
    }
  }

  /**
   * 等待连接建立
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      const onOpen = () => {
        clearTimeout(timeout);
        this.ws?.removeListener('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        clearTimeout(timeout);
        this.ws?.removeListener('open', onOpen);
        reject(error);
      };

      this.ws?.once('open', onOpen);
      this.ws?.once('error', onError);
    });
  }

  /**
   * 处理连接打开
   */
  private handleOpen(): void {
    logger.info('WebSocket connection opened');
    this.isConnecting = false;
    this.reconnectAttempts = 0;

    // 发送连接请求（带 tool-events capability）
    this.sendConnectRequest();
  }

  /**
   * 发送连接请求
   */
  private sendConnectRequest(): void {
    const connectRequest = {
      type: 'req',
      id: `conn_${Date.now()}`,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'gateway-client',
          version: '1.0.0',
          platform: process.platform,
          mode: 'ui',
        },
        caps: ['tool-events'], // 关键：声明 tool-events 能力
        role: 'operator',
        scopes: ['operator.admin'],
        auth: {
          token: this.config.token,
        },
      },
    };

    logger.info('Sending connect request with tool-events capability');
    this.ws?.send(JSON.stringify(connectRequest));
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString());
      logger.debug('Received message:', message.type, message.event || message.type);

      // 处理连接挑战
      if (message.type === 'event' && message.event === 'connect.challenge') {
        logger.debug('Received connect challenge');
        return;
      }

      // 处理连接成功响应
      if (message.type === 'res' && message.ok === true && message.payload?.server?.connId) {
        this.connId = message.payload.server.connId;
        logger.info('Connected successfully, connId:', this.connId);
        this.emit('connected', { connId: this.connId });
        return;
      }

      // 处理 agent 事件（tool 事件）
      if (message.type === 'event' && message.event === 'agent') {
        const payload = message.payload as AgentEventPayload;

        if (payload.stream === 'tool') {
          logger.debug(`Tool event: ${payload.data?.name} [${payload.data?.phase}]`);
          this.handleToolEvent(payload);
        }
      }
    } catch (error) {
      logger.error('Failed to parse message:', error);
    }
  }

  /**
   * 处理 Tool 事件
   */
  private handleToolEvent(event: AgentEventPayload): void {
    logger.info(`🛠️ Tool event: ${(event.data as any)?.name} [${(event.data as any)?.phase}] runId=${event.runId}`);

    // 转发到主窗口
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      logger.debug('Sending tool-event to renderer via IPC');
      this.mainWindow.webContents.send('openclaw:tool-event', event);
    } else {
      logger.warn('Main window not available, cannot send tool-event to renderer');
    }

    // 触发本地事件
    this.emit('tool-event', event);
  }

  /**
   * 处理连接关闭
   */
  private handleClose(code: number, reason: Buffer): void {
    logger.warn(`WebSocket closed: ${code} ${reason.toString()}`);
    this.isConnecting = false;
    this.connId = null;
    this.emit('disconnected', { code, reason: reason.toString() });

    if (!this.isShuttingDown) {
      this.scheduleReconnect();
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: Error): void {
    logger.error('WebSocket error:', error.message);
    this.emit('error', error);
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      logger.error('Max reconnection attempts reached');
      this.emit('max-reconnect-reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval || 5000;

    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((err) => {
        logger.error('Reconnection failed:', err);
      });
    }, delay);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    logger.info('Disconnecting WebSocket client');
    this.isShuttingDown = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connId = null;
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 获取连接 ID
   */
  getConnId(): string | null {
    return this.connId;
  }

  /**
   * 发送 chat.send 请求
   * 这会注册 connId 为 tool event 接收者
   */
  sendChatMessage(params: {
    message: string;
    sessionKey?: string;
    model?: string;
  }): Promise<{ success: boolean; error?: string; runId?: string }> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        resolve({ success: false, error: 'WebSocket not connected' });
        return;
      }

      const requestId = `chat_${Date.now()}`;
      const request = {
        type: 'req',
        id: requestId,
        method: 'chat.send',
        params: {
          text: params.message,
          sessionKey: params.sessionKey,
          model: params.model,
        },
      };

      logger.info(`Sending chat.send request: ${requestId}`);

      // 设置超时
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Timeout' });
      }, 30000);

      // 临时消息处理器来捕获响应
      const responseHandler = (data: WebSocket.RawData) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'res' && message.id === requestId) {
            clearTimeout(timeout);
            this.ws?.removeListener('message', responseHandler);

            if (message.ok) {
              resolve({ success: true, runId: message.payload?.runId });
            } else {
              resolve({ success: false, error: message.error?.message || 'Unknown error' });
            }
          }
        } catch {
          // 忽略解析错误
        }
      };

      this.ws.on('message', responseHandler);
      this.ws.send(JSON.stringify(request));
    });
  }
}

/**
 * 创建 WebSocket 客户端实例
 */
export function createWebSocketClient(
  host: string,
  port: number,
  token: string
): OpenClawWebSocketClient {
  return new OpenClawWebSocketClient({ host, port, token });
}
