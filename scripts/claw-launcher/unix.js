/**
 * Claw 启动器 - Unix 平台 (macOS/Linux)
 * 使用 exec -a 设置进程名
 */
const { spawn } = require('child_process');
const common = require('./common');

/**
 * 启动 OpenClaw 进程
 */
function launch(openclawPath, args) {
  common.setupEnvironment();

  const processName = common.getProcessName();

  // Unix-like 平台使用 exec -a 设置进程名
  const quotedArgs = args.map(a => `"${a}"`).join(' ');
  const cmd = `exec -a "${processName}" "${process.execPath}" "${openclawPath}" ${quotedArgs}`;

  console.log(`[Unix] Launching: ${cmd}`);

  const child = spawn(cmd, [], {
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  child.on('exit', (code, signal) => {
    process.exit(code || 0);
  });

  child.on('error', (err) => {
    console.error('[Unix] Failed to launch:', err.message);
    process.exit(1);
  });
}

module.exports = {
  launch,
};
