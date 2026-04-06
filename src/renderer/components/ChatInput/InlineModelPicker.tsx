import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Settings } from "lucide-react";
import { useModels } from "../../hooks/useModels";
import type { ModelModeId } from "../../../shared/types/model-config.types";
import { cn } from "@/lib/utils";

function formatContextWindow(contextWindow?: number): string | null {
  if (!contextWindow) {
    return null;
  }
  if (contextWindow >= 1000000) {
    return `${(contextWindow / 1000000).toFixed(1)}M`;
  }
  if (contextWindow >= 1000) {
    return `${Math.round(contextWindow / 1000)}K`;
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
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedMode, setSelectedMode] =
    useState<Exclude<ModelModeId, "default">>("model-api");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    activeMode,
    currentSelection,
    currentSelectionInfo,
    loading,
    isRestarting,
    providerGroupList,
    selectModel,
  } = useModels();

  useEffect(() => {
    if (activeMode === "model-api" || activeMode === "coding-plan") {
      setSelectedMode(activeMode);
    }
  }, [activeMode]);

  const groupsForMode = useMemo(() => {
    return providerGroupList
      .map((group) => ({
        ...group,
        subCategories: group.subCategories.filter(
          (subcategory) => subcategory.modeId === selectedMode
        ),
      }))
      .filter((group) => group.subCategories.length > 0);
  }, [providerGroupList, selectedMode]);

  const preferredGroupId = useMemo(() => {
    if (currentSelection?.modeId === selectedMode) {
      const matchedGroup = groupsForMode.find(
        (group) => group.groupId === currentSelection.provider
      );
      if (matchedGroup) {
        return matchedGroup.groupId;
      }
    }

    const configuredGroup = groupsForMode.find(
      (group) => group.subCategories[0]?.hasApiKey
    );
    return configuredGroup?.groupId ?? groupsForMode[0]?.groupId ?? null;
  }, [currentSelection?.modeId, currentSelection?.provider, groupsForMode, selectedMode]);

  useEffect(() => {
    if (!selectedGroupId || !groupsForMode.some((group) => group.groupId === selectedGroupId)) {
      setSelectedGroupId(preferredGroupId);
    }
  }, [groupsForMode, preferredGroupId, selectedGroupId]);

  useEffect(() => {
    if (isOpen && preferredGroupId && currentSelection?.modeId === selectedMode) {
      setSelectedGroupId(preferredGroupId);
    }
  }, [currentSelection?.modeId, isOpen, preferredGroupId, selectedMode]);

  useEffect(() => {
    if (!isOpen && searchKeyword) {
      setSearchKeyword("");
    }
  }, [isOpen, searchKeyword]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredGroups = useMemo(() => {
    if (!searchKeyword.trim()) {
      return groupsForMode;
    }
    const keyword = searchKeyword.toLowerCase();
    return groupsForMode.filter(
      (group) =>
        group.groupName.toLowerCase().includes(keyword) ||
        group.subCategories.some(
          (subcategory) =>
            subcategory.models.some(
              (model) =>
                model.name.toLowerCase().includes(keyword) ||
                model.id.toLowerCase().includes(keyword)
            )
        )
    );
  }, [groupsForMode, searchKeyword]);

  const selectedGroup =
    filteredGroups.find((group) => group.groupId === selectedGroupId) ??
    filteredGroups[0] ??
    null;
  const currentSubCategory = selectedGroup?.subCategories[0] ?? null;

  const currentLabel = currentSelectionInfo
    ? `${currentSelectionInfo.modelName} / ${currentSelectionInfo.providerLabel}`
    : "选择模型";

  const handleModelSelect = async (providerId: string, modelId: string) => {
    try {
      await selectModel(providerId, modelId, selectedMode);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to select model:", error);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className={cn(
          "flex min-w-[280px] items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted",
          (disabled || isRestarting) && "pointer-events-none opacity-50"
        )}
        disabled={disabled}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="max-w-[260px] truncate text-muted-foreground">
          {isRestarting ? "切换中..." : currentLabel}
        </span>
        <ChevronDown className={cn("size-3.5", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 z-[80] mb-2 w-[min(440px,calc(100vw-24px))] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-border bg-popover shadow-xl sm:w-[min(460px,calc(100vw-40px))] sm:max-w-[calc(100vw-40px)]">
          <div className="border-b border-border p-2.5">
            <div className="mb-2.5 flex gap-2">
              <button
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium",
                  selectedMode === "model-api"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
                onClick={() => setSelectedMode("model-api")}
              >
                模型 API
              </button>
              <button
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium",
                  selectedMode === "coding-plan"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
                onClick={() => setSelectedMode("coding-plan")}
              >
                Coding Plan
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                className="w-full bg-transparent text-xs outline-none"
                placeholder="搜索模型或厂商"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
            </div>
          </div>

          <div className="grid min-h-[260px] max-h-[min(68vh,460px)] grid-cols-1 overflow-hidden md:grid-cols-[182px_minmax(0,1fr)]">
            <div className="max-h-[180px] overflow-y-auto border-b border-border p-2 md:max-h-none md:border-b-0 md:border-r">
              {filteredGroups.map((group) => {
                const subcategory = group.subCategories[0];
                const isConfigured = Boolean(subcategory?.hasApiKey);
                return (
                  <button
                    key={group.groupId}
                    className={cn(
                      "mb-1 w-full rounded-lg px-2.5 py-2 text-left",
                      selectedGroup?.groupId === group.groupId
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() => setSelectedGroupId(group.groupId)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 text-[13px] font-medium leading-4">
                        {group.groupName}
                      </div>
                      <div
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          isConfigured
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isConfigured ? "已配" : "未配"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="min-w-0 overflow-y-auto p-3">
              {!currentSubCategory ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  暂无可用模型
                </div>
              ) : !currentSubCategory.hasApiKey ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <div>该厂商尚未配置 API Key</div>
                  <button
                    className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5"
                    onClick={() => {
                      setIsOpen(false);
                      window.dispatchEvent(
                        new CustomEvent("open-settings", { detail: { tab: "ai" } })
                      );
                    }}
                  >
                    <Settings className="size-4" />
                    去设置
                  </button>
                </div>
              ) : loading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  加载中...
                </div>
              ) : (
                <div className="space-y-1.5">
                  {currentSubCategory.models.map((model) => {
                    const isSelected =
                      currentSelection?.provider === model.provider &&
                      currentSelection?.model === model.id &&
                      currentSelection?.modeId === selectedMode;
                    return (
                      <button
                        key={`${model.provider}/${model.id}`}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        )}
                        onClick={() => handleModelSelect(model.provider, model.id)}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="truncate text-[13px] font-medium leading-5">
                            {model.name}
                          </div>
                          {formatContextWindow(model.contextWindow) && (
                            <div className="shrink-0 text-[11px] text-muted-foreground">
                              {formatContextWindow(model.contextWindow)}
                            </div>
                          )}
                        </div>
                        {isSelected && <span className="text-[11px] text-primary">当前</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InlineModelPicker;
