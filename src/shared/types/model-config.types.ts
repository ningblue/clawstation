export type ModelModeId = "default" | "model-api" | "coding-plan";

export const APP_MODEL_CONFIG_VERSION = 1 as const;

export function isConfigurableModeId(
  modeId: string,
): modeId is Exclude<ModelModeId, "default"> {
  return modeId === "model-api" || modeId === "coding-plan";
}

export interface VendorModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
}

export interface VendorConfig {
  vendorId: string;
  label: string;
  icon: string;
  openclawProviderId: string;
  baseUrl: string;
  api?: string;
  authHeader?: boolean;
  apiKeyUrl?: string;
  authProfileId: string;
  apiKeyConfigured: boolean;
  models: VendorModel[];
}

export interface VendorModelRef {
  vendorId: string;
  modelId: string;
}

export interface DefaultModeConfig {
  enabled: false;
}

export interface ModeConfig {
  selectedModel: VendorModelRef | null;
  vendors: VendorConfig[];
}

export interface AppModelConfig {
  version: 1;
  activeMode: ModelModeId;
  modes: {
    default: DefaultModeConfig;
    "model-api": ModeConfig;
    "coding-plan": ModeConfig;
  };
}

export interface VendorDefault {
  vendorId: string;
  familyId: string;
  label: string;
  shortLabel: string;
  icon: string;
  modeId: Exclude<ModelModeId, "default">;
  openclawProviderId: string;
  baseUrl: string;
  api?: string;
  authHeader?: boolean;
  apiKeyUrl?: string;
  authProfileId: string;
  sharesAuthWith?: string;
  models: VendorModel[];
}

export interface CurrentAppModelSelection {
  modeId: Exclude<ModelModeId, "default">;
  vendorId: string;
  modelId: string;
  modelName: string;
  providerLabel: string;
  openclawProviderId: string;
}

export type AppModelCurrentSelection = CurrentAppModelSelection;
