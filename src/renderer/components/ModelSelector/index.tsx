/**
 * ModelSelector 组件
 *
 * 参考LobeHub的ModelSwitchPanel设计，提供服务商+模型两级选择界面
 * 特性：
 * - 左侧服务商列表，右侧模型列表
 * - 支持搜索过滤
 * - 显示模型状态（可用/需配置）
 * - 支持按服务商或能力分组
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useModels, getProviderDisplayName } from '../../hooks/useModels';
import type { ModelConfig, ProviderModelGroup } from '../../types/models';
import './styles.css';

export interface ModelSelectorProps {
  /** 当前选中的模型（格式：provider/modelId） */
  currentModel?: string;
  /** 选择变更回调 */
  onChange?: (model: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 模型选择器组件
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModel,
  onChange,
  disabled = false,
  className = '',
}) => {
  // 下拉框状态
  const [isOpen, setIsOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 使用useModels hook获取数据
  const {
    providerGroups,
    configuredProviders,
    currentSelection,
    loading,
    error,
    selectModel,
  } = useModels();

  // 获取当前选中的模型信息
  const currentModelInfo = useMemo(() => {
    const selection = currentModel || currentSelection;
    if (!selection) return null;

    const modelString = typeof selection === 'string' ? selection : `${selection.provider}/${selection.model}`;
    const [providerId, modelId] = modelString.split('/');

    const provider = providerGroups.find(g => g.provider === providerId);
    const model = provider?.models.find(m => m.id === modelId);

    return {
      provider,
      model,
      modelString,
    };
  }, [currentModel, currentSelection, providerGroups]);

  // 过滤后的模型列表
  const filteredGroups = useMemo(() => {
    let groups = providerGroups;

    // 按服务商过滤
    if (selectedProvider) {
      groups = groups.filter(g => g.provider === selectedProvider);
    }

    // 按搜索关键词过滤
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      groups = groups
        .map(g => ({
          ...g,
          models: g.models.filter(m =>
            m.name.toLowerCase().includes(keyword) ||
            m.id.toLowerCase().includes(keyword)
          ),
        }))
        .filter(g => g.models.length > 0);
    }

    return groups;
  }, [providerGroups, selectedProvider, searchKeyword]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 处理模型选择
  const handleModelSelect = async (providerId: string, modelId: string) => {
    const modelString = `${providerId}/${modelId}`;

    try {
      await selectModel(providerId, modelId);
      onChange?.(modelString);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to select model:', err);
    }
  };

  // 渲染服务商列表
  const renderProviderList = () => {
    return (
      <div className="model-selector__providers">
        <div
          className={`model-selector__provider-item ${selectedProvider === null ? 'active' : ''}`}
          onClick={() => setSelectedProvider(null)}
        >
          <span className="model-selector__provider-icon">🌐</span>
          <span className="model-selector__provider-name">全部</span>
        </div>
        {providerGroups.map(group => (
          <div
            key={group.provider}
            className={`model-selector__provider-item ${
              selectedProvider === group.provider ? 'active' : ''
            } ${!group.hasApiKey ? 'disabled' : ''}`}
            onClick={() => group.hasApiKey && setSelectedProvider(group.provider)}
          >
            <span className="model-selector__provider-icon">
              {getProviderIcon(group.provider)}
            </span>
            <span className="model-selector__provider-name">
              {group.providerName}
            </span>
            <span className={`model-selector__provider-status ${group.hasApiKey ? 'configured' : ''}`} />
          </div>
        ))}
      </div>
    );
  };

  // 渲染模型列表
  const renderModelList = () => {
    if (loading) {
      return (
        <div className="model-selector__loading">
          <div className="model-selector__spinner" />
          <span>加载模型中...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="model-selector__error">
          <span>❌</span>
          <span>{error}</span>
        </div>
      );
    }

    if (filteredGroups.length === 0) {
      return (
        <div className="model-selector__empty">
          <span>🔍</span>
          <span>未找到匹配的模型</span>
        </div>
      );
    }

    return (
      <div className="model-selector__models">
        {filteredGroups.map(group => (
          <div key={group.provider} className="model-selector__group">
            <div className="model-selector__group-title">
              {getProviderIcon(group.provider)} {group.providerName}
              {!group.hasApiKey && (
                <span className="model-selector__group-badge">需配置</span>
              )}
            </div>
            {group.models.map(model => (
              <ModelItem
                key={`${group.provider}/${model.id}`}
                model={model}
                provider={group}
                isSelected={
                  currentModelInfo?.modelString === `${group.provider}/${model.id}`
                }
                isAvailable={group.hasApiKey}
                onSelect={() => handleModelSelect(group.provider, model.id)}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={dropdownRef}
      className={`model-selector ${className} ${disabled ? 'disabled' : ''}`}
    >
      {/* 触发按钮 */}
      <button
        className="model-selector__trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="model-selector__trigger-icon">
          {currentModelInfo?.provider
            ? getProviderIcon(currentModelInfo.provider.provider)
            : '🤖'}
        </span>
        <span className="model-selector__trigger-text">
          {currentModelInfo?.model?.name || '选择模型'}
        </span>
        <svg
          className={`model-selector__trigger-arrow ${isOpen ? 'open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="model-selector__dropdown">
          {/* 搜索栏 */}
          <div className="model-selector__search">
            <span className="model-selector__search-icon">🔍</span>
            <input
              type="text"
              placeholder="搜索模型..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              autoFocus
            />
          </div>

          {/* 内容区 */}
          <div className="model-selector__content">
            {renderProviderList()}
            {renderModelList()}
          </div>

          {/* 底部信息 */}
          <div className="model-selector__footer">
            <span className="model-selector__footer-info">
              {configuredProviders.length} 个服务商已配置
            </span>
            <button
              className="model-selector__footer-action"
              onClick={() => alert('模型配置页面开发中...')}
            >
              管理配置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 模型项组件
 */
interface ModelItemProps {
  model: ModelConfig;
  provider: ProviderModelGroup;
  isSelected: boolean;
  isAvailable: boolean;
  onSelect: () => void;
}

const ModelItem: React.FC<ModelItemProps> = ({
  model,
  provider,
  isSelected,
  isAvailable,
  onSelect,
}) => {
  return (
    <div
      className={`model-selector__model-item ${
        isSelected ? 'selected' : ''
      } ${!isAvailable ? 'disabled' : ''}`}
      onClick={() => isAvailable && onSelect()}
    >
      <div className="model-selector__model-icon">
        {getProviderIcon(provider.provider)}
      </div>
      <div className="model-selector__model-info">
        <div className="model-selector__model-name">
          {model.name}
          {isSelected && <span className="model-selector__model-check">✓</span>}
        </div>
        <div className="model-selector__model-meta">
          {model.contextWindow && (
            <span>{formatContextWindow(model.contextWindow)}</span>
          )}
          <div className="model-selector__model-tags">
            {model.capabilities?.vision && (
              <span className="model-selector__model-tag vision">视觉</span>
            )}
            {model.capabilities?.tools && (
              <span className="model-selector__model-tag tools">工具</span>
            )}
            {model.capabilities?.reasoning && (
              <span className="model-selector__model-tag reasoning">推理</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 获取服务商图标
 */
function getProviderIcon(providerId: string): string {
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
}

/**
 * 格式化上下文窗口大小
 */
function formatContextWindow(contextWindow: number): string {
  if (contextWindow >= 1000000) {
    return `${(contextWindow / 1000000).toFixed(1)}M`;
  }
  if (contextWindow >= 1000) {
    return `${(contextWindow / 1000).toFixed(0)}K`;
  }
  return String(contextWindow);
}

export default ModelSelector;
