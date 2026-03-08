/**
 * ModelSelector 组件
 *
 * 独立的模型选择器，可嵌入任意页面
 * 特性：
 * - 三栏层级: 左侧供应商分组 + 中间子分类 + 右侧模型列表
 * - 无子分类的供应商跳过中栏直接显示模型
 * - 支持搜索过滤
 * - 已配置/未配置供应商用不同颜色区分
 * - 未配置供应商点击跳转设置页
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useModels } from '../../hooks/useModels';
import type { ProviderGroup, SubCategory } from '../../types/models';
import './styles.css';

// 格式化上下文窗口大小
function formatContextWindow(contextWindow: number): string {
  if (contextWindow >= 1000000) {
    return `${(contextWindow / 1000000).toFixed(1)}M`;
  }
  if (contextWindow >= 1000) {
    return `${(contextWindow / 1000).toFixed(0)}K`;
  }
  return String(contextWindow);
}

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
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    providerGroupList,
    configuredProviders,
    currentSelection,
    loading,
    error,
    isRestarting,
    selectModel,
  } = useModels();

  // 当前选中的 group
  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return providerGroupList.find(g => g.groupId === selectedGroupId) || null;
  }, [selectedGroupId, providerGroupList]);

  // 是否显示中栏
  const showMiddleColumn = selectedGroup?.hasMultipleSubCategories ?? false;

  // 当前模型信息
  const currentModelInfo = useMemo(() => {
    const selection = currentModel || (currentSelection ? `${currentSelection.provider}/${currentSelection.model}` : null);
    if (!selection) return null;

    const [providerId, modelId] = selection.split('/');
    if (!providerId || !modelId) return null;

    for (const group of providerGroupList) {
      for (const sc of group.subCategories) {
        const model = sc.models.find(
          m => m.provider === providerId && m.id === modelId
        );
        if (model) {
          return { group, subCategory: sc, model, modelString: selection };
        }
      }
    }
    return { group: null, subCategory: null, model: null, modelString: selection };
  }, [currentModel, currentSelection, providerGroupList]);

  // 右栏要显示的模型
  const displayModels = useMemo(() => {
    // 搜索模式: 跨所有分组搜索
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      const results: { group: ProviderGroup; subCategory: SubCategory }[] = [];
      for (const group of providerGroupList) {
        for (const sc of group.subCategories) {
          const filtered = sc.models.filter(
            m => m.name.toLowerCase().includes(keyword) || m.id.toLowerCase().includes(keyword)
          );
          if (filtered.length > 0 || group.groupName.toLowerCase().includes(keyword) || sc.label.toLowerCase().includes(keyword)) {
            results.push({
              group,
              subCategory: {
                ...sc,
                models: filtered.length > 0 ? filtered : sc.models,
              },
            });
          }
        }
      }
      return results;
    }

    // 未选中任何分组: 展示所有已配置分组的模型
    if (!selectedGroup) {
      const results: { group: ProviderGroup; subCategory: SubCategory }[] = [];
      for (const group of providerGroupList) {
        for (const sc of group.subCategories) {
          if (sc.models.length > 0) {
            results.push({ group, subCategory: sc });
          }
        }
      }
      return results;
    }

    // 选中了特定子分类
    if (selectedSubCategoryId) {
      const sc = selectedGroup.subCategories.find(s => s.id === selectedSubCategoryId);
      if (sc) {
        return [{ group: selectedGroup, subCategory: sc }];
      }
    }

    // 显示分组下所有子分类的模型
    return selectedGroup.subCategories
      .filter(sc => sc.models.length > 0)
      .map(sc => ({ group: selectedGroup, subCategory: sc }));
  }, [searchKeyword, selectedGroup, selectedSubCategoryId, providerGroupList]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 打开时聚焦搜索框，关闭时重置状态
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchKeyword('');
      setSelectedGroupId(null);
      setSelectedSubCategoryId(null);
    }
  }, [isOpen]);

  // 处理模型选择
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

  const handleGroupClick = (group: ProviderGroup) => {
    if (!group.hasAnyApiKey) {
      handleNavigateToSettings();
      return;
    }
    if (selectedGroupId === group.groupId) {
      setSelectedGroupId(null);
      setSelectedSubCategoryId(null);
    } else {
      setSelectedGroupId(group.groupId);
      setSelectedSubCategoryId(null);
    }
  };

  const handleSubCategoryClick = (sc: SubCategory) => {
    if (!sc.hasApiKey) {
      handleNavigateToSettings();
      return;
    }
    if (selectedSubCategoryId === sc.id) {
      setSelectedSubCategoryId(null);
    } else {
      setSelectedSubCategoryId(sc.id);
    }
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
        title={isRestarting ? '引擎重启中...' : '切换模型'}
      >
        <span className={`model-selector__trigger-icon ${isRestarting ? 'spinning' : ''}`}>
          {isRestarting ? '...' : currentModelInfo?.group?.icon || '?'}
        </span>
        <span className="model-selector__trigger-text">
          {isRestarting ? '切换中...' : currentModelInfo?.model?.name || '选择模型'}
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
        <div className={`model-selector__dropdown ${showMiddleColumn ? 'three-col' : ''}`}>
          {/* 搜索栏 */}
          <div className="model-selector__search">
            <span className="model-selector__search-icon">&#128269;</span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索模型..."
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                if (e.target.value.trim()) {
                  setSelectedGroupId(null);
                  setSelectedSubCategoryId(null);
                }
              }}
            />
          </div>

          {/* 内容区 */}
          <div className="model-selector__content">
            {/* 左栏: 供应商分组 */}
            {!searchKeyword.trim() && (
              <div className="model-selector__providers">
                <div
                  className={`model-selector__provider-item ${selectedGroupId === null ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedGroupId(null);
                    setSelectedSubCategoryId(null);
                  }}
                >
                  <span className="model-selector__provider-name">全部</span>
                </div>
                {providerGroupList.map(group => (
                  <div
                    key={group.groupId}
                    className={`model-selector__provider-item ${
                      selectedGroupId === group.groupId ? 'active' : ''
                    } ${!group.hasAnyApiKey ? 'unconfigured' : ''}`}
                    onClick={() => handleGroupClick(group)}
                    title={group.hasAnyApiKey ? group.groupName : `${group.groupName} - 未配置，点击去配置`}
                  >
                    <span className="model-selector__provider-name">
                      {group.groupName}
                    </span>
                    <span className={`model-selector__provider-status ${group.hasAnyApiKey ? 'configured' : ''}`} />
                  </div>
                ))}
              </div>
            )}

            {/* 中栏: 子分类 (仅多子分类分组显示) */}
            {showMiddleColumn && !searchKeyword.trim() && selectedGroup && (
              <div className="model-selector__subcategories">
                {selectedGroup.subCategories.map(sc => (
                  <div
                    key={sc.id}
                    className={`model-selector__subcategory-item ${
                      selectedSubCategoryId === sc.id ? 'active' : ''
                    } ${!sc.hasApiKey ? 'unconfigured' : ''}`}
                    onClick={() => handleSubCategoryClick(sc)}
                    title={sc.hasApiKey ? sc.label : `${sc.label} - 未配置`}
                  >
                    <span className="model-selector__subcategory-label">
                      {sc.label}
                    </span>
                    <span className="model-selector__subcategory-count">
                      {sc.models.length}
                    </span>
                    <span className={`model-selector__provider-status ${sc.hasApiKey ? 'configured' : ''}`} />
                  </div>
                ))}
              </div>
            )}

            {/* 右栏: 模型列表 */}
            <div className="model-selector__models">
              {loading ? (
                <div className="model-selector__loading">
                  <div className="model-selector__spinner" />
                  <span>加载模型中...</span>
                </div>
              ) : error ? (
                <div className="model-selector__error">
                  <span>{error}</span>
                </div>
              ) : displayModels.length === 0 ? (
                <div className="model-selector__empty">
                  <span>未找到匹配的模型</span>
                </div>
              ) : (
                displayModels.map(({ group, subCategory }) => (
                  <div key={`${group.groupId}/${subCategory.providerId}`} className="model-selector__group">
                    <div className="model-selector__group-title">
                      <span>
                        {group.icon} {group.hasMultipleSubCategories ? `${group.groupName} / ${subCategory.label}` : group.groupName}
                      </span>
                      {!subCategory.hasApiKey && (
                        <span className="model-selector__group-badge">需配置</span>
                      )}
                    </div>
                    {subCategory.hasApiKey ? (
                      subCategory.models.map(model => {
                        const isSelected = currentModelInfo?.modelString === `${model.provider}/${model.id}`;
                        return (
                          <div
                            key={`${model.provider}/${model.id}`}
                            className={`model-selector__model-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleModelSelect(model.provider, model.id)}
                          >
                            <div className="model-selector__model-info">
                              <div className="model-selector__model-name">
                                {model.name}
                                {isSelected && <span className="model-selector__model-check">&#10003;</span>}
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
                      })
                    ) : (
                      <div
                        className="model-selector__unconfigured-hint"
                        onClick={handleNavigateToSettings}
                      >
                        点击配置 API Key 后可使用
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 底部信息 */}
          <div className="model-selector__footer">
            <span className="model-selector__footer-info">
              {configuredProviders.length} 个服务商已配置
            </span>
            <button
              className="model-selector__footer-action"
              onClick={handleNavigateToSettings}
            >
              管理配置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
