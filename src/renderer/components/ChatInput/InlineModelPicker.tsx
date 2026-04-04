/**
 * InlineModelPicker 组件
 *
 * 输入框内部右下角的紧凑型模型选择器
 * 特性：
 * - 向上弹出下拉面板
 * - 三栏层级: 左侧供应商分组 + 中间子分类 + 右侧模型列表
 * - 无子分类的供应商跳过中栏直接显示模型
 * - 已配置/未配置供应商用不同颜色区分
 * - 未配置供应商点击跳转设置页
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useModels, getProviderDisplayName } from '../../hooks/useModels';
import type { ProviderGroup, SubCategory } from '../../types/models';

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

export interface InlineModelPickerProps {
  disabled?: boolean;
}

export const InlineModelPicker: React.FC<InlineModelPickerProps> = ({
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ bottom: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
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
    if (!currentSelection) return null;
    const modelString = `${currentSelection.provider}/${currentSelection.model}`;
    // 在 providerGroupList 中查找
    for (const group of providerGroupList) {
      for (const sc of group.subCategories) {
        const model = sc.models.find(
          m => m.provider === currentSelection.provider && m.id === currentSelection.model
        );
        if (model) {
          return { group, subCategory: sc, model, modelString };
        }
      }
    }
    return { group: null, subCategory: null, model: null, modelString };
  }, [currentSelection, providerGroupList]);

  // 右栏要显示的模型
  const displayModels = useMemo(() => {
    // 搜索模式: 跨所有分组搜索
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      const results: { group: ProviderGroup; subCategory: SubCategory; }[] = [];
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
      const results: { group: ProviderGroup; subCategory: SubCategory; }[] = [];
      for (const group of providerGroupList) {
        for (const sc of group.subCategories) {
          if (sc.models.length > 0) {
            results.push({ group, subCategory: sc });
          }
        }
      }
      return results;
    }

    // 选中了分组
    if (selectedSubCategoryId) {
      // 选中了特定子分类
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

  // 点击外部关闭
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

  // 打开时聚焦搜索框并计算位置
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      // 计算下拉面板位置
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const dropdownHeight = 400; // 下拉面板最大高度
        const spaceAbove = rect.top;
        const spaceBelow = viewportHeight - rect.bottom;

        // 优先向上弹出，如果空间不够则向下
        if (spaceAbove >= dropdownHeight || spaceAbove > spaceBelow) {
          setDropdownPosition({
            bottom: viewportHeight - rect.top + 8,
            left: rect.left,
          });
        } else {
          setDropdownPosition({
            bottom: 0,
            left: rect.left,
          });
        }
      }
    }
    if (!isOpen) {
      setSearchKeyword('');
      setSelectedGroupId(null);
      setSelectedSubCategoryId(null);
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled && !isRestarting) {
      setIsOpen(!isOpen);
    }
  };

  const handleModelSelect = async (providerId: string, modelId: string) => {
    setIsOpen(false);
    await selectModel(providerId, modelId);
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
      // 取消选中
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

  // 触发按钮显示文本
  const triggerText = isRestarting
    ? '切换中...'
    : currentModelInfo?.model?.name || '选择模型';

  const triggerIcon = isRestarting
    ? '...'
    : currentModelInfo?.group
      ? currentModelInfo.group.icon
      : '?';

  return (
    <div ref={dropdownRef} className="inline-model-picker">
      {/* 触发按钮 */}
      <button
        ref={triggerRef}
        className={`inline-model-picker__trigger ${isRestarting ? 'restarting' : ''} ${!currentModelInfo?.model && !isRestarting ? 'no-model' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        title={isRestarting ? '引擎重启中...' : '切换模型'}
      >
        <span className={`inline-model-picker__trigger-icon ${isRestarting ? 'spinning' : ''}`}>
          {triggerIcon}
        </span>
        <span className="inline-model-picker__trigger-text">{triggerText}</span>
        <svg
          className={`inline-model-picker__trigger-arrow ${isOpen ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* 下拉面板（使用 fixed 定位） */}
      {isOpen && (
        <div
          className={`inline-model-picker__dropdown ${showMiddleColumn ? 'three-col' : ''}`}
          style={{
            bottom: dropdownPosition.bottom || 'auto',
            top: dropdownPosition.bottom === 0 ? 'auto' : undefined,
            left: dropdownPosition.left,
          }}
        >
          {/* 搜索栏 */}
          <div className="inline-model-picker__search">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索模型..."
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                if (e.target.value.trim()) {
                  // 搜索时清除选中
                  setSelectedGroupId(null);
                  setSelectedSubCategoryId(null);
                }
              }}
            />
          </div>

          {/* 内容区 */}
          <div className="inline-model-picker__content">
            {/* 左栏: 供应商分组 */}
            {!searchKeyword.trim() && (
              <div className="inline-model-picker__providers">
                <div
                  className={`inline-model-picker__provider-item ${selectedGroupId === null ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedGroupId(null);
                    setSelectedSubCategoryId(null);
                  }}
                >
                  <span className="inline-model-picker__provider-name">全部</span>
                </div>
                {providerGroupList.map(group => (
                  <div
                    key={group.groupId}
                    className={`inline-model-picker__provider-item ${
                      selectedGroupId === group.groupId ? 'active' : ''
                    } ${!group.hasAnyApiKey ? 'unconfigured' : ''}`}
                    onClick={() => handleGroupClick(group)}
                    title={group.hasAnyApiKey ? group.groupName : `${group.groupName} - 未配置，点击去配置`}
                  >
                    <span className="inline-model-picker__provider-name">
                      {group.groupName}
                    </span>
                    <span className={`inline-model-picker__provider-dot ${group.hasAnyApiKey ? 'configured' : ''}`} />
                  </div>
                ))}
              </div>
            )}

            {/* 中栏: 子分类 (仅多子分类分组显示) */}
            {showMiddleColumn && !searchKeyword.trim() && selectedGroup && (
              <div className="inline-model-picker__subcategories">
                {selectedGroup.subCategories.map(sc => (
                  <div
                    key={sc.id}
                    className={`inline-model-picker__subcategory-item ${
                      selectedSubCategoryId === sc.id ? 'active' : ''
                    } ${!sc.hasApiKey ? 'unconfigured' : ''}`}
                    onClick={() => handleSubCategoryClick(sc)}
                    title={sc.hasApiKey ? sc.label : `${sc.label} - 未配置`}
                  >
                    <span className="inline-model-picker__subcategory-label">
                      {sc.label}
                    </span>
                    <span className="inline-model-picker__subcategory-count">
                      {sc.models.length}
                    </span>
                    <span className={`inline-model-picker__provider-dot ${sc.hasApiKey ? 'configured' : ''}`} />
                  </div>
                ))}
              </div>
            )}

            {/* 右栏: 模型列表 */}
            <div className="inline-model-picker__models">
              {loading ? (
                <div className="inline-model-picker__status">
                  <span className="inline-model-picker__spinner" />
                  <span>加载中...</span>
                </div>
              ) : error ? (
                <div className="inline-model-picker__status error">
                  <span>加载失败</span>
                </div>
              ) : displayModels.length === 0 ? (
                <div className="inline-model-picker__status">
                  <span>未找到模型</span>
                </div>
              ) : (
                displayModels.map(({ group, subCategory }) => (
                  <div key={`${group.groupId}/${subCategory.providerId}`} className="inline-model-picker__group">
                    <div className="inline-model-picker__group-title">
                      <span>{group.icon} {group.hasMultipleSubCategories ? `${group.groupName} / ${subCategory.label}` : group.groupName}</span>
                      {!subCategory.hasApiKey && (
                        <span className="inline-model-picker__group-badge">需配置</span>
                      )}
                    </div>
                    {subCategory.hasApiKey ? (
                      subCategory.models.map(model => {
                        const isSelected = currentModelInfo?.modelString === `${model.provider}/${model.id}`;
                        return (
                          <div
                            key={`${model.provider}/${model.id}`}
                            className={`inline-model-picker__model-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleModelSelect(model.provider, model.id)}
                          >
                            <span className="inline-model-picker__model-name">
                              {model.name}
                              {isSelected && <span className="inline-model-picker__check">&#10003;</span>}
                            </span>
                            {model.contextWindow && (
                              <span className="inline-model-picker__model-ctx">
                                {formatContextWindow(model.contextWindow)}
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div
                        className="inline-model-picker__unconfigured-hint"
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

          {/* 底部 */}
          <div className="inline-model-picker__footer">
            <span className="inline-model-picker__footer-info">
              {configuredProviders.length} 个服务商已配置
            </span>
            <button
              className="inline-model-picker__footer-action"
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

export default InlineModelPicker;
