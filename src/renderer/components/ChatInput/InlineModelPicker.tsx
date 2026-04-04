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
import { ChevronDown, Settings, Search } from 'lucide-react';
import { useModels, getProviderDisplayName } from '../../hooks/useModels';
import type { ProviderGroup, SubCategory } from '../../types/models';
import { cn } from '@/lib/utils';

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

    if (selectedSubCategoryId) {
      const sc = selectedGroup.subCategories.find(s => s.id === selectedSubCategoryId);
      if (sc) {
        return [{ group: selectedGroup, subCategory: sc }];
      }
    }

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
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const dropdownHeight = 400;
        const spaceAbove = rect.top;
        const spaceBelow = viewportHeight - rect.bottom;

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

  const triggerText = isRestarting
    ? '切换中...'
    : currentModelInfo?.model?.name || '选择模型';

  const triggerIcon = isRestarting
    ? '...'
    : currentModelInfo?.group
      ? currentModelInfo.group.icon
      : '?';

  return (
    <div ref={dropdownRef} className="relative">
      {/* 触发按钮 */}
      <button
        ref={triggerRef}
        className={cn(
          'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
          'hover:bg-muted',
          isRestarting && 'animate-pulse',
          !currentModelInfo?.model && !isRestarting && 'text-muted-foreground',
        )}
        onClick={handleToggle}
        disabled={disabled}
        title={isRestarting ? '引擎重启中...' : '切换模型'}
      >
        <span className="text-sm">{triggerIcon}</span>
        <span className="max-w-[120px] truncate">{triggerText}</span>
        <ChevronDown
          className={cn(
            'size-3 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* 下拉面板（使用 fixed 定位） */}
      {isOpen && (
        <div
          className={cn(
            'fixed z-50 flex flex-col rounded-lg border border-border bg-popover shadow-xl overflow-hidden',
            showMiddleColumn ? 'w-[560px]' : 'w-[420px]',
          )}
          style={{
            bottom: dropdownPosition.bottom || 'auto',
            top: dropdownPosition.bottom === 0 ? 'auto' : undefined,
            left: dropdownPosition.left,
          }}
        >
          {/* 搜索栏 */}
          <div className="border-b border-border p-2">
            <div className="relative flex items-center">
              <Search className="size-4 ml-2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
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
          </div>

          {/* 内容区 */}
          <div className={cn(
            'flex min-h-0 flex-1',
            showMiddleColumn ? 'max-h-[400px]' : 'max-h-[400px]',
          )}>
            {/* 左栏: 供应商分组 */}
            {!searchKeyword.trim() && (
              <div className="w-28 shrink-0 border-r border-border overflow-y-auto">
                <div
                  className={cn(
                    'px-2 py-1.5 text-xs cursor-pointer transition-colors',
                    selectedGroupId === null
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  onClick={() => {
                    setSelectedGroupId(null);
                    setSelectedSubCategoryId(null);
                  }}
                >
                  全部
                </div>
                {providerGroupList.map(group => (
                  <div
                    key={group.groupId}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 text-xs cursor-pointer transition-colors',
                      selectedGroupId === group.groupId
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      !group.hasAnyApiKey && 'opacity-60',
                    )}
                    onClick={() => handleGroupClick(group)}
                    title={group.hasAnyApiKey ? group.groupName : `${group.groupName} - 未配置，点击去配置`}
                  >
                    <span className="truncate flex-1">{group.groupName}</span>
                    <span className={cn(
                      'size-1.5 rounded-full shrink-0',
                      group.hasAnyApiKey ? 'bg-green-500' : 'bg-muted-foreground/30',
                    )} />
                  </div>
                ))}
              </div>
            )}

            {/* 中栏: 子分类 (仅多子分类分组显示) */}
            {showMiddleColumn && !searchKeyword.trim() && selectedGroup && (
              <div className="w-28 shrink-0 border-r border-border overflow-y-auto">
                {selectedGroup.subCategories.map(sc => (
                  <div
                    key={sc.id}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 text-xs cursor-pointer transition-colors',
                      selectedSubCategoryId === sc.id
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      !sc.hasApiKey && 'opacity-60',
                    )}
                    onClick={() => handleSubCategoryClick(sc)}
                    title={sc.hasApiKey ? sc.label : `${sc.label} - 未配置`}
                  >
                    <span className="truncate flex-1">{sc.label}</span>
                    <span className="text-[10px] text-muted-foreground">{sc.models.length}</span>
                    <span className={cn(
                      'size-1.5 rounded-full shrink-0',
                      sc.hasApiKey ? 'bg-green-500' : 'bg-muted-foreground/30',
                    )} />
                  </div>
                ))}
              </div>
            )}

            {/* 右栏: 模型列表 */}
            <div className="flex-1 overflow-y-auto min-w-0">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <span className="mr-2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  <span>加载中...</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-8 text-sm text-destructive">
                  <span>加载失败</span>
                </div>
              ) : displayModels.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <span>未找到模型</span>
                </div>
              ) : (
                displayModels.map(({ group, subCategory }) => (
                  <div key={`${group.groupId}/${subCategory.providerId}`}>
                    <div className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground sticky top-0 bg-popover">
                      <span>{group.icon} {group.hasMultipleSubCategories ? `${group.groupName} / ${subCategory.label}` : group.groupName}</span>
                      {!subCategory.hasApiKey && (
                        <span className="ml-auto text-[10px] rounded bg-muted px-1.5 py-0.5">需配置</span>
                      )}
                    </div>
                    {subCategory.hasApiKey ? (
                      subCategory.models.map(model => {
                        const isSelected = currentModelInfo?.modelString === `${model.provider}/${model.id}`;
                        return (
                          <div
                            key={`${model.provider}/${model.id}`}
                            className={cn(
                              'flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer transition-colors',
                              isSelected
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-muted',
                            )}
                            onClick={() => handleModelSelect(model.provider, model.id)}
                          >
                            <span className="flex items-center gap-1 truncate">
                              {model.name}
                              {isSelected && <span className="text-primary">&#10003;</span>}
                            </span>
                            {model.contextWindow && (
                              <span className="ml-2 shrink-0 text-[10px] text-muted-foreground bg-muted rounded px-1 py-0.5">
                                {formatContextWindow(model.contextWindow)}
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div
                        className="px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
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
          <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
            <span className="text-xs text-muted-foreground">
              {configuredProviders.length} 个服务商已配置
            </span>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleNavigateToSettings}
            >
              <Settings className="size-3" />
              管理配置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InlineModelPicker;
