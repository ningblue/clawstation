/**
 * 测试修复后的 OpenClawManager
 */
const path = require('path');
const { spawn } = require('child_process');

// 使用动态导入来加载 ES 模块
async function testFixedOpenClawManager() {
  console.log('=== 测试修复后的 OpenClawManager ===');

  try {
    // 动态导入 OpenClawManager
    const { OpenClawManager } = await import('./src/backend/services/openclaw.service.ts');

    // 创建 OpenClawManager 实例，使用 18792 端口避免冲突
    const manager = new OpenClawManager({
      port: 18792,  // 使用不同的端口进行测试
      bindAddress: '127.0.0.1',
      logLevel: 'info',
      startupTimeoutMs: 15000,
      healthCheckTimeoutMs: 5000
    });

    console.log('1. 尝试启动 OpenClaw 服务...');
    await manager.start();
    console.log('✅ 服务启动成功！');

    console.log('2. 检查服务状态...');
    const status = await manager.getStatus();
    console.log('状态:', status);

    if (status.isRunning && status.isHealthy) {
      console.log('✅ 服务正在运行且健康！');

      // 测试简单查询
      console.log('3. 测试基础对话功能...');
      try {
        const response = await manager.sendQuery({
          message: 'Hello, are you working?',
          model: 'default'
        });
        console.log('响应:', response);
        console.log('✅ 对话功能测试成功！');
      } catch (queryErr) {
        console.log('⚠️ 对话功能测试失败（可能是因为模型未配置）:', queryErr.message);
      }
    } else {
      console.log('⚠️ 服务未完全就绪:', status);
    }

    console.log('4. 停止服务...');
    manager.stop();
    console.log('✅ 服务已停止');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('堆栈:', error.stack);

    // 注意：如果 manager 已经定义但未完全初始化，这里会报错
    // 但在这种情况下我们跳过停止步骤
  }
}

// 运行测试
testFixedOpenClawManager().catch(console.error);