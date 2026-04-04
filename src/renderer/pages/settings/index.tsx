/**
 * Settings 页面
 * 设置页面，左侧菜单导航，右侧内容展示
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserStore } from '../../stores';
import type { Theme, FontSize, Locale } from '../../stores';
import { useModels } from '../../hooks/useModels';
import { MODEL_MODE_CONFIGS, getApiKeyUrl } from '../../config/provider-groups';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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

// 提供商显示名称映射（仅国内模型服务商）
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  'kimi-code': 'Kimi (月之暗面)',
  'kimi-coding': 'Kimi Coding',
  kimi: 'Kimi',
  moonshot: 'Moonshot',
  deepseek: 'DeepSeek',
  zai: 'ZAI',
  minimax: 'MiniMax API Key',
  'minimax-portal': 'MiniMax OAuth',
  'minimax-cn': 'MiniMax API Key (CN)',
  volcengine: '火山引擎',
  'volcengine-plan': '火山引擎 (套餐)',
  byteplus: 'BytePlus',
  'byteplus-plan': 'BytePlus (套餐)',
  doubao: '豆包',
  bailian: '百炼/阿里云',
  qwen: '通义千问',
  'qwen-portal': '通义千问 OAuth',
};

// 模型配置接口
interface ModelConfig {
  provider: string;
  id: string;
  name: string;
  contextWindow?: number;
}

// 提供商配置
interface ProviderConfig {
  id: string;
  name: string;
  hasKey: boolean;
  models: ModelConfig[];
}

// 提供商图标（仅国内模型服务商）
const getProviderIcon = (providerId: string): string => {
  const icons: Record<string, string> = {
    // MiniMax
    minimax: 'MM',
    'minimax-portal': 'MM',
    'minimax-cn': 'MM',
    // Moonshot/Kimi
    moonshot: 'Ki',
    kimi: 'Ki',
    'kimi-coding': 'Ki',
    // Volcano Engine
    volcengine: 'VC',
    'volcengine-plan': 'VC',
    // BytePlus
    byteplus: 'BP',
    'byteplus-plan': 'BP',
    // Z.AI
    zai: 'Z',
    // Qwen
    qwen: 'QW',
    'qwen-portal': 'QW',
    // Bailian
    bailian: 'BL',
    // DeepSeek
    deepseek: 'DS',
    // Doubao
    doubao: '豆包',
  };
  return icons[providerId] || '🤖';
};

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
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [showAddKey, setShowAddKey] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('stopped');
  const [engineError, setEngineError] = useState<string>('');
  const [processInfo, setProcessInfo] = useState<ProcessInfo | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  const getProviderDisplayName = useCallback((provider: string): string => {
    return PROVIDER_DISPLAY_NAMES[provider] || provider;
  }, []);

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
 * AI模型设置面板 - QClaw 风格三选一 radio 设计
 *
 * 三种模式:
 * 1. 默认大模型 - 开箱即用
 * 2. 自定义大模型—模型API - 选厂商 → 选模型 → 填 API Key
 * 3. 自定义大模型—Coding Plan - 选套餐厂商 → 选模型 → 填 API Key
 */
interface AIModelSettingsProps {
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

const AIModelSettings: React.FC<AIModelSettingsProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');
  // 当前选中的模式
  const [selectedMode, setSelectedMode] = useState<'default' | 'model-api' | 'coding-plan'>('default');
  // 当前选中的厂商 providerId
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  // 当前选中的模型 ID
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  // API Key
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const {
    providerGroups,
    configuredProviders,
    isRestarting,
    selectModel,
    refresh: refreshModels,
  } = useModels();

  // 加载当前模型配置，推断当前模式
  useEffect(() => {
    const loadCurrentModel = async () => {
      try {
        const agentResult = await window.electronAPI.getDefaultAgent();
        if (agentResult.success && agentResult.agent?.model) {
          const modelConfig = agentResult.agent.model;
          let modelStr = '';
          if (typeof modelConfig === 'string') {
            modelStr = modelConfig;
          } else if (modelConfig.primary) {
            modelStr = modelConfig.primary;
          }
          setCurrentModel(modelStr);

          // 推断当前模式
          if (modelStr) {
            const [provider] = modelStr.split('/');
            if (provider) {
              // 检查 provider 属于哪种模式
              const codingPlanMode = MODEL_MODE_CONFIGS.find(m => m.modeId === 'coding-plan');
              const modelApiMode = MODEL_MODE_CONFIGS.find(m => m.modeId === 'model-api');
              if (codingPlanMode?.providers.some(p => p.providerId === provider)) {
                // 检查是否为 coding plan 特有的 provider
                const isExclusiveCodingPlan = !modelApiMode?.providers.some(p => p.providerId === provider);
                if (isExclusiveCodingPlan) {
                  setSelectedMode('coding-plan');
                  setSelectedProviderId(provider);
                } else {
                  // 两者都有，默认显示模型API
                  setSelectedMode('model-api');
                  setSelectedProviderId(provider);
                }
              } else if (modelApiMode?.providers.some(p => p.providerId === provider)) {
                setSelectedMode('model-api');
                setSelectedProviderId(provider);
              }
              // 设置模型
              const modelId = modelStr.split('/').slice(1).join('/');
              if (modelId) setSelectedModelId(modelId);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load current model:', error);
      }
    };
    loadCurrentModel();
  }, []);

  // 获取当前模式的配置
  const currentModeConfig = useMemo(() => {
    return MODEL_MODE_CONFIGS.find(m => m.modeId === selectedMode);
  }, [selectedMode]);

  // 获取选中厂商的可用模型
  const availableModels = useMemo(() => {
    if (!selectedProviderId) return [];
    const group = providerGroups.find(g => g.provider === selectedProviderId);
    return group?.models || [];
  }, [selectedProviderId, providerGroups]);

  // 获取选中厂商的 API Key 状态
  const hasApiKey = useMemo(() => {
    return configuredProviders.includes(selectedProviderId);
  }, [configuredProviders, selectedProviderId]);

  // 当前选中厂商的 API Key 获取链接
  const currentApiKeyUrl = useMemo(() => {
    return getApiKeyUrl(selectedProviderId);
  }, [selectedProviderId]);

  // 切换模式时重置厂商和模型选择
  const handleModeChange = (mode: 'default' | 'model-api' | 'coding-plan') => {
    setSelectedMode(mode);
    setSelectedProviderId('');
    setSelectedModelId('');
    setApiKey('');
    setShowApiKey(false);
  };

  // 切换厂商时重置模型选择
  const handleProviderChange = (providerId: string) => {
    setSelectedProviderId(providerId);
    setSelectedModelId('');
    setApiKey('');
    setShowApiKey(false);
  };

  // 保存 API Key
  const handleSaveApiKey = async () => {
    if (!selectedProviderId || !apiKey.trim()) {
      onShowToast('请输入 API Key', 'error');
      return;
    }
    try {
      setLoading(true);
      const result = await window.electronAPI.setApiKey(selectedProviderId, apiKey);
      if (result.success) {
        onShowToast('API Key 已保存', 'success');
        setApiKey('');
        setShowApiKey(false);
        refreshModels();
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      onShowToast('保存失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 确认选择（应用模型配置）
  const handleConfirm = async () => {
    if (selectedMode === 'default') {
      // 默认模型 - 清除自定义配置
      try {
        setLoading(true);
        // 设置为空或默认值
        await window.electronAPI.setDefaultModel({ primary: '', fallbacks: [] });
        setCurrentModel('');
        onShowToast('已切换为默认大模型', 'success');
        window.dispatchEvent(new CustomEvent('model-changed'));
      } catch (error) {
        onShowToast('切换失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedProviderId) {
      onShowToast('请选择模型厂商', 'error');
      return;
    }
    if (!hasApiKey && !apiKey.trim()) {
      onShowToast('请先配置 API Key', 'error');
      return;
    }
    if (!selectedModelId) {
      onShowToast('请选择模型', 'error');
      return;
    }

    try {
      setLoading(true);
      // 先保存 API Key（如果有输入）
      if (apiKey.trim() && !hasApiKey) {
        const keyResult = await window.electronAPI.setApiKey(selectedProviderId, apiKey);
        if (!keyResult.success) {
          throw new Error(keyResult.error || 'API Key 保存失败');
        }
      }
      // 切换模型
      await selectModel(selectedProviderId, selectedModelId);
      setCurrentModel(`${selectedProviderId}/${selectedModelId}`);
      onShowToast('模型配置已保存', 'success');
      setApiKey('');
      setShowApiKey(false);
    } catch (error) {
      onShowToast('保存失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-200">
      <div className="text-xl font-semibold text-foreground mb-5">大模型设置</div>

      {/* 三选一 Radio */}
      <div className="flex flex-col gap-2 mb-6">
        {MODEL_MODE_CONFIGS.map(mode => (
          <label
            key={mode.modeId}
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all hover:border-primary/50",
              selectedMode === mode.modeId
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            <input
              type="radio"
              name="model-mode"
              className="sr-only"
              checked={selectedMode === mode.modeId}
              onChange={() => handleModeChange(mode.modeId)}
            />
            <span className={cn(
              "flex items-center justify-center size-4 rounded-full border-2 shrink-0 transition-colors",
              selectedMode === mode.modeId
                ? "border-primary bg-primary"
                : "border-muted-foreground/30"
            )}>
              {selectedMode === mode.modeId && (
                <span className="size-2 rounded-full bg-primary-foreground" />
              )}
            </span>
            <span className="text-sm font-medium">{mode.modeName}</span>
          </label>
        ))}
      </div>

      {/* 自定义模式的表单区域 */}
      {selectedMode !== 'default' && currentModeConfig && (
        <div className="mb-6 space-y-4">
          {/* 模型厂商下拉 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">模型厂商：</label>
            <Select value={selectedProviderId} onValueChange={(value) => handleProviderChange(value ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择厂商" />
              </SelectTrigger>
              <SelectContent>
                {currentModeConfig.providers.map(provider => (
                  <SelectItem key={provider.providerId} value={provider.providerId}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 模型名称下拉 */}
          {selectedProviderId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">模型名称：</label>
              <Select value={selectedModelId} onValueChange={(value) => setSelectedModelId(value ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}{model.contextWindow ? ` (${model.contextWindow >= 1000 ? `${Math.round(model.contextWindow / 1000)}K` : model.contextWindow})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* API Key 输入 */}
          {selectedProviderId && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">API Key：</label>
                {currentApiKeyUrl && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      window.electronAPI.openExternalUrl(currentApiKeyUrl);
                    }}
                  >
                    前往官网获取
                  </button>
                )}
              </div>
              {hasApiKey ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                  <span className="text-sm text-muted-foreground">API Key 已配置</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!confirm('确定要删除此 API Key 吗？')) return;
                      try {
                        setLoading(true);
                        const result = await window.electronAPI.removeApiKey(selectedProviderId);
                        if (result.success) {
                          onShowToast('API Key 已删除', 'success');
                          refreshModels();
                        }
                      } catch (error) {
                        onShowToast('删除失败', 'error');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    重新配置
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="请输入 API Key"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                    title={showApiKey ? '隐藏' : '显示'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {showApiKey ? (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      )}
                    </svg>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 提示 + 确认按钮 */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          *可选用自定义大模型配置，使用时请遵循相关法律法规
        </div>
        <Button
          onClick={handleConfirm}
          disabled={loading || isRestarting}
          size="sm"
        >
          {loading ? '保存中...' : '确 认'}
        </Button>
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
        return <AIModelSettings onShowToast={showToast} />;
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

