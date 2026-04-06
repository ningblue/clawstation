import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createDefaultAppModelConfig } from "../../../src/shared/constants/vendor-defaults";
import { OpenClawConfigManager } from "../../../src/backend/config/openclaw-config-manager";
import { ModelConfigSyncService } from "../../../src/backend/services/model-config-sync.service";

describe("ModelConfigSyncService", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawstation-sync-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("projects configured app model state into OpenClaw config", () => {
    const configManager = new OpenClawConfigManager(tempDir);
    configManager.initializeConfig();

    const syncService = new ModelConfigSyncService(configManager);
    const appConfig = createDefaultAppModelConfig("coding-plan");
    const vendor = appConfig.modes["coding-plan"].vendors.find(
      (item) => item.vendorId === "modelstudio-plan"
    );

    expect(vendor).toBeDefined();
    if (!vendor) {
      throw new Error("Expected modelstudio vendor");
    }

    vendor.apiKeyConfigured = true;
    appConfig.modes["coding-plan"].selectedModel = {
      vendorId: vendor.vendorId,
      modelId: "qwen3-coder-plus",
    };

    const existingConfig = configManager.loadConfig();
    existingConfig.auth = {
      profiles: {
        "volcengine-plan:default": {
          provider: "volcengine-plan",
          mode: "api_key",
        },
      },
    };
    existingConfig.models = {
      mode: "merge",
      providers: {
        "volcengine-plan": {
          baseUrl: "https://old.example.com",
          apiKey: "old-key",
          auth: "api-key",
          models: [],
        },
      },
    };
    configManager.saveConfig();

    syncService.setApiKey(vendor, "sk-plan");
    syncService.syncAppConfig(appConfig);

    const syncedConfig = configManager.loadConfig();
    expect(syncedConfig.models?.providers?.["modelstudio-plan"]).toBeDefined();
    expect(syncedConfig.models?.providers?.["modelstudio-plan"]?.apiKey).toBe(
      "sk-plan"
    );
    expect(syncedConfig.auth?.profiles?.["modelstudio-plan:default"]).toEqual({
      provider: "modelstudio-plan",
      mode: "api_key",
    });
    expect(syncedConfig.models?.providers?.["volcengine-plan"]).toBeUndefined();
    expect(syncedConfig.auth?.profiles?.["volcengine-plan:default"]).toEqual({
      provider: "volcengine-plan",
      mode: "api_key",
    });
    expect(syncedConfig.agents?.defaults?.model).toBe(
      "modelstudio-plan/qwen3-coder-plus"
    );
  });

  it("removes provider auth projection after API key deletion", () => {
    const configManager = new OpenClawConfigManager(tempDir);
    configManager.initializeConfig();

    const syncService = new ModelConfigSyncService(configManager);
    const appConfig = createDefaultAppModelConfig("coding-plan");
    const vendor = appConfig.modes["coding-plan"].vendors.find(
      (item) => item.vendorId === "modelstudio-plan"
    );

    expect(vendor).toBeDefined();
    if (!vendor) {
      throw new Error("Expected modelstudio vendor");
    }

    vendor.apiKeyConfigured = true;
    appConfig.modes["coding-plan"].selectedModel = {
      vendorId: vendor.vendorId,
      modelId: "qwen3-coder-plus",
    };

    syncService.setApiKey(vendor, "sk-plan");
    syncService.syncAppConfig(appConfig);

    vendor.apiKeyConfigured = false;
    syncService.removeApiKey(vendor);
    syncService.syncAppConfig(appConfig);

    const syncedConfig = configManager.loadConfig();
    expect(syncedConfig.models?.providers?.["modelstudio-plan"]).toBeUndefined();
    expect(syncedConfig.auth?.profiles?.["modelstudio-plan:default"]).toEqual({
      provider: "modelstudio-plan",
      mode: "api_key",
    });

    const defaultAuth = configManager.loadAuthProfiles("default");
    const mainAuth = configManager.loadAuthProfiles("main");
    expect(defaultAuth.profiles["modelstudio-plan:default"]).toBeUndefined();
    expect(mainAuth.profiles["modelstudio-plan:default"]).toBeUndefined();
  });

  it("falls back to another configured model when active selection becomes invalid", () => {
    const configManager = new OpenClawConfigManager(tempDir);
    configManager.initializeConfig();

    const syncService = new ModelConfigSyncService(configManager);
    const appConfig = createDefaultAppModelConfig("coding-plan");
    const primaryVendor = appConfig.modes["coding-plan"].vendors.find(
      (item) => item.vendorId === "modelstudio-plan"
    );
    const fallbackVendor = appConfig.modes["coding-plan"].vendors.find(
      (item) => item.vendorId === "minimax-plan"
    );

    expect(primaryVendor).toBeDefined();
    expect(fallbackVendor).toBeDefined();
    if (!primaryVendor || !fallbackVendor) {
      throw new Error("Expected fallback vendors");
    }

    primaryVendor.apiKeyConfigured = false;
    fallbackVendor.apiKeyConfigured = true;
    appConfig.modes["coding-plan"].selectedModel = {
      vendorId: primaryVendor.vendorId,
      modelId: "qwen3-coder-plus",
    };

    syncService.setApiKey(fallbackVendor, "sk-fallback");
    syncService.syncAppConfig(appConfig);

    const syncedConfig = configManager.loadConfig();
    expect(syncedConfig.agents?.defaults?.model).toBe(
      `minimax-plan/${fallbackVendor.models[0]!.id}`
    );
  });

  it("does not write zero context limits for vendors that do not define them", () => {
    const configManager = new OpenClawConfigManager(tempDir);
    configManager.initializeConfig();

    const syncService = new ModelConfigSyncService(configManager);
    const appConfig = createDefaultAppModelConfig("model-api");
    const vendor = appConfig.modes["model-api"].vendors.find(
      (item) => item.vendorId === "zai"
    );

    expect(vendor).toBeDefined();
    if (!vendor) {
      throw new Error("Expected zai vendor");
    }

    vendor.apiKeyConfigured = true;
    appConfig.modes["model-api"].selectedModel = {
      vendorId: vendor.vendorId,
      modelId: "glm-5-turbo",
    };

    syncService.setApiKey(vendor, "sk-zai");
    syncService.syncAppConfig(appConfig);

    const syncedProvider = configManager.loadConfig().models?.providers?.["zai"];
    expect(syncedProvider).toBeDefined();
    expect(syncedProvider?.models[0]).toEqual({
      id: "glm-5-turbo",
      name: "GLM-5-Turbo",
    });
  });
});
