/**
 * 工具事件类型定义
 * 对应 OpenClaw 的 Agent Tool 事件
 */

/**
 * Tool 执行阶段
 */
export type ToolPhase = 'start' | 'update' | 'result';

/**
 * Tool 执行状态
 */
export type ToolEventStatus = 'running' | 'success' | 'error' | 'pending';

/**
 * Tool 事件数据结构
 */
export interface ToolEventData {
  phase: ToolPhase;
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
 * 前端 Tool 事件（用于状态管理）
 */
export interface ToolEvent {
  id: string;              // toolCallId
  name: string;            // 工具名称
  status: ToolEventStatus;
  phase: ToolPhase;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: number;       // 事件时间戳
  runId: string;           // 所属运行 ID
  sessionKey?: string;     // 所属会话
}

/**
 * 会话中的工具事件列表
 */
export interface ConversationToolEvents {
  conversationId: number;
  events: ToolEvent[];
}

/**
 * 工具名称映射表（用于友好显示）
 */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'read': '📖 读取文件',
  'write': '✏️ 写入文件',
  'exec': '🔨 执行命令',
  'search': '🔍 搜索',
  'web_search': '🌐 网页搜索',
  'web_fetch': '📄 获取网页',
  'functions.read': '📖 读取文件',
  'functions.write': '✏️ 写入文件',
  'functions.exec': '🔨 执行命令',
  'functions.search': '🔍 搜索',
};

/**
 * 获取工具的友好显示名称
 */
export function getToolDisplayName(name: string): string {
  return TOOL_DISPLAY_NAMES[name] || name;
}

/**
 * 工具图标映射表
 */
export const TOOL_ICONS: Record<string, string> = {
  'read': '📖',
  'write': '✏️',
  'exec': '🔨',
  'search': '🔍',
  'web_search': '🌐',
  'web_fetch': '📄',
};

/**
 * 获取工具图标
 */
export function getToolIcon(name: string): string {
  // 处理 functions.read 格式
  const baseName = name.replace('functions.', '');
  return TOOL_ICONS[baseName] || '🔧';
}

/**
 * 将 AgentEventPayload 转换为 ToolEvent
 */
export function convertToToolEvent(payload: AgentEventPayload): ToolEvent {
  const data = payload.data as ToolEventData;

  let status: ToolEventStatus = 'pending';
  if (data.phase === 'start') {
    status = 'running';
  } else if (data.phase === 'result') {
    status = data.isError ? 'error' : 'success';
  }

  return {
    id: data.toolCallId,
    name: data.name,
    status,
    phase: data.phase,
    args: data.args,
    result: data.result,
    error: data.isError ? '执行失败' : undefined,
    timestamp: payload.ts,
    runId: payload.runId,
    sessionKey: payload.sessionKey,
  };
}
