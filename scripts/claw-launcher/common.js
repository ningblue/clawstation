/**
 * Claw 启动器 - 共享模块
 */

/**
 * 获取进程名
 */
function getProcessName() {
  return process.env.OPENCLAW_PROCESS_NAME || 'clawstation-engine';
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  // argv[0] = node 路径
  // argv[1] = launcher.js 路径
  // argv[2] = OpenClaw 路径 (index.js)
  // argv[3...] = 命令和参数
  const openclawPath = process.argv[2];
  const args = process.argv.slice(3);

  if (!openclawPath) {
    console.error('Error: OpenClaw path not provided');
    console.error('Usage: node clawstation-claw-launcher.js <openclaw-path> <command> [args...]');
    process.exit(1);
  }

  return { openclawPath, args };
}

/**
 * 设置环境变量
 */
function setupEnvironment() {
  // 关键：设置 OPENCLAW_NO_RESPAWN=1 防止 OpenClaw 重新 spawn 进程
  process.env.OPENCLAW_NO_RESPAWN = '1';
}

module.exports = {
  getProcessName,
  parseArgs,
  setupEnvironment,
};
