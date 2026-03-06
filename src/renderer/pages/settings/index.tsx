/**
 * Settings 页面
 * 设置页面，左侧菜单导航，右侧内容展示
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useUserStore } from '../../stores';
import type { Theme, FontSize, Locale } from '../../stores';

// 设置标签页类型
type SettingsTab = 'general' | 'engine' | 'ai' | 'appearance' | 'account' | 'about';

// 左侧菜单项配置
const SETTINGS_MENU = [
  { id: 'general' as const, label: '通用', icon: 'settings' },
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

// 提供商显示名称映射
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  'kimi-code': 'Kimi (月之暗面)',
  kimi: 'Kimi',
  deepseek: 'DeepSeek',
  ollama: 'Ollama (本地)',
  zai: 'ZAI',
  qianfan: '百度千帆',
  nvidia: 'NVIDIA',
  kilocode: 'KiloCode',
  xiaomi: '小米',
  minimax: 'MiniMax',
  volcengine: '火山引擎',
  huggingface: 'HuggingFace',
  together: 'Together AI',
  venice: 'Venice AI',
  bedrock: 'AWS Bedrock',
  doubao: '豆包',
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

// 提供商图标
const getProviderIcon = (providerId: string): string => {
  const icons: Record<string, string> = {
    anthropic: '🅰️',
    openai: '🅾️',
    google: '🇬',
    'google-generative-ai': '🇬',
    azure: '☁️',
    bedrock: '🇧',
    ollama: '🦙',
    deepseek: '🔍',
    cohere: '🇨',
    minimax: '🇲',
    moonshot: '🇰',
    kimi: '🇰',
    baidu: '度',
    bytedance: '字节',
    doubao: '豆包',
  };
  return icons[providerId] || '🤖';
};

/**
 * 通用设置面板
 */
interface GeneralSettingsProps {
  preferences: {
    theme: Theme;
    fontSize: FontSize;
    locale: Locale;
    autoSave: boolean;
  };
  onUpdatePreferences: (prefs: Partial<{ theme: Theme; fontSize: FontSize; locale: Locale; autoSave: boolean }>) => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  preferences,
  onUpdatePreferences,
}) => {
  return (
    <div className="settings-section">
      <div className="settings-section-title">通用设置</div>
      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-label">
            <div className="settings-item-title">自动保存对话</div>
            <div className="settings-item-desc">退出应用时自动保存对话记录</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.autoSave}
              onChange={(e) => onUpdatePreferences({ autoSave: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">
            <div className="settings-item-title">语言</div>
            <div className="settings-item-desc">选择界面显示语言</div>
          </div>
          <select
            className="settings-select"
            value={preferences.locale}
            onChange={(e) => onUpdatePreferences({ locale: e.target.value as Locale })}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </select>
        </div>
      </div>
    </div>
  );
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
    <div className="settings-section">
      <div className="settings-section-title">外观设置</div>

      {/* 主题选择 */}
      <div className="settings-group">
        <div className="settings-group-title">主题</div>
        <div className="theme-grid">
          <div
            className={`theme-card ${preferences.theme === 'light' ? 'active' : ''}`}
            onClick={() => onUpdatePreferences({ theme: 'light' })}
          >
            <div className="theme-preview light">
              <div className="theme-preview-header"></div>
              <div className="theme-preview-sidebar"></div>
              <div className="theme-preview-content"></div>
            </div>
            <div className="theme-name">明亮</div>
            {preferences.theme === 'light' && <div className="theme-check">✓</div>}
          </div>
          <div
            className={`theme-card ${preferences.theme === 'dark' ? 'active' : ''}`}
            onClick={() => onUpdatePreferences({ theme: 'dark' })}
          >
            <div className="theme-preview dark">
              <div className="theme-preview-header"></div>
              <div className="theme-preview-sidebar"></div>
              <div className="theme-preview-content"></div>
            </div>
            <div className="theme-name">暗黑</div>
            {preferences.theme === 'dark' && <div className="theme-check">✓</div>}
          </div>
        </div>
      </div>

      {/* 字体大小 */}
      <div className="settings-group">
        <div className="settings-group-title">字体大小</div>
        <div className="font-size-options">
          {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
            <button
              key={size}
              className={`font-size-btn ${preferences.fontSize === size ? 'active' : ''}`}
              onClick={() => onUpdatePreferences({ fontSize: size })}
            >
              <span className={`font-size-preview font-${size}`}>Aa</span>
              <span className="font-size-label">
                {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
              </span>
            </button>
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
    <div className="settings-section">
      <div className="settings-section-title">AI 引擎</div>

      {/* 引擎状态和控制 */}
      <div className="engine-status-card">
        <div className="engine-status-header">
          <div className="engine-status-indicator">
            <span className="engine-status-icon" style={{ color: statusInfo.color }}>
              {statusInfo.icon}
            </span>
            <span className="engine-status-text" style={{ color: statusInfo.color }}>
              引擎{statusInfo.label}
            </span>
          </div>
          <div className="engine-status-actions">
            {engineStatus === 'running' ? (
              <>
                <button
                  className="btn btn-sm"
                  onClick={handleStopEngine}
                  disabled={loading}
                >
                  {loading ? '停止中...' : '停止'}
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleRestartEngine}
                  disabled={loading}
                >
                  {loading ? '重启中...' : '重启'}
                </button>
              </>
            ) : (
              <button
                className="btn btn-sm btn-primary"
                onClick={handleStartEngine}
                disabled={loading || engineStatus === 'starting'}
              >
                {loading || engineStatus === 'starting' ? '启动中...' : '启动引擎'}
              </button>
            )}
          </div>
        </div>

        {/* 进程信息 */}
        {processInfo && (
          <div className="engine-process-info" style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'var(--bg-tertiary, #f8fafc)',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #e2e8f0)',
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-primary, #1e293b)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span>🖥️</span>
              <span>进程信息</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              fontSize: '12px',
            }}>
              <div>
                <div style={{ color: 'var(--text-secondary, #64748b)', marginBottom: '2px' }}>进程名</div>
                <div style={{ color: 'var(--text-primary, #1e293b)', fontWeight: 500 }}>{processInfo.processName}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary, #64748b)', marginBottom: '2px' }}>PID</div>
                <div style={{ color: 'var(--text-primary, #1e293b)', fontWeight: 500 }}>{processInfo.pid}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary, #64748b)', marginBottom: '2px' }}>端口</div>
                <div style={{ color: 'var(--text-primary, #1e293b)', fontWeight: 500 }}>{processInfo.port}</div>
              </div>
            </div>
          </div>
        )}

        {/* 异常修复按钮 */}
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
        }}>
          <button
            className="btn btn-sm"
            onClick={handleRepairEngine}
            disabled={isRepairing || engineStatus === 'running'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: engineStatus === 'running' ? '#9ca3af' : '#ef4444',
              borderColor: engineStatus === 'running' ? '#9ca3af' : '#ef4444',
              cursor: engineStatus === 'running' ? 'not-allowed' : 'pointer',
            }}
          >
            <span>{isRepairing ? '⟳' : '🔧'}</span>
            <span>
              {isRepairing ? '修复中...' : engineStatus === 'running' ? '引擎运行正常' : '异常修复'}
            </span>
          </button>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-secondary, #64748b)',
            marginTop: '6px',
          }}>
            {engineStatus === 'running'
              ? 'AI引擎运行正常，无需修复'
              : '清理残留进程并强制重启应用'}
          </div>
        </div>

        {engineError && (
          <div className="engine-status-error">
            {engineError}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * AI模型设置面板（只包含模型配置）
 */
interface AIModelSettingsProps {
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

// 搜索 API 提供商配置
interface SearchProviderConfig {
  id: string;
  name: string;
  hasKey: boolean;
  description: string;
}

// 搜索 API 提供商列表
const SEARCH_PROVIDERS: SearchProviderConfig[] = [
  { id: 'brave', name: 'Brave Search', hasKey: false, description: '免费额度：每月 2000 次请求' },
  { id: 'perplexity', name: 'Perplexity', hasKey: false, description: '需要 Perplexity API Key' },
  { id: 'grok', name: 'Grok (xAI)', hasKey: false, description: '需要 xAI API Key' },
  { id: 'gemini', name: 'Google Gemini', hasKey: false, description: '需要 Google AI API Key' },
  { id: 'kimi', name: 'Kimi (Moonshot)', hasKey: false, description: '需要 Kimi API Key' },
];

// 初始搜索提供商列表
const DEFAULT_SEARCH_PROVIDERS: SearchProviderConfig[] = [
  { id: 'brave', name: 'Brave Search', hasKey: false, description: '免费额度：每月 2000 次请求' },
  { id: 'perplexity', name: 'Perplexity', hasKey: false, description: '需要 Perplexity API Key' },
  { id: 'grok', name: 'Grok (xAI)', hasKey: false, description: '需要 xAI API Key' },
  { id: 'gemini', name: 'Google Gemini', hasKey: false, description: '需要 Google AI API Key' },
  { id: 'kimi', name: 'Kimi (Moonshot)', hasKey: false, description: '需要 Kimi API Key' },
];

const AIModelSettings: React.FC<AIModelSettingsProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [showAddKey, setShowAddKey] = useState(false);

  // 搜索 API Key 状态
  const [searchProvider, setSearchProvider] = useState<string>('brave');
  const [searchApiKey, setSearchApiKey] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [showAddSearchKey, setShowAddSearchKey] = useState(false);
  const [searchProviders, setSearchProviders] = useState<SearchProviderConfig[]>(DEFAULT_SEARCH_PROVIDERS);

  const getProviderDisplayName = useCallback((provider: string): string => {
    return PROVIDER_DISPLAY_NAMES[provider] || provider;
  }, []);

  const loadAISettings = useCallback(async () => {
    try {
      setLoading(true);

      const [catalogResult, providersResult, authResult, agentResult] = await Promise.all([
        window.electronAPI.getModelCatalog(),
        window.electronAPI.getCatalogProviders(),
        window.electronAPI.getAuthProfiles(),
        window.electronAPI.getDefaultAgent(),
      ]);

      const providerList: ProviderConfig[] = [];
      const allModels = catalogResult.success && catalogResult.models ? catalogResult.models : [];
      const providerData = providersResult.success && providersResult.providers ? providersResult.providers : [];
      const authData = authResult.success && authResult.profiles ? authResult.profiles : [];

      for (const p of providerData) {
        const providerModels = allModels.filter((m: any) => m.provider === p.id);
        const authProfile = authData.find((a: any) => a.provider === p.id);
        providerList.push({
          id: p.id,
          name: p.name || getProviderDisplayName(p.id),
          hasKey: authProfile?.hasKey || false,
          models: providerModels.map((m: any) => ({
            provider: m.provider,
            id: m.id,
            name: m.name,
            contextWindow: m.contextWindow,
          })),
        });
      }

      setProviders(providerList);

      if (agentResult.success && agentResult.agent?.model) {
        const modelConfig = agentResult.agent.model;
        let modelStr = '';
        if (typeof modelConfig === 'string') {
          modelStr = modelConfig;
        } else if (modelConfig.primary) {
          modelStr = modelConfig.primary;
        }
        setCurrentModel(modelStr);
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
      onShowToast('加载AI设置失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast, getProviderDisplayName]);

  useEffect(() => {
    loadAISettings();
  }, [loadAISettings]);

  const handleSaveApiKey = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      onShowToast('请选择提供商并输入API Key', 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await window.electronAPI.setApiKey(selectedProvider, apiKey);
      if (result.success) {
        onShowToast('API Key 已保存', 'success');
        setApiKey('');
        setShowAddKey(false);
        setSelectedProvider('');
        loadAISettings();
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      onShowToast('保存失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveApiKey = async (providerId: string) => {
    if (!confirm(`确定要删除 ${getProviderDisplayName(providerId)} 的API Key吗？`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await window.electronAPI.removeApiKey(providerId);
      if (result.success) {
        onShowToast('API Key 已删除', 'success');
        loadAISettings();
      } else {
        throw new Error(result.error || '删除失败');
      }
    } catch (error) {
      onShowToast('删除失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModel = async (providerId: string, modelId: string) => {
    const modelString = `${providerId}/${modelId}`;

    try {
      setLoading(true);
      const agentResult = await window.electronAPI.getDefaultAgent();
      if (agentResult.success && agentResult.agent) {
        const updatedAgent = {
          ...agentResult.agent,
          model: {
            primary: modelString,
            fallbacks: agentResult.agent.model?.fallbacks || [],
          },
        };

        const updateResult = await window.electronAPI.setAgent(updatedAgent);
        if (updateResult.success) {
          setCurrentModel(modelString);
          onShowToast('模型已切换', 'success');
          window.dispatchEvent(new CustomEvent('model-changed'));
        } else {
          throw new Error(updateResult.error || '切换失败');
        }
      }
    } catch (error) {
      onShowToast('切换失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 保存搜索 API Key
  const handleSaveSearchApiKey = async () => {
    if (!searchApiKey.trim()) {
      onShowToast('请输入 API Key', 'error');
      return;
    }

    try {
      setLoading(true);
      // 调用后端保存搜索 API Key
      const result = await window.electronAPI.setSearchApiKey(searchProvider, searchApiKey);
      if (result.success) {
        onShowToast('搜索 API Key 已保存', 'success');
        setSearchApiKey('');
        setShowAddSearchKey(false);
        // 更新本地状态
        setSearchProviders(prev => prev.map(p =>
          p.id === searchProvider ? { ...p, hasKey: true } : p
        ));
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      onShowToast('保存失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 删除搜索 API Key
  const handleRemoveSearchApiKey = async (providerId: string) => {
    const providerName = searchProviders.find(p => p.id === providerId)?.name || providerId;
    if (!confirm(`确定要删除 ${providerName} 的搜索 API Key 吗？`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await window.electronAPI.removeSearchApiKey(providerId);
      if (result.success) {
        onShowToast('搜索 API Key 已删除', 'success');
        setSearchProviders(prev => prev.map(p =>
          p.id === providerId ? { ...p, hasKey: false } : p
        ));
      } else {
        throw new Error(result.error || '删除失败');
      }
    } catch (error) {
      onShowToast('删除失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const configuredProviders = providers.filter(p => p.hasKey);
  const unconfiguredProviders = providers.filter(p => !p.hasKey);

  return (
    <div className="settings-section">
      <div className="settings-section-title">AI 模型</div>

      {/* 当前模型 */}
      <div className="current-model-display">
        <div className="current-model-label">当前使用</div>
        <div className="current-model-value">
          {currentModel ? (
            <>
              <span className="current-model-icon">{getProviderIcon(currentModel.split('/')[0] || '')}</span>
              <span className="current-model-name">{currentModel}</span>
            </>
          ) : (
            <span className="current-model-empty">未配置模型</span>
          )}
        </div>
      </div>

      {/* 已配置的提供商 */}
      <div className="settings-group">
        <div className="settings-group-title">
          <span>已配置的提供商</span>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowAddKey(true)}
            disabled={loading}
          >
            + 添加
          </button>
        </div>

        {configuredProviders.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-icon">🔑</div>
            <div className="empty-text">暂无配置的提供商</div>
            <button className="btn btn-primary" onClick={() => setShowAddKey(true)}>
              添加第一个API Key
            </button>
          </div>
        ) : (
          <div className="provider-list">
            {configuredProviders.map(provider => (
              <div key={provider.id} className="provider-item">
                <div className="provider-header">
                  <span className="provider-icon">{getProviderIcon(provider.id)}</span>
                  <span className="provider-name">{provider.name}</span>
                  <span className="provider-status configured">已配置</span>
                  <button
                    className="btn-icon-sm"
                    onClick={() => handleRemoveApiKey(provider.id)}
                    title="删除配置"
                  >
                    ×
                  </button>
                </div>
                <div className="provider-models">
                  {provider.models.map(model => (
                    <button
                      key={model.id}
                      className={`model-chip ${currentModel === `${provider.id}/${model.id}` ? 'active' : ''}`}
                      onClick={() => handleSelectModel(provider.id, model.id)}
                      disabled={loading}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 未配置的提供商 */}
      {unconfiguredProviders.length > 0 && (
        <div className="settings-group">
          <div className="settings-group-title">未配置的提供商</div>
          <div className="provider-list">
            {unconfiguredProviders.slice(0, 4).map(provider => (
              <div key={provider.id} className="provider-item unconfigured">
                <div className="provider-header">
                  <span className="provider-icon">{getProviderIcon(provider.id)}</span>
                  <span className="provider-name">{provider.name}</span>
                  <span className="provider-status unconfigured">未配置</span>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setSelectedProvider(provider.id);
                    setShowAddKey(true);
                  }}
                >
                  配置
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 添加API Key弹窗 */}
      {showAddKey && (
        <div className="modal-overlay active" onClick={() => setShowAddKey(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">添加 API Key</h3>
              <button className="modal-close" onClick={() => setShowAddKey(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">选择提供商</label>
                <select
                  className="form-select"
                  value={selectedProvider}
                  onChange={e => setSelectedProvider(e.target.value)}
                >
                  <option value="">请选择...</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="输入 API Key"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAddKey(false)}>取消</button>
              <button
                className="btn btn-primary"
                onClick={handleSaveApiKey}
                disabled={!selectedProvider || !apiKey.trim() || loading}
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 网络搜索 API Key 配置 */}
      <div className="settings-group" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
        <div className="settings-group-title">
          <span>🌐 网络搜索</span>
        </div>
        <div className="settings-item-desc" style={{ marginBottom: '16px' }}>
          配置网络搜索 API Key，启用 AI 实时联网搜索功能
        </div>

        {/* 启用搜索开关 */}
        <div className="settings-item" style={{ marginBottom: '16px' }}>
          <div className="settings-item-label">
            <div className="settings-item-title">启用网络搜索</div>
            <div className="settings-item-desc">允许 AI 使用网络搜索工具</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={searchEnabled}
              onChange={(e) => setSearchEnabled(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {/* 搜索 API 提供商列表 */}
        <div className="search-provider-list">
          {searchProviders.map(provider => (
            <div key={provider.id} className="provider-item" style={{ marginBottom: '12px' }}>
              <div className="provider-header">
                <span className="provider-name">{provider.name}</span>
                <span className={`provider-status ${provider.hasKey ? 'configured' : 'unconfigured'}`}>
                  {provider.hasKey ? '已配置' : '未配置'}
                </span>
                {provider.hasKey ? (
                  <button
                    className="btn-icon-sm"
                    onClick={() => handleRemoveSearchApiKey(provider.id)}
                    title="删除配置"
                  >
                    ×
                  </button>
                ) : (
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setSearchProvider(provider.id);
                      setShowAddSearchKey(true);
                    }}
                  >
                    配置
                  </button>
                )}
              </div>
              <div className="settings-item-desc" style={{ marginTop: '4px' }}>
                {provider.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 添加搜索 API Key 弹窗 */}
      {showAddSearchKey && (
        <div className="modal-overlay active" onClick={() => setShowAddSearchKey(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                配置 {searchProviders.find(p => p.id === searchProvider)?.name} API Key
              </h3>
              <button className="modal-close" onClick={() => setShowAddSearchKey(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="输入 API Key"
                  value={searchApiKey}
                  onChange={e => setSearchApiKey(e.target.value)}
                />
              </div>
              <div className="form-hint">
                {searchProvider === 'brave' && '获取 Brave API Key: https://brave.com/search/api/'}
                {searchProvider === 'perplexity' && '获取 Perplexity API Key: https://www.perplexity.ai/settings'}
                {searchProvider === 'grok' && '获取 xAI API Key: https://console.x.ai'}
                {searchProvider === 'gemini' && '获取 Google AI API Key: https://aistudio.google.com/app/apikey'}
                {searchProvider === 'kimi' && '获取 Kimi API Key: https://platform.moonshot.cn/'}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAddSearchKey(false)}>取消</button>
              <button
                className="btn btn-primary"
                onClick={handleSaveSearchApiKey}
                disabled={!searchApiKey.trim() || loading}
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="settings-actions">
        <button className="btn" onClick={loadAISettings} disabled={loading}>
          刷新配置
        </button>
      </div>
    </div>
  );
};

// 旧的 AISettings 别名，用于兼容
type AISettingsProps = AIEngineSettingsProps;
const AISettings = AIEngineSettings;

/**
 * 账户设置面板
 */
interface AccountSettingsProps {
  user: any;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ user }) => {
  return (
    <div className="settings-section">
      <div className="settings-section-title">账户设置</div>

      <div className="settings-group">
        <div className="account-info">
          <div className="account-avatar">
            {(user?.username || 'D').charAt(0).toUpperCase()}
          </div>
          <div className="account-details">
            <div className="account-name">{user?.username || 'Demo User'}</div>
            <div className="account-email">{user?.email || 'demo@clawstation.local'}</div>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-label">
            <div className="settings-item-title">用户ID</div>
          </div>
          <div className="settings-item-value">{user?.id || '-'}</div>
        </div>
        <div className="settings-item">
          <div className="settings-item-label">
            <div className="settings-item-title">创建时间</div>
          </div>
          <div className="settings-item-value">
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
  return (
    <div className="settings-section">
      <div className="settings-section-title">关于</div>

      <div className="about-card">
        <div className="about-logo">🤖</div>
        <div className="about-name">ClawStation</div>
        <div className="about-version">版本 1.0.0</div>
        <div className="about-description">
          AI数字员工桌面应用
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-label">
            <div className="settings-item-title">技术栈</div>
          </div>
          <div className="settings-item-value">Electron + React + TypeScript</div>
        </div>
        <div className="settings-item">
          <div className="settings-item-label">
            <div className="settings-item-title">AI 引擎</div>
          </div>
          <div className="settings-item-value">OpenClaw Gateway</div>
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
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"></path>
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

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'general');
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
      case 'general':
        return <GeneralSettings preferences={preferences} onUpdatePreferences={updatePreferences} />;
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* 左侧菜单 */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
            <h2 className="settings-title">设置</h2>
          </div>
          <nav className="settings-nav">
            {SETTINGS_MENU.map((item) => (
              <button
                key={item.id}
                className={`settings-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleTabChange(item.id)}
              >
                <MenuIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 右侧内容 */}
        <div className="settings-content">
          <div className="settings-content-header">
            <h3 className="settings-content-title">
              {SETTINGS_MENU.find(m => m.id === activeTab)?.label}
            </h3>
            <button className="settings-close-btn" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="settings-content-body">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Toast 提示 */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default SettingsModal;

