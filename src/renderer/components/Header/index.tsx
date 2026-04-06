/**
 * Header 组件
 * 顶部栏，包含Logo、引擎状态、当前模型显示、设置和帮助按钮
 */

import React, { useState, useEffect } from 'react';
import { Settings, HelpCircle, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="size-2 rounded-full bg-yellow-500 animate-pulse" />
        <span>检查中...</span>
      </div>
    );
  }

  if (status.isRunning && status.isHealthy) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="size-2 rounded-full bg-green-500" />
        <span>AI引擎运行中</span>
      </div>
    );
  }

  if (status.isRunning && !status.isHealthy) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="size-2 rounded-full bg-red-500" />
        <span>AI引擎异常</span>
        <button
          className="ml-1 text-xs text-primary hover:underline"
          onClick={onRestart}
        >
          重启
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="size-2 rounded-full bg-red-500" />
      <span>AI引擎未运行</span>
      <button
        className="ml-1 text-xs text-primary hover:underline"
        onClick={onRestart}
      >
        重启
      </button>
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
    const loadCurrentModel = async () => {
      try {
        const result = await window.electronAPI.getCurrentAppModel();
        if (result.success && result.current) {
          setProvider(result.current.openclawProviderId);
          setCurrentModel(result.current.modelName);
          return;
        }
        setProvider('');
        setCurrentModel('');
      } catch (error) {
        console.error('Failed to load current model:', error);
      }
    };

    loadCurrentModel();
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
    <button
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      onClick={onClick}
      title="点击配置模型"
    >
      <span>{getProviderIcon(provider)}</span>
      <span className="max-w-[200px] truncate">
        {provider ? `${getProviderName(provider)} / ${currentModel}` : '未配置模型'}
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-50">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
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
    window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'ai' } }));
  };

  return (
    <header className="flex items-center h-12 px-3 border-b border-border bg-background shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2">
        {showSidebarToggle && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleSidebar}
            className="shrink-0"
          >
            <Menu className="size-5" />
          </Button>
        )}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center size-6 rounded-md bg-primary text-primary-foreground text-xs font-bold">
            X
          </div>
          <span className="text-sm font-semibold">XClaw</span>
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 flex justify-center">
        <EngineStatusIndicator
          status={engineStatus}
          onRestart={onRestartEngine}
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <CurrentModelDisplay onClick={handleOpenModelSettings} />
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button variant="ghost" size="sm" onClick={onOpenSettings} title="设置" className="gap-1">
          <Settings className="size-4" />
          <span className="hidden sm:inline">设置</span>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onOpenHelp} title="帮助">
          <HelpCircle className="size-4" />
        </Button>
      </div>
    </header>
  );
};

export default Header;
