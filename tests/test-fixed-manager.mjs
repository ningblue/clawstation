/**
 * 测试修复后的 OpenClawManager
 */
import { OpenClawManager } from '../src/backend/services/openclaw.service';

async function testFixedOpenClawManager() {
  console.log('=== 测试修复后的 OpenClawManager ===');

  // 创建 OpenClawManager 实例，使用 18792 端口避免冲突
  const manager = new OpenClawManager({
    port: 18792,  // 使用不同的端口进行测试
    bindAddress: '127.0.0.1',
    logLevel: 'info',
    startupTimeoutMs: 15000,
    healthCheckTimeoutMs: 5000
  });

  try {
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

    // 即使启动失败，也要尝试停止服务
    try {
      manager.stop();
    } catch (stopErr) {
      console.error('停止服务时出错:', stopErr.message);
    }
  }
}

// 在非 ES 模块环境中运行测试
testFixedOpenClawManager().catch(console.error);