#!/usr/bin/env node
/**
 * X-Claw 内置 Claw 启动器 - 入口
 * 用于将进程名设置为 clawstation-engine，避免与外部 Claw 冲突
 */

// 设置进程名（这会显示在 ps 命令中）
process.title = process.env.OPENCLAW_PROCESS_NAME || 'clawstation-engine';

// 平台处理器
const unixLauncher = require('./claw-launcher/unix');
const win32Launcher = require('./claw-launcher/win32');
const common = require('./claw-launcher/common');

// 解析参数
const { openclawPath, args } = common.parseArgs();

// 设置环境
common.setupEnvironment();

// 根据平台选择启动方式
if (process.platform === 'win32') {
  win32Launcher.launch(openclawPath, args);
} else {
  unixLauncher.launch(openclawPath, args);
}
