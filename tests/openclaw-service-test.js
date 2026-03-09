#!/usr/bin/env node
/**
 * OpenClaw 服务测试脚本
 * 测试内容：
 * 1. 服务启动流程
 * 2. 健康检查接口
 * 3. AI 对话基础功能
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 测试配置
const CONFIG = {
  port: 18791,
  bindAddress: '127.0.0.1',
  openclawPath: path.join(__dirname, '../lib/openclaw/openclaw.mjs'),
  healthCheckTimeout: 5000,
  startupTimeout: 30000
};

// 测试结果
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '[ERROR]' : type === 'success' ? '[PASS]' : type === 'fail' ? '[FAIL]' : '[INFO]';
  console.log(`${timestamp} ${prefix} ${message}`);
}

function addResult(testName, passed, message = '') {
  results.tests.push({ name: testName, passed, message });
  if (passed) {
    results.passed++;
    log(`${testName}: ${message || 'PASSED'}`, 'success');
  } else {
    results.failed++;
    log(`${testName}: ${message || 'FAILED'}`, 'fail');
  }
}

// 测试 1: 检查 OpenClaw 可执行文件
async function testExecutableExists() {
  log('Testing OpenClaw executable path...');
  try {
    if (fs.existsSync(CONFIG.openclawPath)) {
      const stats = fs.statSync(CONFIG.openclawPath);
      addResult('Executable Path Check', true, `Found at ${CONFIG.openclawPath}, size: ${stats.size} bytes`);
      return true;
    } else {
      addResult('Executable Path Check', false, `Not found at ${CONFIG.openclawPath}`);
      return false;
    }
  } catch (error) {
    addResult('Executable Path Check', false, error.message);
    return false;
  }
}

// 测试 2: 检查端口是否可用
async function testPortAvailable() {
  log('Testing port availability...');
  return new Promise((resolve) => {
    const tester = require('net').createServer();
    tester.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        addResult('Port Availability Check', false, `Port ${CONFIG.port} is already in use`);
      } else {
        addResult('Port Availability Check', false, err.message);
      }
      resolve(false);
    });
    tester.once('listening', () => {
      tester.close(() => {
        addResult('Port Availability Check', true, `Port ${CONFIG.port} is available`);
        resolve(true);
      });
    });
    tester.listen(CONFIG.port, CONFIG.bindAddress);
  });
}

// 测试 3: 检查现有 OpenClaw 服务
async function testExistingService() {
  log('Testing existing OpenClaw service on port 18789...');
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:18789/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const health = JSON.parse(data);
            addResult('Existing Service Check', true, `Service running, status: ${JSON.stringify(health)}`);
          } catch {
            addResult('Existing Service Check', true, `Service running on port 18789 (HTML response)`);
          }
        } else {
          addResult('Existing Service Check', false, `HTTP ${res.statusCode}`);
        }
        resolve(true);
      });
    });
    req.on('error', (err) => {
      addResult('Existing Service Check', false, `No service on port 18789: ${err.message}`);
      resolve(false);
    });
    req.setTimeout(CONFIG.healthCheckTimeout, () => {
      req.destroy();
      addResult('Existing Service Check', false, 'Connection timeout');
      resolve(false);
    });
  });
}

// 测试 4: 启动 OpenClaw 服务
async function testStartService() {
  log('Testing OpenClaw service startup...');

  // 检查端口是否被占用
  const net = require('net');
  const portInUse = await new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(true));
    tester.once('listening', () => {
      tester.close(() => resolve(false));
    });
    tester.listen(CONFIG.port, CONFIG.bindAddress);
  });

  if (portInUse) {
    addResult('Service Startup', false, `Port ${CONFIG.port} is already in use`);
    return null;
  }

  return new Promise((resolve) => {
    const env = {
      ...process.env,
      OPENCLAW_MODE: 'embedded',
      OPENCLAW_GATEWAY_BIND: CONFIG.bindAddress,
      OPENCLAW_GATEWAY_PORT: String(CONFIG.port),
      OPENCLAW_LOG_LEVEL: 'info',
      OPENCLAW_HIDE_BANNER: '1',
      NODE_NO_WARNINGS: '1'
    };

    const args = ['gateway', 'run', '--bind', CONFIG.bindAddress, '--port', String(CONFIG.port)];

    log(`Spawning: node ${CONFIG.openclawPath} ${args.join(' ')}`);

    const child = spawn('node', [CONFIG.openclawPath, ...args], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(CONFIG.openclawPath),
      detached: false
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      log(`[OpenClaw stdout] ${data.toString().trim()}`);
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      log(`[OpenClaw stderr] ${data.toString().trim()}`);
    });

    child.on('error', (error) => {
      addResult('Service Startup', false, `Process error: ${error.message}`);
      resolve(null);
    });

    // 等待服务启动
    setTimeout(async () => {
      if (child.exitCode !== null) {
        addResult('Service Startup', false, `Process exited with code ${child.exitCode}`);
        resolve(null);
        return;
      }

      // 尝试健康检查
      const healthCheck = await new Promise((resolveHealth) => {
        const req = http.get(`http://${CONFIG.bindAddress}:${CONFIG.port}/health`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const health = JSON.parse(data);
                resolveHealth({ success: true, data: health });
              } catch {
                resolveHealth({ success: true, data: data });
              }
            } else {
              resolveHealth({ success: false, status: res.statusCode, data });
            }
          });
        });
        req.on('error', (err) => {
          resolveHealth({ success: false, error: err.message });
        });
        req.setTimeout(CONFIG.healthCheckTimeout, () => {
          req.destroy();
          resolveHealth({ success: false, error: 'Timeout' });
        });
      });

      if (healthCheck.success) {
        addResult('Service Startup', true, `PID: ${child.pid}, Health: ${JSON.stringify(healthCheck.data)}`);
      } else {
        addResult('Service Startup', false, `Health check failed: ${healthCheck.error || healthCheck.status}`);
      }

      // 停止服务
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
        resolve(child);
      }, 2000);
    }, 5000);
  });
}

// 测试 5: 检查 IPC 路由配置
async function testIPCRoutes() {
  log('Testing IPC route configuration...');
  try {
    const routePath = path.join(__dirname, '../src/api/routes/openclaw.route.ts');
    if (fs.existsSync(routePath)) {
      const content = fs.readFileSync(routePath, 'utf8');
      const hasStatusHandler = content.includes('openclaw:status');
      const hasQueryHandler = content.includes('openclaw:query');
      const hasRestartHandler = content.includes('openclaw:restart');

      addResult('IPC Route Configuration', hasStatusHandler && hasQueryHandler && hasRestartHandler,
        `Status: ${hasStatusHandler}, Query: ${hasQueryHandler}, Restart: ${hasRestartHandler}`);
      return true;
    } else {
      addResult('IPC Route Configuration', false, `Route file not found: ${routePath}`);
      return false;
    }
  } catch (error) {
    addResult('IPC Route Configuration', false, error.message);
    return false;
  }
}

// 测试 6: 检查 OpenClawManager 实现
async function testOpenClawManager() {
  log('Testing OpenClawManager implementation...');
  try {
    const servicePath = path.join(__dirname, '../src/backend/services/openclaw.service.ts');
    if (fs.existsSync(servicePath)) {
      const content = fs.readFileSync(servicePath, 'utf8');
      const hasStart = content.includes('async start()');
      const hasStop = content.includes('stop()');
      const hasHealthCheck = content.includes('performHealthCheck');
      const hasSendQuery = content.includes('sendQuery');
      const hasStreamQuery = content.includes('sendQueryStream');

      addResult('OpenClawManager Implementation',
        hasStart && hasStop && hasHealthCheck && hasSendQuery && hasStreamQuery,
        `Start: ${hasStart}, Stop: ${hasStop}, Health: ${hasHealthCheck}, Query: ${hasSendQuery}, Stream: ${hasStreamQuery}`);
      return true;
    } else {
      addResult('OpenClawManager Implementation', false, `Service file not found: ${servicePath}`);
      return false;
    }
  } catch (error) {
    addResult('OpenClawManager Implementation', false, error.message);
    return false;
  }
}

// 主测试函数
async function runTests() {
  log('========================================');
  log('OpenClaw Service Test Suite Starting...');
  log('========================================');

  const startTime = Date.now();

  // 执行测试
  await testExecutableExists();
  await testPortAvailable();
  await testExistingService();
  await testIPCRoutes();
  await testOpenClawManager();

  // 只有在端口可用的情况下才启动服务测试
  const portAvailable = results.tests.find(t => t.name === 'Port Availability Check')?.passed;
  if (portAvailable) {
    await testStartService();
  } else {
    log('Skipping service startup test - port not available', 'error');
  }

  const duration = Date.now() - startTime;

  // 输出测试报告
  log('========================================');
  log('Test Report');
  log('========================================');
  log(`Total Tests: ${results.tests.length}`);
  log(`Passed: ${results.passed}`, 'success');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'fail' : 'info');
  log(`Duration: ${duration}ms`);
  log('');
  log('Detailed Results:');
  results.tests.forEach(test => {
    const status = test.passed ? '✓' : '✗';
    const type = test.passed ? 'success' : 'fail';
    log(`  ${status} ${test.name}: ${test.message}`, type);
  });

  log('========================================');

  // 返回退出码
  process.exit(results.failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(error => {
  log(`Test suite failed: ${error.message}`, 'error');
  process.exit(1);
});
