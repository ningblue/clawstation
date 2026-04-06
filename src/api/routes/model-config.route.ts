import { ipcMain, IpcMainInvokeEvent } from "electron";
import { AppModelConfigManager } from "../../backend/config/app-model-config";
import { ModelConfigSyncService } from "../../backend/services/model-config-sync.service";
import { OpenClawManager } from "../../backend/services/openclaw.service";
import { isConfigurableModeId } from "../../shared/types/model-config.types";

export function setupModelConfigRoutes(openclawManager: OpenClawManager): void {
  const configManager = openclawManager.getConfigManager();
  const appModelConfigManager = new AppModelConfigManager(configManager);
  const syncService = new ModelConfigSyncService(configManager);
  const syncConfig = (config: ReturnType<AppModelConfigManager["getConfig"]>) => {
    syncService.syncAppConfig(config);
  };
  syncConfig(appModelConfigManager.getConfig());

  ipcMain.handle("app:model-config:get", async (_event: IpcMainInvokeEvent) => {
    return { success: true, config: appModelConfigManager.getConfig() };
  });

  ipcMain.handle(
    "app:model-config:getMode",
    async (_event: IpcMainInvokeEvent, modeId: string) => {
      return { success: true, mode: appModelConfigManager.getModeConfig(modeId as any) };
    }
  );

  ipcMain.handle(
    "app:model-config:current",
    async (_event: IpcMainInvokeEvent) => {
      return { success: true, current: appModelConfigManager.getCurrentSelection() };
    }
  );

  ipcMain.handle(
    "app:model-config:setMode",
    async (_event: IpcMainInvokeEvent, modeId: string) => {
      const config = appModelConfigManager.setMode(modeId as any);
      syncConfig(config);
      return { success: true };
    }
  );

  ipcMain.handle(
    "app:model-config:selectModel",
    async (
      _event: IpcMainInvokeEvent,
      vendorId: string,
      modelId: string,
      modeId?: string,
    ) => {
      if (!modeId || !isConfigurableModeId(modeId)) {
        return { success: false, error: "Invalid modeId" };
      }
      const config = appModelConfigManager.selectModel(modeId, vendorId, modelId);
      syncConfig(config);
      return { success: true };
    }
  );

  ipcMain.handle(
    "app:model-config:setApiKey",
    async (
      _event: IpcMainInvokeEvent,
      vendorId: string,
      apiKey: string,
      modeId?: string,
    ) => {
      if (!modeId || !isConfigurableModeId(modeId)) {
        return { success: false, error: "Invalid modeId" };
      }
      const modeConfig = appModelConfigManager.getModeConfig(modeId);
      const vendor = modeConfig?.vendors.find((item) => item.vendorId === vendorId);
      if (!vendor) {
        return { success: false, error: "Unknown vendor" };
      }
      syncService.setApiKey(vendor, apiKey);
      const config = appModelConfigManager.setApiKeyConfigured(modeId, vendorId, true);
      syncConfig(config);
      return { success: true };
    }
  );

  ipcMain.handle(
    "app:model-config:removeApiKey",
    async (_event: IpcMainInvokeEvent, vendorId: string, modeId?: string) => {
      if (!modeId || !isConfigurableModeId(modeId)) {
        return { success: false, error: "Invalid modeId" };
      }
      const modeConfig = appModelConfigManager.getModeConfig(modeId);
      const vendor = modeConfig?.vendors.find((item) => item.vendorId === vendorId);
      if (!vendor) {
        return { success: false, error: "Unknown vendor" };
      }
      syncService.removeApiKey(vendor);
      const config = appModelConfigManager.setApiKeyConfigured(modeId, vendorId, false);
      syncConfig(config);
      return { success: true };
    }
  );
}
