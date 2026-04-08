import React, { useEffect, useMemo, useState } from "react";
import { useModels } from "../../hooks/useModels";
import type { ModelModeId } from "../../../shared/types/model-config.types";

interface AIModelSettingsProps {
  onShowToast: (message: string, type: "success" | "error") => void;
}

const CUSTOM_MODES: Array<{
  id: Exclude<ModelModeId, "default">;
  label: string;
}> = [
  { id: "model-api", label: "自定义大模型—模型 API" },
  { id: "coding-plan", label: "自定义大模型—Coding Plan" },
];

export const AIModelSettings: React.FC<AIModelSettingsProps> = ({
  onShowToast,
}) => {
  const {
    appConfig,
    activeMode,
    currentSelectionInfo,
    loading,
    isRestarting,
    setMode,
    setApiKey,
    removeApiKey,
    selectModel,
  } = useModels();

  const enterpriseDefault = appConfig?.modes.default;
  const hasEnterpriseDefault = enterpriseDefault?.enabled === true;

  // 当前选中的 tab：default | model-api | coding-plan
  const [selectedTab, setSelectedTab] = useState<ModelModeId>("model-api");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [apiKey, setApiKeyValue] = useState("");

  // 兼容旧代码中对 selectedMode 的引用（仅用于自定义模式）
  const selectedMode =
    selectedTab === "default" ? "model-api" : selectedTab;

  useEffect(() => {
    if (activeMode === "default" && hasEnterpriseDefault) {
      setSelectedTab("default");
    } else if (activeMode === "model-api" || activeMode === "coding-plan") {
      setSelectedTab(activeMode);
    }
  }, [activeMode, hasEnterpriseDefault]);

  useEffect(() => {
    if (selectedTab === "default") return;
    const modeConfig = appConfig?.modes[selectedTab];
    if (!modeConfig) {
      return;
    }
    const selected = modeConfig.selectedModel;
    if (selected) {
      setSelectedVendorId(selected.vendorId);
      setSelectedModelId(selected.modelId);
      return;
    }
    const firstVendor = modeConfig.vendors[0];
    setSelectedVendorId(firstVendor?.vendorId ?? "");
    setSelectedModelId("");
  }, [appConfig, selectedTab]);

  const currentModeConfig = appConfig?.modes[selectedMode];
  const selectedVendor = currentModeConfig?.vendors.find(
    (vendor) => vendor.vendorId === selectedVendorId
  );

  const currentModelDisplay = useMemo(() => {
    if (activeMode === "default" && hasEnterpriseDefault) {
      return "企业大模型";
    }
    if (!currentSelectionInfo) {
      return "未配置模型";
    }
    return `${currentSelectionInfo.providerLabel} / ${currentSelectionInfo.modelName}`;
  }, [activeMode, hasEnterpriseDefault, currentSelectionInfo]);

  const applySelection = async () => {
    if (!selectedVendor) {
      onShowToast("请选择模型厂商", "error");
      return;
    }
    if (!selectedModelId) {
      onShowToast("请选择模型", "error");
      return;
    }
    try {
      const nextApiKey = apiKey.trim();
      if (!selectedVendor.apiKeyConfigured) {
        if (!nextApiKey) {
          onShowToast("请输入 API Key", "error");
          return;
        }
        await setApiKey(selectedMode, selectedVendor.vendorId, nextApiKey);
      }
      await setMode(selectedMode);
      await selectModel(selectedVendor.vendorId, selectedModelId, selectedMode);
      if (!selectedVendor.apiKeyConfigured) {
        setApiKeyValue("");
      }
      onShowToast(
        selectedVendor.apiKeyConfigured ? "模型已切换" : "API Key 已保存并应用",
        "success"
      );
    } catch (error) {
      const action = selectedVendor.apiKeyConfigured ? "切换失败" : "保存并应用失败";
      onShowToast(`${action}: ${error instanceof Error ? error.message : "未知错误"}`, "error");
    }
  };

  return (
    <div className="animate-in fade-in duration-200">
      <div className="text-xl font-semibold text-foreground mb-5">大模型设置</div>

      <div className="rounded-xl border border-border p-4 mb-5">
        <div className="text-xs text-muted-foreground mb-1">当前使用</div>
        <div className="text-sm font-medium text-foreground">{currentModelDisplay}</div>
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {hasEnterpriseDefault && enterpriseDefault?.vendor && (
          <label
            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${selectedTab === "default" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <input
              type="radio"
              name="model-mode"
              className="sr-only"
              checked={selectedTab === "default"}
              onChange={() => setSelectedTab("default")}
            />
            <span className="text-sm font-medium">
              企业大模型
            </span>
          </label>
        )}
        {CUSTOM_MODES.map((mode) => (
          <label
            key={mode.id}
            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${selectedTab === mode.id ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <input
              type="radio"
              name="model-mode"
              className="sr-only"
              checked={selectedTab === mode.id}
              onChange={() => setSelectedTab(mode.id)}
            />
            <span className="text-sm font-medium">{mode.label}</span>
          </label>
        ))}
      </div>

      {selectedTab === "default" ? (
        <div className="flex items-center justify-end">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            disabled={loading || isRestarting}
            onClick={async () => {
              try {
                await setMode("default");
                onShowToast("已切换到企业大模型", "success");
              } catch (error) {
                onShowToast(`切换失败: ${error instanceof Error ? error.message : "未知错误"}`, "error");
              }
            }}
          >
            {loading || isRestarting ? "保存中..." : "应用模型"}
          </button>
        </div>
      ) : (
        <>
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm font-medium text-muted-foreground">模型厂商</label>
          <select
            className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={selectedVendorId}
            onChange={(event) => {
              setSelectedVendorId(event.target.value);
              setSelectedModelId("");
            }}
          >
            {currentModeConfig?.vendors.map((vendor) => (
              <option key={vendor.vendorId} value={vendor.vendorId}>
                {vendor.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">模型名称</label>
          <select
            className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={selectedModelId}
            onChange={(event) => setSelectedModelId(event.target.value)}
          >
            <option value="">请选择模型</option>
            {selectedVendor?.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        {selectedVendor && (
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">API Key</div>
              {selectedVendor.apiKeyConfigured && (
                <button
                  className="text-xs text-destructive"
                  disabled={loading}
                  onClick={async () => {
                    try {
                      await removeApiKey(selectedMode, selectedVendor.vendorId);
                      onShowToast("API Key 已删除", "success");
                    } catch (error) {
                      onShowToast(
                        `删除失败: ${error instanceof Error ? error.message : "未知错误"}`,
                        "error"
                      );
                    }
                  }}
                >
                  删除
                </button>
              )}
            </div>
            {selectedVendor.apiKeyConfigured ? (
              <div className="text-sm text-muted-foreground">已配置</div>
            ) : (
              <>
                <input
                  type="password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="输入 API Key"
                  value={apiKey}
                  onChange={(event) => setApiKeyValue(event.target.value)}
                />
                <div className="mt-2 flex items-center justify-between">
                  <button
                    className="text-xs text-primary"
                    onClick={() => {
                      if (selectedVendor.apiKeyUrl) {
                        window.electronAPI.openExternalUrl(selectedVendor.apiKeyUrl);
                      }
                    }}
                  >
                    前往官网获取
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end">
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={
            loading ||
            isRestarting ||
            !selectedVendor ||
            !selectedModelId ||
            (!selectedVendor.apiKeyConfigured && !apiKey.trim())
          }
          onClick={applySelection}
        >
          {loading || isRestarting
            ? "保存中..."
            : selectedVendor?.apiKeyConfigured
            ? "应用模型"
            : "保存并应用"}
        </button>
      </div>
        </>
      )}
    </div>
  );
};

export default AIModelSettings;
