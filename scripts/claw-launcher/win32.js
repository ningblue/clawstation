/**
 * Claw 启动器 - Windows 平台
 * Windows 不支持 exec -a，直接 spawn
 */
const { spawn } = require('child_process');
const common = require('./common');

/**
 * 启动 OpenClaw 进程
 */
function launch(openclawPath, args) {
  common.setupEnvironment();

  const processName = common.getProcessName();

  console.log(`[Windows] Launching: ${process.execPath} ${openclawPath} ${args.join(' ')}`);

  // Windows 直接启动，通过 process.title 设置进程名
  const child = spawn(process.execPath, [openclawPath, ...args], {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      OPENCLAW_PROCESS_NAME: processName
    }
  });

  child.on('exit', (code, signal) => {
    process.exit(code || 0);
  });

  child.on('error', (err) => {
    console.error('[Windows] Failed to launch:', err.message);
    process.exit(1);
  });
}

module.exports = {
  launch,
};
