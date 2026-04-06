/**
 * Settings 页面
 * 设置页面，左侧菜单导航，右侧内容展示
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserStore } from '../../stores';
import type { Theme, FontSize, Locale } from '../../stores';
import StandaloneAIModelSettings from './AIModelSettings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// 设置标签页类型
type SettingsTab = 'engine' | 'ai' | 'appearance' | 'account' | 'about';

// 左侧菜单项配置
const SETTINGS_MENU = [
  { id: 'appearance' as const, label: '外观', icon: 'palette' },
  { id: 'engine' as const, label: 'AI 引擎', icon: 'cpu' },
  { id: 'ai' as const, label: 'AI 模型', icon: 'brain' },
  { id: 'account' as const, label: '账户', icon: 'user' },
  { id: 'about' as const, label: '关于', icon: 'info' },
];

// 导出设置模态框打开事件类型
export interface OpenSettingsEventDetail {
  tab?: SettingsTab;
}

/**
 * 外观设置面板
 */
interface AppearanceSettingsProps {
  preferences: {
    theme: Theme;
    fontSize: FontSize;
    locale: Locale;
  };
  onUpdatePreferences: (prefs: Partial<{ theme: Theme; fontSize: FontSize; locale: Locale }>) => void;
}

const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  preferences,
  onUpdatePreferences,
}) => {
  return (
    <div className="animate-in fade-in duration-200">
      <div className="text-xl font-semibold text-foreground mb-5">外观设置</div>

      {/* 主题选择 */}
      <div className="mb-6">
        <div className="text-sm font-medium text-muted-foreground mb-3">主题</div>
        <div className="grid grid-cols-2 gap-3">
          <div
            className={cn(
              "cursor-pointer rounded-xl border-2 p-3 transition-all hover:border-primary/50",
              preferences.theme === 'light' && "border-primary bg-primary/5"
            )}
            onClick={() => onUpdatePreferences({ theme: 'light' })}
          >
            <div className="rounded-lg overflow-hidden mb-2 border border-border">
              <div className="h-4 bg-muted-foreground/10 border-b border-border" />
              <div className="flex h-16">
                <div className="w-10 bg-muted border-r border-border" />
                <div className="flex-1 p-1.5 space-y-1">
                  <div className="h-1.5 w-3/4 bg-muted rounded" />
                  <div className="h-1.5 w-1/2 bg-muted rounded" />
                </div>
              </div>
            </div>
            <div className="text-sm font-medium text-center">明亮</div>
          </div>
          <div
            className={cn(
              "cursor-pointer rounded-xl border-2 p-3 transition-all hover:border-primary/50",
              preferences.theme === 'dark' && "border-primary bg-primary/5"
            )}
            onClick={() => onUpdatePreferences({ theme: 'dark' })}
          >
            <div className="rounded-lg overflow-hidden mb-2 border border-border bg-popover">
              <div className="h-4 bg-popover border-b border-border" />
              <div className="flex h-16">
                <div className="w-10 bg-muted border-r border-border" />
                <div className="flex-1 p-1.5 space-y-1">
                  <div className="h-1.5 w-3/4 bg-muted rounded" />
                  <div className="h-1.5 w-1/2 bg-muted rounded" />
                </div>
              </div>
            </div>
            <div className="text-sm font-medium text-center">暗黑</div>
          </div>
        </div>
      </div>

      {/* 字体大小 */}
      <div className="mb-6">
        <div className="text-sm font-medium text-muted-foreground mb-3">字体大小</div>
        <div className="flex gap-2">
          {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
            <Button
              key={size}
              variant={preferences.fontSize === size ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdatePreferences({ fontSize: size })}
              className="flex-1"
            >
              <span className={cn(
                "font-bold",
                size === 'small' && "text-xs",
                size === 'medium' && "text-sm",
                size === 'large' && "text-base"
              )}>
                Aa
              </span>
              <span className="ml-1.5">
                {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * AI引擎状态类型
 */
type EngineStatus = 'stopped' | 'starting' | 'running' | 'error' | 'restarting';

/**
 * 进程信息类型
 */
interface ProcessInfo {
  processName: string;
  pid: number;
  port: number;
}

/**
 * AI引擎设置面板（包含引擎控制和模型配置）
 */
interface AIEngineSettingsProps {
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

const AIEngineSettings: React.FC<AIEngineSettingsProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('stopped');
  const [engineError, setEngineError] = useState<string>('');
  const [processInfo, setProcessInfo] = useState<ProcessInfo | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  // 获取引擎状态显示信息
  const getEngineStatusInfo = useCallback((): { label: string; color: string; icon: string } => {
    switch (engineStatus) {
      case 'running':
        return { label: '运行中', color: '#22c55e', icon: '●' };
      case 'starting':
        return { label: '启动中...', color: '#f59e0b', icon: '◌' };
      case 'restarting':
        return { label: '重启中...', color: '#f59e0b', icon: '⟳' };
      case 'error':
        return { label: '错误', color: '#ef4444', icon: '✕' };
      default:
        return { label: '已停止', color: '#6b7280', icon: '○' };
    }
  }, [engineStatus]);

  // 加载引擎状态和进程信息
  const loadEngineStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.getOpenClawStatus();
      if (status.isRunning) {
        setEngineStatus(status.isHealthy ? 'running' : 'error');
      } else {
        setEngineStatus('stopped');
      }
      if (status.error) {
        setEngineError(status.error);
      }

      // 加载进程信息
      const processResult = await window.electronAPI.getOpenClawProcessInfo();
      if (processResult.success && processResult.info) {
        setProcessInfo({
          processName: processResult.info.processName,
          pid: processResult.info.pid || 0,
          port: processResult.info.port,
        });
      }
    } catch (error) {
      console.error('Failed to get engine status:', error);
      setEngineStatus('error');
    }
  }, []);

  // 监听引擎状态变化
  useEffect(() => {
    loadEngineStatus();

    const handleStatusChanged = (_event: any, data: { isRunning: boolean; port: number }) => {
      setEngineStatus(data.isRunning ? 'running' : 'stopped');
      if (!data.isRunning) {
        setEngineError('');
        setProcessInfo(null);
      }
      // 状态变化时刷新进程信息
      loadEngineStatus();
    };

    window.electronAPI.onOpenClawStatusChanged(handleStatusChanged);

    return () => {
      window.electronAPI.removeOpenClawStatusChangedListener(handleStatusChanged);
    };
  }, [loadEngineStatus]);

  // 启动引擎
  const handleStartEngine = async () => {
    try {
      setLoading(true);
      setEngineStatus('starting');
      const result = await window.electronAPI.startOpenClaw();
      if (result.success) {
        setEngineStatus('running');
        onShowToast('AI引擎已启动', 'success');
        // 刷新进程信息
        await loadEngineStatus();
      } else {
        throw new Error(result.error || '启动失败');
      }
    } catch (error) {
      setEngineStatus('error');
      setEngineError(error instanceof Error ? error.message : '启动失败');
      onShowToast('启动失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 停止引擎
  const handleStopEngine = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.stopOpenClaw();
      if (result.success) {
        setEngineStatus('stopped');
        setEngineError('');
        setProcessInfo(null);
        onShowToast('AI引擎已停止', 'success');
      } else {
        throw new Error(result.error || '停止失败');
      }
    } catch (error) {
      onShowToast('停止失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 重启引擎
  const handleRestartEngine = async () => {
    try {
      setLoading(true);
      setEngineStatus('restarting');
      const result = await window.electronAPI.restartOpenClaw();
      if (result.success) {
        setEngineStatus('running');
        setEngineError('');
        onShowToast('AI引擎已重启', 'success');
        // 刷新进程信息
        await loadEngineStatus();
      } else {
        throw new Error(result.error || '重启失败');
      }
    } catch (error) {
      setEngineStatus('error');
      setEngineError(error instanceof Error ? error.message : '重启失败');
      onShowToast('重启失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 异常修复：强制清理旧进程并重启
  const handleRepairEngine = async () => {
    // 1. 检查引擎状态，如果运行正常，提示用户不需要修复
    if (engineStatus === 'running') {
      onShowToast('AI引擎运行正常，无需修复', 'success');
      return;
    }

    // 2. 二次确认：告知用户会退出应用并重启
    try {
      const confirmChoice = await window.electronAPI.showConfirmDialog({
        title: '确认修复AI引擎',
        message: '异常修复将强制清理所有AI引擎进程并重新启动应用。\n\n此操作会暂时退出应用，修复完成后自动重启。\n\n是否继续？',
        buttons: ['确认修复', '取消'],
        defaultId: 1,
        cancelId: 1,
      });

      if (confirmChoice !== 0) {
        return; // 用户取消
      }
    } catch (dialogError) {
      console.error('显示确认对话框失败:', dialogError);
      return;
    }

    try {
      setIsRepairing(true);
      setEngineStatus('restarting');
      onShowToast('正在修复AI引擎，应用即将重启...', 'success');

      const result = await window.electronAPI.repairOpenClaw();
      if (result.success) {
        // 3. 修复成功后自动重启应用
        onShowToast('修复成功，正在重启应用...', 'success');
        await window.electronAPI.appRestart();
      } else {
        throw new Error(result.message || '修复失败');
      }
    } catch (error) {
      setEngineStatus('error');
      const errorMessage = error instanceof Error ? error.message : '修复失败';
      setEngineError(errorMessage);
      onShowToast('修复失败: ' + errorMessage, 'error');

      // 修复失败，询问用户是否重启应用
      try {
        const userChoice = await window.electronAPI.showConfirmDialog({
          title: 'AI引擎修复失败',
          message: `修复AI引擎时遇到问题：${errorMessage}\n\n是否重启应用以尝试恢复？`,
          buttons: ['重启应用', '稍后手动处理'],
          defaultId: 0,
          cancelId: 1,
        });

        if (userChoice === 0) {
          onShowToast('正在重启应用...', 'success');
          await window.electronAPI.appRestart();
        }
      } catch (dialogError) {
        console.error('显示确认对话框失败:', dialogError);
      }
    } finally {
      setIsRepairing(false);
      setLoading(false);
    }
  };

  const statusInfo = getEngineStatusInfo();

  return (
    <div className="animate-in fade-in duration-200">
      <div className="text-xl font-semibold text-foreground mb-5">AI 引擎</div>

      {/* 引擎状态和控制 */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: statusInfo.color }}>
              {statusInfo.icon}
            </span>
            <span className="text-sm font-medium" style={{ color: statusInfo.color }}>
              引擎{statusInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {engineStatus === 'running' ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStopEngine}
                  disabled={loading}
                >
                  {loading ? '停止中...' : '停止'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleRestartEngine}
                  disabled={loading}
                >
                  {loading ? '重启中...' : '重启'}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleStartEngine}
                disabled={loading || engineStatus === 'starting'}
              >
                {loading || engineStatus === 'starting' ? '启动中...' : '启动引擎'}
              </Button>
            )}
          </div>
        </div>

        {/* 进程信息 */}
        {processInfo && (
          <div className="mt-4 p-3 bg-muted rounded-lg border border-border">
            <div className="text-[13px] font-medium text-foreground mb-2 flex items-center gap-1.5">
              <span>🖥️</span>
              <span>进程信息</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground mb-0.5">进程名</div>
                <div className="text-foreground font-medium">{processInfo.processName}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-0.5">PID</div>
                <div className="text-foreground font-medium">{processInfo.pid}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-0.5">端口</div>
                <div className="text-foreground font-medium">{processInfo.port}</div>
              </div>
            </div>
          </div>
        )}

        {/* 异常修复按钮 */}
        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRepairEngine}
            disabled={isRepairing || engineStatus === 'running'}
            className={cn(
              "gap-1.5",
              engineStatus !== 'running' && "text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            )}
          >
            <span>{isRepairing ? '⟳' : '🔧'}</span>
            <span>
              {isRepairing ? '修复中...' : engineStatus === 'running' ? '引擎运行正常' : '异常修复'}
            </span>
          </Button>
          <div className="text-[11px] text-muted-foreground mt-1.5">
            {engineStatus === 'running'
              ? 'AI引擎运行正常，无需修复'
              : '清理残留进程并强制重启应用'}
          </div>
        </div>

        {engineError && (
          <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {engineError}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 账户设置面板
 */
interface AccountSettingsProps {
  user: any;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ user }) => {
  return (
    <div className="animate-in fade-in duration-200">
      <div className="text-xl font-semibold text-foreground mb-5">账户设置</div>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback className="text-base font-semibold">
              {(user?.username || 'D').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium text-foreground">{user?.username || 'Demo User'}</div>
            <div className="text-xs text-muted-foreground">{user?.email || 'demo@clawstation.local'}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between py-2">
          <div className="text-sm text-muted-foreground">用户ID</div>
          <div className="text-sm font-medium text-foreground">{user?.id || '-'}</div>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="text-sm text-muted-foreground">创建时间</div>
          <div className="text-sm font-medium text-foreground">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 关于面板
 */
const AboutSettings: React.FC = () => {
  const [version, setVersion] = React.useState<string>('');

  React.useEffect(() => {
    window.electronAPI.getAppInfo().then((info) => {
      setVersion(info.version);
    }).catch(() => {
      setVersion('unknown');
    });
  }, []);

  return (
    <div className="animate-in fade-in duration-200">
      <div className="text-xl font-semibold text-foreground mb-5">关于</div>

      <div className="rounded-xl border border-border p-6 mb-6 flex flex-col items-center text-center">
        <div className="text-3xl font-bold text-primary mb-1">XClaw</div>
        <div className="text-lg font-semibold text-foreground mb-1">XClaw</div>
        <div className="text-sm text-muted-foreground mb-2">版本 {version || '加载中...'}</div>
        <div className="text-sm text-muted-foreground">
          AI数字员工桌面应用
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between py-2">
          <div className="text-sm text-muted-foreground">技术栈</div>
          <div className="text-sm font-medium text-foreground">Electron + React + TypeScript</div>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="text-sm text-muted-foreground">AI 引擎</div>
          <div className="text-sm font-medium text-foreground">OpenClaw Gateway</div>
        </div>
      </div>
    </div>
  );
};

/**
 * 菜单图标组件
 */
const MenuIcon: React.FC<{ name: string }> = ({ name }) => {
  const icons: Record<string, JSX.Element> = {
    settings: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    ),
    palette: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="13.5" cy="6.5" r="2.5"></circle>
        <circle cx="17.5" cy="10.5" r="2.5"></circle>
        <circle cx="8.5" cy="7.5" r="2.5"></circle>
        <circle cx="6.5" cy="12.5" r="2.5"></circle>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.438-.18-.835-.438-1.125-.28-.289-.437-.652-.437-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"></path>
      </svg>
    ),
    brain: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
        <path d="M8.5 8.5v.01"></path>
        <path d="M16 15.5v.01"></path>
        <path d="M12 12v.01"></path>
        <path d="M11 17v.01"></path>
        <path d="M7 14v.01"></path>
      </svg>
    ),
    cpu: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
        <rect x="9" y="9" width="6" height="6"></rect>
        <line x1="9" y1="1" x2="9" y2="4"></line>
        <line x1="15" y1="1" x2="15" y2="4"></line>
        <line x1="9" y1="20" x2="9" y2="23"></line>
        <line x1="15" y1="20" x2="15" y2="23"></line>
        <line x1="20" y1="9" x2="23" y2="9"></line>
        <line x1="20" y1="14" x2="23" y2="14"></line>
        <line x1="1" y1="9" x2="4" y2="9"></line>
        <line x1="1" y1="14" x2="4" y2="14"></line>
      </svg>
    ),
    user: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    ),
    info: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    ),
  };

  return icons[name] || null;
};

/**
 * Settings 页面组件
 */
export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  onShowToast?: (message: string, type?: 'success' | 'error') => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab, onShowToast: externalShowToast }) => {
  const { user } = useUserStore();
  const { preferences, updatePreferences } = useUserStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'engine');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // 切换标签页时也关闭搜索
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    // 触发搜索关闭事件
    window.dispatchEvent(new CustomEvent('close-search'));
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    // 如果外部提供了 onShowToast，使用外部的；否则使用内部的 toast
    if (externalShowToast) {
      externalShowToast(message, type);
    } else {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceSettings preferences={preferences} onUpdatePreferences={updatePreferences} />;
      case 'engine':
        return <AIEngineSettings onShowToast={showToast} />;
      case 'ai':
        return <StandaloneAIModelSettings onShowToast={showToast} />;
      case 'account':
        return <AccountSettings user={user} />;
      case 'about':
        return <AboutSettings />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex flex-row gap-0 max-w-[720px] h-[520px] p-0 overflow-hidden sm:max-w-[720px]" showCloseButton={false}>
        {/* 左侧菜单 */}
        <div className="w-[180px] shrink-0 border-r border-border flex flex-col bg-muted/30">
          <div className="p-4 pb-3" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <h2 className="text-base font-semibold text-foreground">设置</h2>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            {SETTINGS_MENU.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => handleTabChange(item.id)}
              >
                <MenuIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h3 className="text-sm font-medium text-foreground">
              {SETTINGS_MENU.find(m => m.id === activeTab)?.label}
            </h3>
            <button
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={onClose}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <ScrollArea className="flex-1 min-h-0 overflow-hidden">
            <div className="px-6 py-4">
              {renderContent()}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>

      {/* Toast 提示 */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-200",
          toast.type === 'success'
            ? "bg-primary text-primary-foreground"
            : "bg-destructive text-destructive-foreground"
        )}>
          {toast.message}
        </div>
      )}
    </Dialog>
  );
};

export default SettingsModal;
