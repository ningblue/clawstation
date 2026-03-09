#!/usr/bin/env node
/**
 * X-Claw 内置 OpenClaw 启动器
 * 用于将进程名设置为 clawstation-openclaw，避免与外部 OpenClaw 冲突
 */

// 设置进程名
process.title = 'clawstation-openclaw';

// 移除第一个参数（脚本路径），将剩余参数传递给 OpenClaw
const args = process.argv.slice(2);
const { spawn } = require('child_process');

const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  detached: false
});

child.on('exit', (code, signal) => {
  process.exit(code || 0);
});
