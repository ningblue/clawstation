import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AppModelConfig,
  AppModelCurrentSelection,
  ModelConfig,
  ModelModeId,
  ProviderGroup,
  ProviderModelGroup,
  SubCategory,
  UserModelSelection,
} from "../types/models";

function isConfigurableModeId(
  modeId: ModelModeId
): modeId is Exclude<ModelModeId, "default"> {
  return modeId === "model-api" || modeId === "coding-plan";
}

export function getProviderDisplayName(
  providerId: string,
  appConfig?: AppModelConfig
): string {
  if (!appConfig) {
    return providerId;
  }

  for (const modeId of ["model-api", "coding-plan"] as const) {
    const vendor = appConfig.modes[modeId].vendors.find(
      (item) => item.vendorId === providerId
    );
    if (vendor) {
      return vendor.label;
    }
  }
  return providerId;
}

export function useModels() {
  const [appConfig, setAppConfig] = useState<AppModelConfig | null>(null);
  const [currentSelectionInfo, setCurrentSelectionInfo] =
    useState<AppModelCurrentSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);

      const [config, current] = await Promise.all([
        window.electronAPI.getAppModelConfig(),
        window.electronAPI.getCurrentAppModel(),
      ]);

      if (!config.success || !config.config) {
        throw new Error(config.error || "Failed to load app model config");
      }
      if (!current.success) {
        throw new Error(current.error || "Failed to load current selection");
      }

      setAppConfig(config.config);
      setCurrentSelectionInfo(current.current ?? null);
    } catch (err) {
      console.error("Failed to load app model config:", err);
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const updateModeConfig = useCallback(
    (
      modeId: Exclude<ModelModeId, "default">,
      updater: (mode: AppModelConfig["modes"][Exclude<ModelModeId, "default">]) => AppModelConfig["modes"][Exclude<ModelModeId, "default">]
    ) => {
      setAppConfig((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          modes: {
            ...prev.modes,
            [modeId]: updater(prev.modes[modeId]),
          },
        };
      });
    },
    []
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handler = () => {
      loadData();
    };
    window.addEventListener("model-changed", handler);
    return () => window.removeEventListener("model-changed", handler);
  }, [loadData]);

  const activeMode = appConfig?.activeMode ?? "model-api";

  const currentSelection = useMemo<UserModelSelection | null>(() => {
    if (!currentSelectionInfo) {
      return null;
    }
    return {
      modeId: currentSelectionInfo.modeId,
      provider: currentSelectionInfo.vendorId,
      model: currentSelectionInfo.modelId,
    };
  }, [currentSelectionInfo]);

  const providerGroupList = useMemo<ProviderGroup[]>(() => {
    if (!appConfig) {
      return [];
    }

    const vendorIds = new Set<string>([
      ...appConfig.modes["model-api"].vendors.map((vendor) => vendor.vendorId),
      ...appConfig.modes["coding-plan"].vendors.map((vendor) => vendor.vendorId),
    ]);

    return Array.from(vendorIds).map((vendorId) => {
      const subCategories: SubCategory[] = [];

      for (const modeId of ["model-api", "coding-plan"] as const) {
        const vendor = appConfig.modes[modeId].vendors.find(
          (item) => item.vendorId === vendorId
        );
        if (!vendor) {
          continue;
        }
        subCategories.push({
          id: `${modeId}:${vendorId}`,
          modeId,
          providerId: vendor.vendorId,
          label: modeId === "model-api" ? "模型 API" : "Coding Plan",
          models: vendor.models.map((model) => ({
            id: model.id,
            name: model.name,
            provider: vendor.vendorId,
            contextWindow: model.contextWindow,
            maxTokens: model.contextWindow,
          })),
          hasApiKey: vendor.apiKeyConfigured,
        });
      }

      const seed =
        appConfig.modes["model-api"].vendors.find(
          (vendor) => vendor.vendorId === vendorId
        ) ??
        appConfig.modes["coding-plan"].vendors.find(
          (vendor) => vendor.vendorId === vendorId
        );

      return {
        groupId: vendorId,
        groupName:
          seed?.label.replace(/（.*?）/g, "").replace(/\(.*?\)/g, "").trim() ??
          vendorId,
        icon: seed?.icon ?? "",
        subCategories,
        hasAnyApiKey: subCategories.some((item) => item.hasApiKey),
        hasMultipleSubCategories: subCategories.length > 1,
      };
    });
  }, [appConfig]);

  const providerGroups = useMemo<ProviderModelGroup[]>(() => {
    if (!appConfig || !isConfigurableModeId(activeMode)) {
      return [];
    }
    return appConfig.modes[activeMode].vendors.map((vendor) => ({
      provider: vendor.vendorId,
      providerName: vendor.label,
      icon: vendor.icon,
      modeId: activeMode,
      models: vendor.models.map((model) => ({
        id: model.id,
        name: model.name,
        provider: vendor.vendorId,
        contextWindow: model.contextWindow,
        maxTokens: model.contextWindow,
      })),
      hasApiKey: vendor.apiKeyConfigured,
    }));
  }, [activeMode, appConfig]);

  const models = useMemo<ModelConfig[]>(() => {
    return providerGroups.flatMap((group) => group.models);
  }, [providerGroups]);

  const configuredProviders = useMemo<string[]>(() => {
    return providerGroups
      .filter((group) => group.hasApiKey)
      .map((group) => group.provider);
  }, [providerGroups]);

  const selectModel = useCallback(
    async (
      providerId: string,
      modelId: string,
      modeId?: Exclude<ModelModeId, "default">
    ) => {
      const resolvedMode =
        modeId ??
        currentSelection?.modeId ??
        (activeMode === "coding-plan" ? "coding-plan" : "model-api");
      setIsRestarting(true);
      try {
        const result = await window.electronAPI.invoke(
          "app:model-config:selectModel",
          providerId,
          modelId,
          resolvedMode
        );
        if (!result?.success) {
          throw new Error(result?.error || "Failed to select model");
        }
        setAppConfig((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            activeMode: resolvedMode,
            modes: {
              ...prev.modes,
              [resolvedMode]: {
                ...prev.modes[resolvedMode],
                selectedModel: {
                  vendorId: providerId,
                  modelId,
                },
              },
            },
          };
        });
        setCurrentSelectionInfo((prev) => {
          const vendor = appConfig?.modes[resolvedMode].vendors.find(
            (item) => item.vendorId === providerId
          );
          const model = vendor?.models.find((item) => item.id === modelId);
          if (!vendor || !model) {
            return prev;
          }
          return {
            modeId: resolvedMode,
            vendorId: providerId,
            modelId,
            modelName: model.name,
            providerLabel: vendor.label,
            openclawProviderId: vendor.openclawProviderId,
          };
        });
        void loadData({ silent: true });
        window.dispatchEvent(new CustomEvent("model-changed"));
      } finally {
        setIsRestarting(false);
      }
    },
    [activeMode, appConfig, currentSelection?.modeId, loadData]
  );

  const setMode = useCallback(async (modeId: ModelModeId) => {
    const result = await window.electronAPI.invoke(
      "app:model-config:setMode",
      modeId
    );
    if (!result?.success) {
      throw new Error(result?.error || "Failed to switch mode");
    }
    setAppConfig((prev) => (prev ? { ...prev, activeMode: modeId } : prev));
    void loadData({ silent: true });
  }, [loadData]);

  const setApiKey = useCallback(
    async (
      modeId: Exclude<ModelModeId, "default">,
      vendorId: string,
      apiKey: string
    ) => {
      const result = await window.electronAPI.invoke(
        "app:model-config:setApiKey",
        vendorId,
        apiKey,
        modeId
      );
      if (!result?.success) {
        throw new Error(result?.error || "Failed to set API key");
      }
      updateModeConfig(modeId, (mode) => ({
        ...mode,
        vendors: mode.vendors.map((vendor) =>
          vendor.vendorId === vendorId
            ? { ...vendor, apiKeyConfigured: true }
            : vendor
        ),
      }));
      void loadData({ silent: true });
      window.dispatchEvent(new CustomEvent("model-changed"));
    },
    [loadData, updateModeConfig]
  );

  const removeApiKey = useCallback(
    async (modeId: Exclude<ModelModeId, "default">, vendorId: string) => {
      const result = await window.electronAPI.invoke(
        "app:model-config:removeApiKey",
        vendorId,
        modeId
      );
      if (!result?.success) {
        throw new Error(result?.error || "Failed to remove API key");
      }
      updateModeConfig(modeId, (mode) => ({
        ...mode,
        selectedModel:
          mode.selectedModel?.vendorId === vendorId ? null : mode.selectedModel,
        vendors: mode.vendors.map((vendor) =>
          vendor.vendorId === vendorId
            ? { ...vendor, apiKeyConfigured: false }
            : vendor
        ),
      }));
      setCurrentSelectionInfo((prev) =>
        prev?.modeId === modeId && prev.vendorId === vendorId ? null : prev
      );
      void loadData({ silent: true });
      window.dispatchEvent(new CustomEvent("model-changed"));
    },
    [loadData, updateModeConfig]
  );

  const getVendorForMode = useCallback(
    (modeId: Exclude<ModelModeId, "default">, vendorId: string) => {
      return appConfig?.modes[modeId].vendors.find(
        (vendor) => vendor.vendorId === vendorId
      );
    },
    [appConfig]
  );

  return {
    appConfig,
    activeMode,
    models,
    providerGroups,
    providerGroupList,
    configuredProviders,
    currentSelection,
    currentSelectionInfo,
    loading,
    error,
    isRestarting,
    selectModel,
    setMode,
    setApiKey,
    removeApiKey,
    refresh: loadData,
    getProviderDisplayName: (providerId: string) =>
      getProviderDisplayName(providerId, appConfig ?? undefined),
    getVendorForMode,
  };
}
