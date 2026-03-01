/**
 * Header 组件
 * 顶部栏，包含Logo、引擎状态、当前模型显示、设置和帮助按钮
 */

import React, { useState, useEffect } from 'react';
import type { EngineStatus } from '../../stores';

export interface HeaderProps {
  /** 引擎状态 */
  engineStatus: EngineStatus | null;
  /** 重启引擎回调 */
  onRestartEngine?: () => void;
  /** 打开设置回调 */
  onOpenSettings?: () => void;
  /** 打开帮助回调 */
  onOpenHelp?: () => void;
  /** 切换侧边栏回调（移动端） */
  onToggleSidebar?: () => void;
  /** 是否显示侧边栏切换按钮 */
  showSidebarToggle?: boolean;
}

/**
 * 引擎状态指示器组件
 */
const EngineStatusIndicator: React.FC<{
  status: EngineStatus | null;
  onRestart?: () => void;
}> = ({ status, onRestart }) => {
  if (!status) {
    return (
      <div className="engine-status checking">
        <div className="status-indicator"></div>
        <span>检查中...</span>
      </div>
    );
  }

  if (status.isRunning && status.isHealthy) {
    return (
      <div className="engine-status running">
        <div className="status-indicator"></div>
        <span className="engine-status-text">AI引擎运行中</span>
      </div>
    );
  }

  if (status.isRunning && !status.isHealthy) {
    return (
      <div className="engine-status stopped">
        <div className="status-indicator"></div>
        <span className="engine-status-text">AI引擎异常</span>
        <button className="engine-status-btn" onClick={onRestart}>重启</button>
      </div>
    );
  }

  return (
    <div className="engine-status stopped">
      <div className="status-indicator"></div>
      <span className="engine-status-text">AI引擎未运行</span>
      <button className="engine-status-btn" onClick={onRestart}>重启</button>
    </div>
  );
};

/**
 * 当前模型显示组件
 * 只显示当前使用的模型，点击打开设置
 */
const CurrentModelDisplay: React.FC<{
  onClick?: () => void;
}> = ({ onClick }) => {
  const [currentModel, setCurrentModel] = useState<string>('');
  const [provider, setProvider] = useState<string>('');

  useEffect(() => {
    // 加载当前模型配置
    const loadCurrentModel = async () => {
      try {
        const result = await window.electronAPI.getDefaultAgent();
        if (result.success && result.agent?.model) {
          const modelConfig = result.agent.model;
          let modelStr = '';
          if (typeof modelConfig === 'string') {
            modelStr = modelConfig;
          } else if (modelConfig.primary) {
            modelStr = modelConfig.primary;
          }

          if (modelStr) {
            const parts = modelStr.split('/');
            if (parts.length >= 2 && parts[0]) {
              setProvider(parts[0]);
              setCurrentModel(parts.slice(1).join('/'));
            }
          }
        }
      } catch (error) {
        console.error('Failed to load current model:', error);
      }
    };

    loadCurrentModel();
    // 监听模型变化事件
    const handleModelChanged = () => loadCurrentModel();
    window.addEventListener('model-changed', handleModelChanged);
    return () => window.removeEventListener('model-changed', handleModelChanged);
  }, []);

  const getProviderIcon = (providerId: string): string => {
    const icons: Record<string, string> = {
      anthropic: '🅰️',
      openai: '🅾️',
      google: '🇬',
      'google-generative-ai': '🇬',
      azure: '🇦',
      bedrock: '🇧',
      ollama: '🦙',
      deepseek: '🇩',
      cohere: '🇨',
      minimax: '🇲',
      moonshot: '🇰',
      baidu: '🇧',
      bytedance: '🇧',
    };
    return icons[providerId] || '🤖';
  };

  const getProviderName = (providerId: string): string => {
    const names: Record<string, string> = {
      anthropic: 'Anthropic',
      openai: 'OpenAI',
      google: 'Google',
      'google-generative-ai': 'Google',
      azure: 'Azure',
      bedrock: 'AWS',
      ollama: 'Ollama',
      deepseek: 'DeepSeek',
      cohere: 'Cohere',
      minimax: 'MiniMax',
      moonshot: 'Kimi',
      baidu: '百度',
      bytedance: '豆包',
    };
    return names[providerId] || providerId;
  };

  return (
    <div className="current-model-display" onClick={onClick} title="点击配置模型">
      <span className="current-model-icon">{getProviderIcon(provider)}</span>
      <span className="current-model-text">
        {provider ? `${getProviderName(provider)} / ${currentModel}` : '未配置模型'}
      </span>
      <svg className="current-model-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  );
};

/**
 * Header 组件
 */
export const Header: React.FC<HeaderProps> = ({
  engineStatus,
  onRestartEngine,
  onOpenSettings,
  onOpenHelp,
  onToggleSidebar,
  showSidebarToggle = false,
}) => {
  const handleOpenModelSettings = () => {
    // 打开设置页面并切换到AI模型标签
    window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'ai' } }));
  };

  return (
    <header className="header">
      <div className="header-left">
        {showSidebarToggle && (
          <button className="sidebar-toggle" onClick={onToggleSidebar}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
        <div className="logo">
          <div className="logo-icon">C</div>
          <span className="logo-text">ClawStation</span>
        </div>
      </div>

      <div className="header-center">
        <EngineStatusIndicator
          status={engineStatus}
          onRestart={onRestartEngine}
        />
      </div>

      <div className="header-right">
        <CurrentModelDisplay onClick={handleOpenModelSettings} />
        <div className="header-divider"></div>
        <button className="header-btn" onClick={onOpenSettings} title="设置">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>设置</span>
        </button>
        <button className="header-btn" onClick={onOpenHelp} title="帮助">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
