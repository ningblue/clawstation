import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import log from "electron-log";
import {
  createDefaultAppModelConfig,
  findVendorDefaultByOpenClawProvider,
} from "../../shared/constants/vendor-defaults";
import type {
  AppModelConfig,
  AppModelCurrentSelection,
  ModelModeId,
  ModeConfig,
} from "../../shared/types/model-config.types";
import {
  APP_MODEL_CONFIG_VERSION,
  isConfigurableModeId,
  type VendorModelRef,
} from "../../shared/types/model-config.types";
import { OpenClawConfigManager } from "./openclaw-config-manager";

function normalizeLegacySelection(
  selection: VendorModelRef | null | undefined
): VendorModelRef | null {
  if (!selection) {
    return null;
  }

  if (
    selection.vendorId === "kimi-coding" &&
    selection.modelId === "kimi-for-coding"
  ) {
    return {
      vendorId: "kimi-coding",
      modelId: "kimi-k2.5",
    };
  }

  return selection;
}

export class AppModelConfigManager {
  private readonly log = log.scope("AppModelConfigManager");
  private readonly configDir: string;
  private readonly configPath: string;

  constructor(
    private readonly openclawConfigManager: OpenClawConfigManager,
    configDir?: string
  ) {
    this.configDir = configDir || path.join(os.homedir(), ".clawstation");
    this.configPath = path.join(this.configDir, "model-config.json");
  }

  initialize(): AppModelConfig {
    this.ensureConfigDir();
    if (!fs.existsSync(this.configPath)) {
      const migrated = this.migrateFromLegacy();
      this.saveConfig(migrated);
      return migrated;
    }

    const loaded = this.loadConfig();
    const normalized = this.normalizeConfig(loaded);
    if (JSON.stringify(loaded) !== JSON.stringify(normalized)) {
      this.saveConfig(normalized);
    }
    return normalized;
  }

  getConfig(): AppModelConfig {
    return this.initialize();
  }

  getModeConfig(modeId: ModelModeId): ModeConfig | null {
    const config = this.initialize();
    return isConfigurableModeId(modeId) ? config.modes[modeId] : null;
  }

  setMode(modeId: ModelModeId): AppModelConfig {
    const config = this.initialize();
    config.activeMode = modeId;
    this.saveConfig(config);
    return config;
  }

  selectModel(
    modeId: Exclude<ModelModeId, "default">,
    vendorId: string,
    modelId: string
  ): AppModelConfig {
    const config = this.initialize();
    const modeConfig = config.modes[modeId];
    const vendor = modeConfig.vendors.find((item) => item.vendorId === vendorId);
    if (!vendor) {
      throw new Error(`Unknown vendor: ${vendorId}`);
    }
    if (!vendor.models.some((item) => item.id === modelId)) {
      throw new Error(`Unknown model: ${vendorId}/${modelId}`);
    }

    modeConfig.selectedModel = { vendorId, modelId };
    config.activeMode = modeId;
    this.saveConfig(config);
    return config;
  }

  setApiKeyConfigured(
    modeId: Exclude<ModelModeId, "default">,
    vendorId: string,
    configured: boolean
  ): AppModelConfig {
    const config = this.initialize();
    const modeConfig = config.modes[modeId];
    const vendor = modeConfig.vendors.find((item) => item.vendorId === vendorId);
    if (!vendor) {
      throw new Error(`Unknown vendor: ${vendorId}`);
    }

    vendor.apiKeyConfigured = configured;
    if (
      !configured &&
      modeConfig.selectedModel?.vendorId === vendorId
    ) {
      modeConfig.selectedModel = null;
    }
    this.saveConfig(config);
    return config;
  }

  getCurrentSelection(): AppModelCurrentSelection | null {
    const config = this.initialize();

    // 企业 default 模式
    if (config.activeMode === "default") {
      const defaultMode = config.modes.default;
      if (!defaultMode.enabled || !defaultMode.vendor) {
        return null;
      }
      return {
        modeId: "default" as any,
        vendorId: defaultMode.vendor.vendorId,
        modelId: defaultMode.vendor.model,
        modelName: defaultMode.vendor.modelName,
        providerLabel: defaultMode.vendor.label,
        openclawProviderId: defaultMode.vendor.vendorId,
      };
    }

    if (!isConfigurableModeId(config.activeMode)) {
      return null;
    }

    const modeConfig = config.modes[config.activeMode];
    const current = modeConfig.selectedModel;
    if (!current) {
      return null;
    }

    const vendor = modeConfig.vendors.find(
      (item) => item.vendorId === current.vendorId
    );
    if (!vendor || !vendor.apiKeyConfigured) {
      return null;
    }

    const model = vendor.models.find((item) => item.id === current.modelId);
    if (!model) {
      return null;
    }

    return {
      modeId: config.activeMode,
      vendorId: vendor.vendorId,
      modelId: model.id,
      modelName: model.name,
      providerLabel: vendor.label,
      openclawProviderId: vendor.openclawProviderId,
    };
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private loadConfig(): AppModelConfig {
    const content = fs.readFileSync(this.configPath, "utf8");
    return JSON.parse(content) as AppModelConfig;
  }

  private saveConfig(config: AppModelConfig): void {
    this.ensureConfigDir();
    const tempPath = `${this.configPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
    fs.renameSync(tempPath, this.configPath);
  }

  private normalizeConfig(input: AppModelConfig): AppModelConfig {
    const base = createDefaultAppModelConfig(
      input?.activeMode === "coding-plan" ? "coding-plan" : "model-api"
    );

    // 确定 activeMode：尊重用户已有的选择
    let resolvedActiveMode: ModelModeId;
    if (
      input?.activeMode === "default" ||
      input?.activeMode === "model-api" ||
      input?.activeMode === "coding-plan"
    ) {
      resolvedActiveMode = input.activeMode;
    } else if (base.modes.default.enabled) {
      // 首次初始化且企业模式启用时，默认使用 default
      resolvedActiveMode = "default";
    } else {
      resolvedActiveMode = base.activeMode;
    }

    return {
      version: APP_MODEL_CONFIG_VERSION,
      activeMode: resolvedActiveMode,
      modes: {
        default: base.modes.default.enabled ? base.modes.default : (input?.modes?.default?.enabled ? input.modes.default : base.modes.default),
        "model-api": this.mergeModeConfig(
          base.modes["model-api"],
          input?.modes?.["model-api"]
        ),
        "coding-plan": this.mergeModeConfig(
          base.modes["coding-plan"],
          input?.modes?.["coding-plan"]
        ),
      },
    };
  }

  private mergeModeConfig(base: ModeConfig, input?: ModeConfig): ModeConfig {
    const vendors = base.vendors.map((vendor) => {
      const existing = input?.vendors?.find(
        (item) => item.vendorId === vendor.vendorId
      );
      return {
        ...vendor,
        apiKeyConfigured: existing?.apiKeyConfigured ?? vendor.apiKeyConfigured,
      };
    });

    const selected = normalizeLegacySelection(input?.selectedModel);
    const selectedValid =
      selected &&
      vendors.some(
        (vendor) =>
          vendor.vendorId === selected.vendorId &&
          vendor.models.some((model) => model.id === selected.modelId)
      )
        ? selected
        : null;

    return {
      selectedModel: selectedValid,
      vendors,
    };
  }

  private migrateFromLegacy(): AppModelConfig {
    const config = createDefaultAppModelConfig("model-api");
    const openclawConfig = this.openclawConfigManager.loadConfig();
    const modelValue =
      (typeof openclawConfig.agents?.defaults?.model === "string"
        ? openclawConfig.agents?.defaults?.model
        : openclawConfig.agents?.list?.find((agent) => agent.default)?.model) ??
      "";

    const modelString =
      typeof modelValue === "string" ? modelValue : modelValue?.primary ?? "";
    if (modelString) {
      const [providerId, ...modelParts] = modelString.split("/");
      const modelId = modelParts.join("/");
      if (providerId && modelId) {
        for (const modeId of ["model-api", "coding-plan"] as const) {
          const vendorDefault = findVendorDefaultByOpenClawProvider(
            modeId,
            providerId
          );
          if (vendorDefault) {
            config.activeMode = modeId;
            config.modes[modeId].selectedModel = normalizeLegacySelection({
              vendorId: vendorDefault.vendorId,
              modelId,
            });
            break;
          }
        }
      }
    }

    const configuredProviders = new Set<string>();
    for (const agentId of ["default", "main"] as const) {
      const authProfiles = this.openclawConfigManager.getAuthProfiles(agentId);
      authProfiles.forEach((profile) => configuredProviders.add(profile.provider));
    }

    for (const modeId of ["model-api", "coding-plan"] as const) {
      for (const vendor of config.modes[modeId].vendors) {
        if (
          configuredProviders.has(vendor.openclawProviderId) ||
          configuredProviders.has(vendor.authProfileId)
        ) {
          vendor.apiKeyConfigured = true;
        }
      }
    }

    this.log.info("Migrated model-config.json from legacy OpenClaw config");
    return config;
  }
}
