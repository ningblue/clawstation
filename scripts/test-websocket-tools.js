/**
 * 测试 WebSocket 方案是否能收到 tool events
 * 使用正确的认证流程：先接收 connect.challenge，再发送 connect
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// 从配置文件读取 token
function getToken() {
  const configPath = path.join(process.env.HOME, '.clawstation/openclaw.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.gateway?.auth?.token || '';
  } catch {
    return '';
  }
}

const TOKEN = getToken();
const HOST = '127.0.0.1';
const PORT = 18791;

let ws = null;
let connId = null;
let messageId = 1;
let connectNonce = null;
let connectResolve = null;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function connect() {
  return new Promise((resolve, reject) => {
    const wsUrl = `ws://${HOST}:${PORT}`;
    log(`Connecting to ${wsUrl}...`);

    ws = new WebSocket(wsUrl, {
      headers: {
        'Origin': 'http://localhost:18791'
      }
    });
    let connectTimeout;

    ws.on('open', () => {
      log('WebSocket connected, waiting for connect.challenge...');

      // 设置连接超时
      connectTimeout = setTimeout(() => {
        reject(new Error('Connect timeout: no challenge received'));
      }, 10000);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(msg, resolve, reject);
      } catch (err) {
        log('Failed to parse message:', err.message);
      }
    });

    ws.on('close', (code, reason) => {
      clearTimeout(connectTimeout);
      log(`WebSocket closed: ${code} ${reason}`);
      if (!connId) {
        reject(new Error(`Connection closed before auth: ${code}`));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(connectTimeout);
      log('WebSocket error:', err.message);
      reject(err);
    });
  });
}

function sendConnectRequest() {
  const connectReq = {
    type: 'req',
    id: `conn_${Date.now()}`,
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'webchat',
        version: '1.0.0',
        platform: process.platform,
        mode: 'webchat'
      },
      caps: ['tool-events'],
      role: 'operator',
      scopes: ['operator.admin'],
      auth: { token: TOKEN }
    }
  };

  log('Sending connect request...');
  ws.send(JSON.stringify(connectReq));
}

function handleMessage(msg, resolveConnect, rejectConnect) {
  // 处理 challenge 事件
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    connectNonce = msg.payload?.nonce;
    log(`Received connect.challenge, nonce: ${connectNonce}`);

    if (!connectNonce) {
      rejectConnect(new Error('No nonce in challenge'));
      return;
    }

    // 发送 connect 请求
    sendConnectRequest();
    return;
  }

  // 处理连接响应
  if (msg.type === 'res' && msg.id?.startsWith('conn_')) {
    if (msg.ok && msg.payload?.server?.connId) {
      connId = msg.payload.server.connId;
      log(`✅ Connected! connId: ${connId}`);
      resolveConnect();
    } else {
      rejectConnect(new Error(`Connect failed: ${msg.error?.message || 'unknown'}`));
    }
    return;
  }

  // 处理 agent 事件（包含 tool events）
  if (msg.type === 'event' && msg.event === 'agent') {
    const payload = msg.payload;

    if (payload.stream === 'tool') {
      const data = payload.data || {};
      log(`\n🔧 TOOL EVENT:`);
      log(`   runId: ${payload.runId}`);
      log(`   phase: ${data.phase}`);
      log(`   name: ${data.name}`);
      log(`   toolCallId: ${data.toolCallId}`);
      if (data.args) log(`   args:`, JSON.stringify(data.args, null, 2));
      if (data.result) log(`   result:`, JSON.stringify(data.result, null, 2));
      if (data.isError) log(`   ❌ ERROR!`);
      return;
    }

    if (payload.stream === 'assistant') {
      const text = payload.data?.text || payload.data?.delta || '';
      process.stdout.write(text);
      return;
    }

    if (payload.stream === 'lifecycle') {
      const phase = payload.data?.phase;
      log(`\n📊 Lifecycle: ${phase}`);
      if (phase === 'end' || phase === 'error') {
        log('\n✅ Run completed');
        setTimeout(() => process.exit(0), 1000);
      }
      return;
    }

    log(`📨 Agent event [${payload.stream}]:`, JSON.stringify(payload.data, null, 2));
    return;
  }

  // 其他消息
  if (msg.type !== 'event' || msg.event !== 'tick') {
    log('📥 Message:', msg.type, msg.event || '', JSON.stringify(msg.payload || {}).substring(0, 200));
  }
}

function sendChat(message) {
  return new Promise((resolve, reject) => {
    if (!connId) {
      reject(new Error('Not connected'));
      return;
    }

    const reqId = `chat_${Date.now()}`;
    const chatReq = {
      type: 'req',
      id: reqId,
      method: 'chat.send',
      params: {
        message: message,
        sessionKey: `test-${Date.now()}`,
        idempotencyKey: `test-${Date.now()}`
      }
    };

    log(`\n🚀 Sending chat.send: "${message.substring(0, 50)}..."`);

    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'res' && msg.id === reqId) {
          ws.off('message', handler);
          if (msg.ok) {
            log(`✅ Chat request accepted, runId: ${msg.payload?.runId}`);
            resolve(msg.payload?.runId);
          } else {
            reject(new Error(msg.error?.message || 'Chat request failed'));
          }
        }
      } catch {}
    };

    ws.on('message', handler);
    ws.send(JSON.stringify(chatReq));
  });
}

async function main() {
  try {
    if (!TOKEN) {
      log('❌ Error: No token found in ~/.clawstation/openclaw.json');
      process.exit(1);
    }

    // 1. 连接 WebSocket（等待 challenge 并完成认证）
    await connect();

    // 2. 发送一条需要工具调用的消息
    const testMessage = '给我实现一个烟花的页面';
    await sendChat(testMessage);

    log('\n⏳ Waiting for tool events (timeout: 60s)...\n');

    // 3. 等待事件（脚本会在收到 lifecycle:end 后退出）
    setTimeout(() => {
      log('\n⏰ Timeout! No completion event received.');
      process.exit(1);
    }, 60000);

  } catch (err) {
    log('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
