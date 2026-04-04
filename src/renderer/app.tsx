/**
 * App 组件
 * 应用主组件，整合所有页面和功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChatPage } from './pages';
import SettingsModal from './pages/settings';
import { useUserStore } from './stores';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    const timers = toasts.map((toast) =>
      setTimeout(() => onRemove(toast.id), 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onRemove]);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-right-2',
            toast.type === 'success'
              ? 'border-border bg-popover text-foreground'
              : 'border-destructive/30 bg-popover text-destructive',
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="size-4 text-green-500 shrink-0" />
          ) : (
            <AlertCircle className="size-4 text-destructive shrink-0" />
          )}
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
}> = ({ isVisible, status, progress }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 w-72">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center size-14 rounded-xl bg-primary text-primary-foreground text-2xl font-bold">
            X
          </div>
          <h1 className="text-sm font-medium text-muted-foreground">{status}</h1>
        </div>
        <div className="w-full">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          首次初始化可能需要几分钟时间，请勿关闭窗口
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>审计日志</DialogTitle>
        </DialogHeader>

        {/* 工具栏 */}
        <div className="flex items-center gap-2 py-2">
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">所有操作</option>
            <option value="USER_LOGIN">用户登录</option>
            <option value="USER_LOGOUT">用户登出</option>
            <option value="USER_CREATE">用户创建</option>
            <option value="USER_UPDATE">用户更新</option>
            <option value="CONVERSATION_CREATE">创建会话</option>
            <option value="CONVERSATION_DELETE">删除会话</option>
            <option value="MESSAGE_SEND">发送消息</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            刷新
          </Button>
          <Button size="sm" onClick={exportLogs}>
            导出
          </Button>
        </div>

        {/* 表格 */}
        <div className="flex-1 overflow-auto -mx-4 -mb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              加载中...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              暂无审计日志
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-popover border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">时间</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">操作</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">级别</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">详情</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs">{log.action}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        'inline-flex rounded px-1.5 py-0.5 text-xs font-medium',
                        log.level === 'INFO' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        log.level === 'WARN' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                        log.level === 'ERROR' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      )}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-[300px] truncate" title={log.details || ''}>
                      {escapeHtml(log.details || '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  const [settingsInitialTab, setSettingsInitialTab] = useState<'engine' | 'ai' | 'appearance' | 'account' | 'about'>('engine');
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const STORAGE_KEY = 'clawstation_user_prefs';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prefs = JSON.parse(stored);
        if (prefs.theme === 'dark') {
          document.documentElement.classList.add('dark');
          document.body.classList.add('dark-theme');
        }
      }
    } catch (err) {
      console.error('Failed to load theme preference:', err);
    }
  }, []);

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
        setSplashStatus('正在初始化 XClaw，请稍后');
        setSplashProgress(15);
        await new Promise((resolve) => setTimeout(resolve, 300));

        setSplashProgress(35);
        await initializeUser();

        // 安全服务
        setSplashStep('security');
        setSplashStatus('正在初始化 XClaw，请稍后');
        setSplashProgress(55);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // AI引擎
        setSplashStep('ai');
        setSplashStatus('正在初始化 XClaw，请稍后');
        setSplashProgress(75);

        // 等待 OpenClaw 就绪
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.log('[XClaw] OpenClaw ready timeout');
            resolve();
          }, 3000);

          window.electronAPI?.onOpenClawReady?.(() => {
            clearTimeout(timeout);
            resolve();
          });
        });

        // 准备就绪
        setSplashStep('ready');
        setSplashStatus('正在初始化 XClaw，请稍后');
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
        setSettingsInitialTab('engine');
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
