#!/usr/bin/env node
/**
 * 验证修复后的 OpenClaw 服务启动
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('=== 测试 OpenClaw 服务启动修复 ===');

// 测试使用正确的参数启动 OpenClaw
const openclawPath = path.join(__dirname, '../lib/openclaw/openclaw.mjs');
const port = 18791;

const env = {
  ...process.env,
  OPENCLAW_MODE: 'embedded',
  OPENCLAW_GATEWAY_BIND: '127.0.0.1', // 这里可能会有问题
  OPENCLAW_GATEWAY_PORT: String(port),
  OPENCLAW_LOG_LEVEL: 'info',
  OPENCLAW_HIDE_BANNER: '1',
  NODE_NO_WARNINGS: '1'
};

// 使用正确的参数
const args = ['gateway', 'run', '--bind', 'loopback', '--port', String(port), '--force'];

console.log(`尝试启动 OpenClaw: node ${openclawPath} ${args.join(' ')}`);

const child = spawn('node', [openclawPath, ...args], {
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: path.dirname(openclawPath)
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  const output = data.toString();
  stdout += output;
  console.log(`[STDOUT] ${output.trim()}`);
});

child.stderr.on('data', (data) => {
  const output = data.toString();
  stderr += output;
  console.error(`[STDERR] ${output.trim()}`);
});

child.on('error', (error) => {
  console.error('进程启动失败:', error.message);
});

child.on('close', (code) => {
  console.log(`进程退出，代码: ${code}`);
  console.log('--- STDOUT ---');
  console.log(stdout);
  console.log('--- STDERR ---');
  console.log(stderr);

  if (code === 0 || code === null) {
    console.log('✅ 服务成功启动或仍在运行');
  } else {
    console.log('❌ 服务启动失败');
  }
});

// 5秒后检查端口是否在监听
setTimeout(() => {
  const net = require('net');
  const client = new net.Socket();

  client.setTimeout(2000);
  client.connect(port, 'localhost', () => {
    console.log(`✅ 端口 ${port} 正在监听`);
    client.destroy();
  });

  client.on('timeout', () => {
    console.log(`❌ 端口 ${port} 未响应`);
    client.destroy();
  });

  client.on('error', (err) => {
    console.log(`❌ 端口 ${port} 连接失败:`, err.message);
    client.destroy();
  });
}, 5000);