import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { AppModelConfigManager } from "../../../src/backend/config/app-model-config";
import { OpenClawConfigManager } from "../../../src/backend/config/openclaw-config-manager";

describe("AppModelConfigManager", () => {
  let tempHome: string;
  let configDir: string;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "clawstation-app-model-"));
    configDir = path.join(tempHome, ".clawstation");
  });

  afterEach(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("migrates selected model and configured auth state from legacy OpenClaw config", () => {
    const openclawConfigManager = new OpenClawConfigManager(configDir);

    openclawConfigManager.initializeConfig();
    openclawConfigManager.setDefaultModel("modelstudio-plan/qwen3-coder-plus");
    openclawConfigManager.setAuthProfile("default", "modelstudio-plan", {
      type: "api_key",
      provider: "modelstudio-plan",
      key: "sk-test",
    });

    const appModelConfigManager = new AppModelConfigManager(
      openclawConfigManager,
      configDir
    );
    const config = appModelConfigManager.initialize();

    expect(config.activeMode).toBe("coding-plan");
    expect(config.modes["coding-plan"].selectedModel).toEqual({
      vendorId: "modelstudio-plan",
      modelId: "qwen3-coder-plus",
    });

    const vendor = config.modes["coding-plan"].vendors.find(
      (item) => item.vendorId === "modelstudio-plan"
    );
    expect(vendor?.apiKeyConfigured).toBe(true);

    const savedPath = path.join(configDir, "model-config.json");
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  it("normalizes invalid selected model references back to null", () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "model-config.json"),
      JSON.stringify(
        {
          version: 1,
          activeMode: "model-api",
          modes: {
            default: { enabled: false },
            "model-api": {
              selectedModel: {
                vendorId: "modelstudio",
                modelId: "does-not-exist",
              },
              vendors: [],
            },
            "coding-plan": {
              selectedModel: null,
              vendors: [],
            },
          },
        },
        null,
        2
      )
    );

    const appModelConfigManager = new AppModelConfigManager(
      new OpenClawConfigManager(configDir),
      configDir
    );
    const config = appModelConfigManager.initialize();

    expect(config.modes["model-api"].selectedModel).toBeNull();
    expect(config.modes["model-api"].vendors.length).toBeGreaterThan(0);
  });

  it("clears selected model and current selection when its vendor API key is removed", () => {
    const appModelConfigManager = new AppModelConfigManager(
      new OpenClawConfigManager(configDir),
      configDir
    );

    appModelConfigManager.initialize();
    appModelConfigManager.setApiKeyConfigured("model-api", "modelstudio", true);
    appModelConfigManager.selectModel(
      "model-api",
      "modelstudio",
      "qwen3-coder-plus"
    );

    const updated = appModelConfigManager.setApiKeyConfigured(
      "model-api",
      "modelstudio",
      false
    );

    expect(updated.modes["model-api"].selectedModel).toBeNull();
    expect(appModelConfigManager.getCurrentSelection()).toBeNull();
  });
});
