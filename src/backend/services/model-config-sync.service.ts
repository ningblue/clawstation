import type {
  AppModelConfig,
  ModelModeId,
  VendorConfig,
} from "../../shared/types/model-config.types";
import { ALL_VENDOR_DEFAULTS } from "../../shared/constants/vendor-defaults";
import {
  OpenClawConfigManager,
  type AuthProfileCredential,
  type OpenClawConfig,
} from "../config/openclaw-config-manager";

const MANAGED_AGENT_IDS = ["default", "main"] as const;

function isConfigurableMode(
  modeId: ModelModeId
): modeId is Exclude<ModelModeId, "default"> {
  return modeId === "model-api" || modeId === "coding-plan";
}

export class ModelConfigSyncService {
  constructor(private readonly configManager: OpenClawConfigManager) {}

  private buildSyncedModels(vendor: VendorConfig): Array<{
    id: string;
    name: string;
    contextWindow?: number;
    maxTokens?: number;
  }> {
    return vendor.models.map((model) => {
      const syncedModel: {
        id: string;
        name: string;
        contextWindow?: number;
        maxTokens?: number;
      } = {
        id: model.id,
        name: model.name,
      };

      if (model.contextWindow && model.contextWindow > 0) {
        syncedModel.contextWindow = model.contextWindow;
        syncedModel.maxTokens = model.contextWindow;
      }

      return syncedModel;
    });
  }

  setApiKey(vendor: VendorConfig, apiKey: string): void {
    const credential: AuthProfileCredential = {
      type: "api_key",
      provider: vendor.openclawProviderId,
      key: apiKey,
      baseUrl: vendor.baseUrl,
    };

    for (const agentId of MANAGED_AGENT_IDS) {
      const authProfiles = this.configManager.loadAuthProfiles(agentId);
      authProfiles.profiles[`${vendor.openclawProviderId}:default`] = {
        ...credential,
      };
      if (vendor.authProfileId !== vendor.openclawProviderId) {
        authProfiles.profiles[`${vendor.authProfileId}:default`] = {
          ...credential,
          provider: vendor.authProfileId,
        };
      }
      this.configManager.saveAuthProfiles(agentId, authProfiles);
    }
  }

  removeApiKey(vendor: VendorConfig): void {
    for (const agentId of MANAGED_AGENT_IDS) {
      const authProfiles = this.configManager.loadAuthProfiles(agentId);
      delete authProfiles.profiles[`${vendor.openclawProviderId}:default`];
      if (vendor.authProfileId !== vendor.openclawProviderId) {
        delete authProfiles.profiles[`${vendor.authProfileId}:default`];
      }
      this.configManager.saveAuthProfiles(agentId, authProfiles);
    }
  }

  syncAppConfig(appConfig: AppModelConfig): void {
    const config = this.configManager.loadConfig();
    const managedProviderIds = new Set(
      ALL_VENDOR_DEFAULTS.map((vendor: VendorConfig | any) => vendor.openclawProviderId)
    );

    config.auth = config.auth ?? { profiles: {} };
    config.auth.profiles = config.auth.profiles ?? {};
    config.models = config.models ?? { mode: "merge", providers: {} };
    config.models.providers = config.models.providers ?? {};

    for (const providerId of managedProviderIds) {
      delete config.models.providers[providerId];
    }

    for (const vendor of ALL_VENDOR_DEFAULTS) {
      config.auth.profiles[`${vendor.openclawProviderId}:default`] = {
        provider: vendor.openclawProviderId,
        mode: "api_key",
      };
    }

    for (const modeId of ["model-api", "coding-plan"] as const) {
      const modeConfig = appConfig.modes[modeId];
      for (const vendor of modeConfig.vendors) {
        if (!vendor.apiKeyConfigured) {
          continue;
        }

        const credential = this.getCredential(vendor);
        if (!credential?.key) {
          continue;
        }

        config.auth.profiles[`${vendor.openclawProviderId}:default`] = {
          provider: vendor.openclawProviderId,
          mode: credential.type === "oauth" ? "oauth" : "api_key",
        };
        config.models.providers[vendor.openclawProviderId] = {
          baseUrl: vendor.baseUrl,
          apiKey: credential.key,
          auth: credential.type === "oauth" ? "oauth" : "api-key",
          ...(vendor.api ? { api: vendor.api } : {}),
          ...(vendor.authHeader ? { authHeader: true } : {}),
          models: this.buildSyncedModels(vendor),
        };
      }
    }

    this.syncDefaultModel(config, appConfig);
    this.configManager.saveConfig();
  }

  private getCredential(vendor: VendorConfig): AuthProfileCredential | null {
    for (const agentId of MANAGED_AGENT_IDS) {
      const authProfiles = this.configManager.loadAuthProfiles(agentId);
      const direct =
        authProfiles.profiles[`${vendor.openclawProviderId}:default`];
      if (direct?.key) {
        return direct;
      }
      const shared =
        authProfiles.profiles[`${vendor.authProfileId}:default`];
      if (shared?.key) {
        return shared;
      }
    }
    return null;
  }

  private syncDefaultModel(
    config: OpenClawConfig,
    appConfig: AppModelConfig
  ): void {
    const modeId = appConfig.activeMode;

    config.agents = config.agents ?? {};
    config.agents.defaults = config.agents.defaults ?? {};
    const defaultAgent = config.agents.list?.find((agent) => agent.default);

    // 企业 default 模式：直接配置企业端点
    if (modeId === "default") {
      const vendor = appConfig.modes.default.vendor;
      if (!vendor) return;
      const providerId = vendor.vendorId;
      config.models = config.models ?? { mode: "merge", providers: {} };
      config.models.providers = config.models.providers ?? {};
      config.models.providers[providerId] = {
        baseUrl: vendor.baseUrl,
        apiKey: vendor.apiKey,
        ...(vendor.api ? { api: vendor.api } : {}),
        ...(vendor.authHeader ? { authHeader: true } : {}),
        models: [{ id: vendor.model, name: vendor.modelName }],
      };
      const modelString = `${providerId}/${vendor.model}`;
      config.agents.defaults.model = modelString;
      if (defaultAgent) {
        defaultAgent.model = modelString;
      }
      return;
    }

    if (!isConfigurableMode(modeId)) {
      return;
    }

    const modelString = this.resolveDefaultModelString(appConfig, modeId);

    if (!modelString) {
      delete config.agents.defaults.model;
      if (defaultAgent) {
        delete defaultAgent.model;
      }
      return;
    }

    config.agents.defaults = {
      ...config.agents.defaults,
      model: modelString,
    };
    if (defaultAgent) {
      defaultAgent.model = modelString;
    }
  }

  private resolveDefaultModelString(
    appConfig: AppModelConfig,
    modeId: Exclude<ModelModeId, "default">
  ): string | null {
    const modeConfig = appConfig.modes[modeId];
    const selected = modeConfig.selectedModel;

    if (selected) {
      const selectedVendor = modeConfig.vendors.find(
        (item) => item.vendorId === selected.vendorId
      );
      if (
        selectedVendor?.apiKeyConfigured &&
        selectedVendor.models.some((item) => item.id === selected.modelId)
      ) {
        return `${selectedVendor.openclawProviderId}/${selected.modelId}`;
      }
    }

    for (const vendor of modeConfig.vendors) {
      if (!vendor.apiKeyConfigured || vendor.models.length === 0) {
        continue;
      }
      return `${vendor.openclawProviderId}/${vendor.models[0]!.id}`;
    }

    return null;
  }
}
