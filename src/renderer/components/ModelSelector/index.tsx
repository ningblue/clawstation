/**
 * ModelSelector 组件 - 轻量下拉选择器
 *
 * 聊天界面底部栏的模型快切组件
 * 只显示已配置的可用模型，点击直接切换
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import { useModels } from '../../hooks/useModels';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
      className={cn('relative', className)}
    >
      {/* 触发按钮 */}
      <button
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors',
          'hover:bg-muted hover:text-foreground',
          (disabled || isRestarting) && 'opacity-50 pointer-events-none',
        )}
        onClick={() => !disabled && !isRestarting && setIsOpen(!isOpen)}
        disabled={disabled}
        title={isRestarting ? '切换中...' : '切换模型'}
      >
        <span className={cn(
          'flex items-center justify-center size-5 rounded text-xs font-medium bg-muted',
        )}>
          {isRestarting ? '...' : currentProviderName ? currentProviderName.charAt(0) : '?'}
        </span>
        <span className="text-muted-foreground">
          {isRestarting ? '切换中...' : currentDisplayName}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {/* 模型列表 */}
          <div className="max-h-64 overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <span>加载中...</span>
              </div>
            ) : configuredModels.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground">
                <span>暂无可用模型</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNavigateToSettings}
                >
                  去配置
                </Button>
              </div>
            ) : (
              <>
                {(() => {
                  const grouped = new Map<string, typeof configuredModels>();
                  for (const m of configuredModels) {
                    const list = grouped.get(m.provider) || [];
                    list.push(m);
                    grouped.set(m.provider, list);
                  }
                  return Array.from(grouped.entries()).map(([provider, models]) => (
                    <div key={provider}>
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        {provider}
                      </div>
                      {models.map(model => {
                        const isSelected = currentModelStr === `${model.providerId}/${model.modelId}`;
                        return (
                          <div
                            key={`${model.providerId}/${model.modelId}`}
                            className={cn(
                              'flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors',
                              isSelected
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-muted',
                            )}
                            onClick={() => handleModelSelect(model.providerId, model.modelId)}
                          >
                            <span className="truncate">{model.modelName}</span>
                            {isSelected && (
                              <span className="shrink-0 text-primary ml-2">&#10003;</span>
                            )}
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
          <div className="border-t border-border p-1">
            <button
              className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={handleNavigateToSettings}
            >
              <Settings className="size-3.5" />
              管理模型配置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
