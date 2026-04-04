/**
 * Settings 页面
 * 设置页面，左侧菜单导航，右侧内容展示
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserStore } from '../../stores';
import type { Theme, FontSize, Locale } from '../../stores';
import { useModels } from '../../hooks/useModels';
import { MODEL_MODE_CONFIGS, getApiKeyUrl } from '../../config/provider-groups';

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
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-primary)',
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
                <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>进程名</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{processInfo.processName}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>PID</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{processInfo.pid}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>端口</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{processInfo.port}</div>
              </div>
            </div>
          </div>
        )}

        {/* 异常修复按钮 */}
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)',
        }}>
          <button
            className="btn btn-sm"
            onClick={handleRepairEngine}
            disabled={isRepairing || engineStatus === 'running'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: engineStatus === 'running' ? 'var(--text-tertiary)' : 'var(--error-text)',
              borderColor: engineStatus === 'running' ? 'var(--text-tertiary)' : 'var(--error-text)',
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
            color: 'var(--text-secondary)',
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
    <div className="settings-section">
      <div className="settings-section-title">大模型设置</div>

      {/* 三选一 Radio */}
      <div className="model-mode-radios">
        {MODEL_MODE_CONFIGS.map(mode => (
          <label key={mode.modeId} className={`model-mode-radio ${selectedMode === mode.modeId ? 'active' : ''}`}>
            <input
              type="radio"
              name="model-mode"
              checked={selectedMode === mode.modeId}
              onChange={() => handleModeChange(mode.modeId)}
            />
            <span className="model-mode-radio-dot" />
            <span className="model-mode-radio-label">{mode.modeName}</span>
          </label>
        ))}
      </div>

      {/* 自定义模式的表单区域 */}
      {selectedMode !== 'default' && currentModeConfig && (
        <div className="model-config-form">
          {/* 模型厂商下拉 */}
          <div className="model-config-field">
            <label className="model-config-label">模型厂商：</label>
            <select
              className="model-config-select"
              value={selectedProviderId}
              onChange={e => handleProviderChange(e.target.value)}
            >
              <option value="">请选择厂商</option>
              {currentModeConfig.providers.map(provider => (
                <option key={provider.providerId} value={provider.providerId}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>

          {/* 模型名称下拉 */}
          {selectedProviderId && (
            <div className="model-config-field">
              <label className="model-config-label">模型名称：</label>
              <select
                className="model-config-select"
                value={selectedModelId}
                onChange={e => setSelectedModelId(e.target.value)}
              >
                <option value="">请选择模型</option>
                {availableModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}{model.contextWindow ? ` (${model.contextWindow >= 1000 ? `${Math.round(model.contextWindow / 1000)}K` : model.contextWindow})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* API Key 输入 */}
          {selectedProviderId && (
            <div className="model-config-field">
              <div className="model-config-label-row">
                <label className="model-config-label">API Key：</label>
                {currentApiKeyUrl && (
                  <a
                    className="model-config-link"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      window.electronAPI.openExternalUrl(currentApiKeyUrl);
                    }}
                  >
                    前往官网获取
                  </a>
                )}
              </div>
              {hasApiKey ? (
                <div className="model-config-apikey-status">
                  <span className="apikey-configured-text">API Key 已配置</span>
                  <button
                    className="btn btn-sm"
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
                  </button>
                </div>
              ) : (
                <div className="model-config-apikey-input">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="model-config-input"
                    placeholder="请输入 API Key"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                  />
                  <button
                    className="model-config-eye-btn"
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
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 提示文本 */}
      <div className="model-config-hint">
        *可选用自定义大模型配置，使用时请遵循相关法律法规
      </div>

      {/* 确认/取消按钮 */}
      <div className="model-config-actions">
        <button
          className="model-config-btn-confirm"
          onClick={handleConfirm}
          disabled={loading || isRestarting}
        >
          {loading ? '保存中...' : '确 认'}
        </button>
        <button
          className="model-config-btn-cancel"
          onClick={() => {
            // 重置到当前实际状态
            setApiKey('');
            setShowApiKey(false);
          }}
          disabled={loading}
        >
          取 消
        </button>
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
  const [version, setVersion] = React.useState<string>('');

  React.useEffect(() => {
    window.electronAPI.getAppInfo().then((info) => {
      setVersion(info.version);
    }).catch(() => {
      setVersion('unknown');
    });
  }, []);

  return (
    <div className="settings-section">
      <div className="settings-section-title">关于</div>

      <div className="about-card">
        <div className="about-logo">XClaw</div>
        <div className="about-name">XClaw</div>
        <div className="about-version">版本 {version || '加载中...'}</div>
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

