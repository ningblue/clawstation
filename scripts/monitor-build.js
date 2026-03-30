#!/usr/bin/env node

/**
 * ClawStation Build Monitor
 * 定期检查 GitHub Actions 构建状态，发现问题及时通知
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const REPO_OWNER = 'ningblue';
const REPO_NAME = 'clawstation';
const GITHUB_API = 'https://api.github.com';

// 读取 GitHub token（如果有的话）
let githubToken = process.env.GITHUB_TOKEN;
const tokenFile = path.join(__dirname, '.github-token');
if (!githubToken && fs.existsSync(tokenFile)) {
  githubToken = fs.readFileSync(tokenFile, 'utf-8').trim();
}

// 状态文件
const stateFile = path.join(__dirname, '.build-monitor-state.json');

function loadState() {
  if (fs.existsSync(stateFile)) {
    return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  }
  return { lastCheck: null, failedRuns: [], notifiedRuns: [] };
}

function saveState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function makeRequest(urlString) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlString);
    
    // 检查是否有代理配置
    const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;
    
    let req;
    
    if (proxyUrl) {
      // 使用代理
      const proxyParsed = new URL(proxyUrl);
      const proxyPort = proxyParsed.port || (proxyParsed.protocol === 'https:' ? 443 : 80);
      
      const proxyReq = http.request({
        host: proxyParsed.hostname,
        port: proxyPort,
        method: 'CONNECT',
        path: `${parsedUrl.hostname}:443`,
        headers: {
          'Host': parsedUrl.hostname
        }
      });

      proxyReq.on('connect', (res, socket) => {
        if (res.statusCode === 200) {
          // 建立了隧道连接
          const options = {
            socket: socket,
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
              'User-Agent': 'ClawStation-Build-Monitor/1.0',
              'Accept': 'application/vnd.github.v3+json',
              'Host': parsedUrl.hostname
            }
          };
          
          if (githubToken) {
            options.headers['Authorization'] = `token ${githubToken}`;
          }

          req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  resolve(JSON.parse(data));
                } catch (e) {
                  reject(new Error(`JSON parse error: ${e.message}`));
                }
              } else if (res.statusCode === 403) {
                reject(new Error('API rate limit exceeded. Consider setting GITHUB_TOKEN.'));
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              }
            });
          });
          
          req.on('error', reject);
          req.end();
        } else {
          reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
        }
      });

      proxyReq.on('error', reject);
      proxyReq.end();
    } else {
      // 不使用代理，直接连接
      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'ClawStation-Build-Monitor/1.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      if (githubToken) {
        options.headers['Authorization'] = `token ${githubToken}`;
      }

      req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`JSON parse error: ${e.message}`));
            }
          } else if (res.statusCode === 403) {
            reject(new Error('API rate limit exceeded. Consider setting GITHUB_TOKEN.'));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    }
  });
}

async function checkWorkflowRuns() {
  const url = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs?per_page=20`;
  const data = await makeRequest(url);
  return data.workflow_runs || [];
}

function analyzeRuns(runs, state) {
  const now = new Date();
  const issues = [];
  const newFailedRuns = [];

  for (const run of runs) {
    // 只检查最近的运行（24小时内）
    const runTime = new Date(run.created_at);
    const hoursAgo = (now - runTime) / (1000 * 60 * 60);
    
    if (hoursAgo > 24) continue;

    // 检查失败的运行
    if (run.conclusion === 'failure' && !state.notifiedRuns.includes(run.id)) {
      newFailedRuns.push({
        id: run.id,
        name: run.name,
        head_branch: run.head_branch,
        head_sha: run.head_sha,
        created_at: run.created_at,
        html_url: run.html_url,
        message: run.head_commit?.message || 'No commit message'
      });
    }

    // 检查长时间运行的构建（超过30分钟）
    if (run.status === 'in_progress' && hoursAgo > 0.5) {
      issues.push({
        type: 'stuck',
        id: run.id,
        name: run.name,
        duration: Math.round(hoursAgo * 60),
        html_url: run.html_url
      });
    }
  }

  return { newFailedRuns, issues };
}

function formatNotification(newFailedRuns, issues) {
  const messages = [];

  if (newFailedRuns.length > 0) {
    messages.push('🚨 **构建失败警告**\n');
    for (const run of newFailedRuns) {
      messages.push(`❌ **${run.name}** 失败`);
      messages.push(`   分支: ${run.head_branch}`);
      messages.push(`   提交: ${run.message.split('\n')[0]}`);
      messages.push(`   时间: ${new Date(run.created_at).toLocaleString('zh-CN')}`);
      messages.push(`   链接: ${run.html_url}\n`);
    }
  }

  if (issues.length > 0) {
    if (messages.length > 0) messages.push('\n');
    messages.push('⚠️ **构建异常警告**\n');
    for (const issue of issues) {
      if (issue.type === 'stuck') {
        messages.push(`⏳ **${issue.name}** 运行超过 ${issue.duration} 分钟`);
        messages.push(`   链接: ${issue.html_url}\n`);
      }
    }
  }

  return messages.length > 0 ? messages.join('\n') : null;
}

async function monitor() {
  console.log('🔍 检查 ClawStation 构建状态...\n');

  const state = loadState();
  
  try {
    const runs = await checkWorkflowRuns();
    const { newFailedRuns, issues } = analyzeRuns(runs, state);
    
    // 更新状态
    state.lastCheck = new Date().toISOString();
    state.notifiedRuns = [...state.notifiedRuns, ...newFailedRuns.map(r => r.id)];
    saveState(state);

    const notification = formatNotification(newFailedRuns, issues);
    
    if (notification) {
      console.log(notification);
      
      // 如果有新的失败，返回非零退出码以便 cron 检测
      if (newFailedRuns.length > 0) {
        process.exit(1);
      }
    } else {
      console.log('✅ 所有构建正常');
    }
  } catch (error) {
    console.error('❌ 监控失败:', error.message);
    process.exit(2);
  }
}

// 主函数
if (require.main === module) {
  monitor();
}

module.exports = { monitor, checkWorkflowRuns, analyzeRuns };
