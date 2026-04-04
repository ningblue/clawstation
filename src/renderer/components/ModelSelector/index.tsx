/**
 * ModelSelector 组件 - 轻量下拉选择器
 *
 * 聊天界面底部栏的模型快切组件
 * 只显示已配置的可用模型，点击直接切换
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useModels } from '../../hooks/useModels';

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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    providerGroups,
    currentSelection,
    loading,
    isRestarting,
    selectModel,
    getProviderDisplayName,
  } = useModels();

  // 当前模型字符串
  const currentModelStr = currentModel || (currentSelection ? `${currentSelection.provider}/${currentSelection.model}` : '');

  // 已配置的模型（扁平列表）
  const configuredModels = useMemo(() => {
    const models: { provider: string; providerId: string; modelId: string; modelName: string }[] = [];
    for (const group of providerGroups) {
      if (group.hasApiKey && group.models.length > 0) {
        for (const model of group.models) {
          models.push({
            provider: getProviderDisplayName(group.provider),
            providerId: model.provider,
            modelId: model.id,
            modelName: model.name,
          });
        }
      }
    }
    return models;
  }, [providerGroups, getProviderDisplayName]);

  // 当前模型的显示名
  const currentDisplayName = useMemo(() => {
    if (!currentModelStr) return '选择模型';
    const found = configuredModels.find(m => `${m.providerId}/${m.modelId}` === currentModelStr);
    return found ? found.modelName : currentModelStr.split('/').pop() || '选择模型';
  }, [currentModelStr, configuredModels]);

  // 当前模型的厂商显示名
  const currentProviderName = useMemo(() => {
    if (!currentModelStr) return '';
    const found = configuredModels.find(m => `${m.providerId}/${m.modelId}` === currentModelStr);
    return found ? found.provider : '';
  }, [currentModelStr, configuredModels]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleModelSelect = async (providerId: string, modelId: string) => {
    const modelString = `${providerId}/${modelId}`;
    setIsOpen(false);
    try {
      await selectModel(providerId, modelId);
      onChange?.(modelString);
    } catch (err) {
      console.error('Failed to select model:', err);
    }
  };

  const handleNavigateToSettings = () => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'ai' } }));
  };

  return (
    <div
      ref={dropdownRef}
      className={`model-selector ${className} ${disabled ? 'disabled' : ''}`}
    >
      {/* 触发按钮 */}
      <button
        className={`model-selector__trigger ${isRestarting ? 'restarting' : ''}`}
        onClick={() => !disabled && !isRestarting && setIsOpen(!isOpen)}
        disabled={disabled}
        title={isRestarting ? '切换中...' : '切换模型'}
      >
        <span className={`model-selector__trigger-icon ${isRestarting ? 'spinning' : ''}`}>
          {isRestarting ? '...' : currentProviderName ? currentProviderName.charAt(0) : '?'}
        </span>
        <span className="model-selector__trigger-text">
          {isRestarting ? '切换中...' : currentDisplayName}
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
          {/* 模型列表 */}
          <div className="model-selector__models">
            {loading ? (
              <div className="model-selector__loading">
                <span>加载中...</span>
              </div>
            ) : configuredModels.length === 0 ? (
              <div className="model-selector__empty">
                <span>暂无可用模型</span>
                <button
                  className="model-selector__config-btn"
                  onClick={handleNavigateToSettings}
                >
                  去配置
                </button>
              </div>
            ) : (
              <>
                {/* 按厂商分组 */}
                {(() => {
                  const grouped = new Map<string, typeof configuredModels>();
                  for (const m of configuredModels) {
                    const list = grouped.get(m.provider) || [];
                    list.push(m);
                    grouped.set(m.provider, list);
                  }
                  return Array.from(grouped.entries()).map(([provider, models]) => (
                    <div key={provider} className="model-selector__group">
                      <div className="model-selector__group-title">{provider}</div>
                      {models.map(model => {
                        const isSelected = currentModelStr === `${model.providerId}/${model.modelId}`;
                        return (
                          <div
                            key={`${model.providerId}/${model.modelId}`}
                            className={`model-selector__model-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleModelSelect(model.providerId, model.modelId)}
                          >
                            <span className="model-selector__model-name">
                              {model.modelName}
                            </span>
                            {isSelected && <span className="model-selector__model-check">&#10003;</span>}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </>
            )}
          </div>

          {/* 底部 */}
          <div className="model-selector__footer">
            <button
              className="model-selector__footer-action"
              onClick={handleNavigateToSettings}
            >
              管理模型配置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
