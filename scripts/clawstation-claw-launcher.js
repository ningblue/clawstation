#!/usr/bin/env node
/**
 * ClawStation 内置 Claw 启动器
 * 用于将进程名设置为 clawstation-claw，避免与外部 Claw 冲突
 */

// 设置进程名（这会显示在 ps 命令中）
process.title = process.env.OPENCLAW_PROCESS_NAME || 'clawstation-engine';

// 参数结构: node launcher.js <openclaw-path> <command> [args...]
// argv[0] = node 路径
// argv[1] = launcher.js 路径
// argv[2] = OpenClaw 路径 (index.js)
// argv[3...] = 命令和参数
const openclawPath = process.argv[2]; // 第三个参数是 OpenClaw 路径
const args = process.argv.slice(3);   // 其余参数是命令和参数

if (!openclawPath) {
  console.error('Error: OpenClaw path not provided');
  console.error('Usage: node clawstation-claw-launcher.js <openclaw-path> <command> [args...]');
  process.exit(1);
}

const { spawn } = require('child_process');

// 关键：设置 OPENCLAW_NO_RESPAWN=1 防止 OpenClaw 重新 spawn 进程
// 这样可以避免无限进程创建的问题
process.env.OPENCLAW_NO_RESPAWN = '1';

const processName = process.env.OPENCLAW_PROCESS_NAME || 'clawstation-engine';

let child;
if (process.platform === 'win32') {
  // Windows 的 cmd/powershell 不支持 `exec -a`，直接启动即可
  child = spawn(process.execPath, [openclawPath, ...args], {
    stdio: 'inherit',
    shell: false,
    env: process.env
  });
} else {
  // Unix-like 平台使用 exec -a 设置进程名
  const cmd = `exec -a "${processName}" "${process.execPath}" "${openclawPath}" ${args.map(a => `"${a}"`).join(' ')}`;
  child = spawn(cmd, [], {
    stdio: 'inherit',
    shell: true,
    env: process.env
  });
}


child.on('exit', (code, signal) => {
  process.exit(code || 0);
});
