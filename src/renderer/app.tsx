/**
 * App 组件
 * 应用主组件，整合所有页面和功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChatPage } from './pages';
import SettingsModal from './pages/settings';
import { useUserStore } from './stores';

// Toast 类型
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

/**
 * Toast 容器组件
 */
const ToastContainer: React.FC<{
  toasts: Toast[];
  onRemove: (id: string) => void;
}> = ({ toasts, onRemove }) => {
  useEffect(() => {
    // 自动移除 toast
    const timers = toasts.map((toast) =>
      setTimeout(() => onRemove(toast.id), 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onRemove]);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {toast.type === 'success' ? (
              <>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </>
            )}
          </svg>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * 启动画面组件
 */
const SplashScreen: React.FC<{
  isVisible: boolean;
  status: string;
  progress: number;
  currentStep: string;
}> = ({ isVisible, status, progress, currentStep }) => {
  if (!isVisible) return null;

  const steps = [
    { key: 'database', label: '数据库' },
    { key: 'security', label: '安全服务' },
    { key: 'ai', label: 'AI引擎' },
    { key: 'ready', label: '准备就绪' },
  ];

  const getStepClass = (stepKey: string) => {
    const stepOrder = steps.findIndex((s) => s.key === stepKey);
    const currentOrder = steps.findIndex((s) => s.key === currentStep);

    if (stepKey === currentStep) return 'active';
    if (stepOrder < currentOrder) return 'completed';
    return '';
  };

  return (
    <div className="splash-screen" id="splashScreen">
      <div className="splash-content">
        <div className="splash-logo">
          <div className="splash-logo-icon">C</div>
          <h1 className="splash-title">ClawStation</h1>
        </div>
        <div className="splash-progress-container">
          <div
            className="splash-progress-bar"
            id="splashProgressBar"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="splash-status" id="splashStatus">
          {status}
        </div>
        <div className="splash-steps" id="splashSteps">
          {steps.map((step) => (
            <div key={step.key} className={`splash-step ${getStepClass(step.key)}`} data-step={step.key}>
              {step.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 审计日志模态框组件
 */
const AuditLogModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      let result;
      if (filter) {
        result = await window.electronAPI.getAuditLogsByAction(filter, 100);
      } else {
        result = await window.electronAPI.getAuditLogs({ limit: 100 });
      }
      if (result.success && result.logs) {
        setLogs(result.logs);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const exportLogs = async () => {
    try {
      const result = await window.electronAPI.exportAuditLogs({ format: 'json', limit: 1000 });
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen, loadLogs]);

  if (!isOpen) return null;

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">审计日志</h3>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="audit-toolbar">
            <select className="form-select audit-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">所有操作</option>
              <option value="USER_LOGIN">用户登录</option>
              <option value="USER_LOGOUT">用户登出</option>
              <option value="USER_CREATE">用户创建</option>
              <option value="USER_UPDATE">用户更新</option>
              <option value="CONVERSATION_CREATE">创建会话</option>
              <option value="CONVERSATION_DELETE">删除会话</option>
              <option value="MESSAGE_SEND">发送消息</option>
            </select>
            <button className="btn btn-sm" onClick={loadLogs} disabled={loading}>
              刷新
            </button>
            <button className="btn btn-sm btn-primary" onClick={exportLogs}>
              导出
            </button>
          </div>

          <div className="audit-table-container">
            {loading ? (
              <div className="audit-loading">加载中...</div>
            ) : logs.length === 0 ? (
              <div className="audit-empty">暂无审计日志</div>
            ) : (
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>操作</th>
                    <th>级别</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="audit-time">{formatTimestamp(log.timestamp)}</td>
                      <td className="audit-action">{log.action}</td>
                      <td>
                        <span className={`audit-level ${log.level}`}>{log.level}</span>
                      </td>
                      <td className="audit-details" title={log.details || ''}>
                        {escapeHtml(log.details || '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * App 主组件
 */
export const App: React.FC = () => {
  const { initializeUser, loading: userLoading } = useUserStore();
  const [appReady, setAppReady] = useState(false);
  const [splashStatus, setSplashStatus] = useState('正在初始化...');
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashStep, setSplashStep] = useState('database');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'engine' | 'ai' | 'appearance' | 'account' | 'about'>('general');
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 显示 toast
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  // 移除 toast
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 初始化应用
  useEffect(() => {
    const init = async () => {
      try {
        // 数据库
        setSplashStep('database');
        setSplashStatus('正在连接数据库...');
        setSplashProgress(10);
        await new Promise((resolve) => setTimeout(resolve, 300));

        setSplashProgress(30);
        await initializeUser();

        // 安全服务
        setSplashStep('security');
        setSplashStatus('正在初始化安全服务...');
        setSplashProgress(50);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // AI引擎
        setSplashStep('ai');
        setSplashStatus('正在启动AI引擎...');
        setSplashProgress(70);

        // 等待 OpenClaw 就绪
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.log('[ClawStation] OpenClaw ready timeout');
            resolve();
          }, 3000);

          window.electronAPI?.onOpenClawReady?.(() => {
            clearTimeout(timeout);
            resolve();
          });
        });

        // 准备就绪
        setSplashStep('ready');
        setSplashStatus('准备就绪');
        setSplashProgress(100);
        await new Promise((resolve) => setTimeout(resolve, 500));

        setAppReady(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setSplashStatus('初始化失败，请刷新重试');
      }
    };

    init();
  }, [initializeUser]);

  // 监听打开设置事件
  useEffect(() => {
    const handleOpenSettings = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tab) {
        setSettingsInitialTab(customEvent.detail.tab);
      } else {
        setSettingsInitialTab('general');
      }
      setSettingsOpen(true);
    };
    const handleOpenAuditLog = () => setAuditLogOpen(true);

    window.addEventListener('open-settings', handleOpenSettings);
    window.addEventListener('open-audit-log', handleOpenAuditLog);

    return () => {
      window.removeEventListener('open-settings', handleOpenSettings);
      window.removeEventListener('open-audit-log', handleOpenAuditLog);
    };
  }, []);

  return (
    <>
      {/* 启动画面 */}
      <SplashScreen
        isVisible={!appReady}
        status={splashStatus}
        progress={splashProgress}
        currentStep={splashStep}
      />

      {/* 主应用 */}
      {appReady && (
        <>
          <ChatPage />

          {/* 设置模态框 */}
          <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onShowToast={showToast} initialTab={settingsInitialTab} />

          {/* 审计日志模态框 */}
          <AuditLogModal isOpen={auditLogOpen} onClose={() => setAuditLogOpen(false)} />

          {/* Toast 提示 */}
          <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
      )}
    </>
  );
};

export default App;
