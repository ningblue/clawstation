/**
 * Model Catalog Service
 * 负责从 OpenClaw 加载完整的模型目录，不修改 OpenClaw 源代码
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import log from "electron-log";
import { getOpenClawResourcePath } from "../../main/paths";

const logger = log.scope("ModelCatalogService");

export interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description?: string;
}

// 国内 AI 供应商显示名称映射 - 仅保留国内模型服务商
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  // 国内 AI 供应商
  moonshot: "Moonshot AI",
  "kimi-coding": "Kimi Coding",
  minimax: "MiniMax",
  "minimax-portal": "MiniMax Portal",
  "minimax-cn": "MiniMax CN",
  volcengine: "Volcengine",
  "volcengine-plan": "Volcengine Plan",
  byteplus: "BytePlus",
  "byteplus-plan": "BytePlus Plan",
  doubao: "Doubao",
  "qwen-portal": "Qwen",
  qwen: "Qwen",
  zai: "Z.AI",
  bailian: "Bailian",
  stepfun: "StepFun",
  ppio: "PPIO",
  // 本地/自托管
  ollama: "Ollama",
  vllm: "vLLM",
};

class ModelCatalogService {
  private cache: ModelCatalogEntry[] | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 获取 OpenClaw 的 models.json 文件路径
   */
  private getModelsJsonPath(): string {
    // OpenClaw 状态目录
    const openclawStateDir =
      process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), ".clawstation");
    // models.json 默认在 agent 目录下
    return path.join(
      openclawStateDir,
      "agents",
      "default",
      "agent",
      "models.json"
    );
  }

  /**
   * 从 OpenClaw 的 models.json 加载模型目录
   */
  async loadModelCatalog(): Promise<ModelCatalogEntry[]> {
    // 检查缓存
    if (this.cache && Date.now() - this.cacheTime < this.CACHE_TTL) {
      logger.debug("Returning cached model catalog");
      return this.cache;
    }

    const modelsJsonPath = this.getModelsJsonPath();
    logger.info(`Loading model catalog from: ${modelsJsonPath}`);

    try {
      // 检查文件是否存在
      if (!fs.existsSync(modelsJsonPath)) {
        logger.warn(`Models file not found at: ${modelsJsonPath}`);
        // 尝试从 OpenClaw 的 lib 目录加载静态模型目录
        return await this.loadStaticModelCatalog();
      }

      // 读取并解析 models.json
      const content = fs.readFileSync(modelsJsonPath, "utf8");
      const data = JSON.parse(content);

      // Handle multiple formats:
      // 1. Raw array: [...]
      // 2. { models: [...] }
      // 3. { providers: { providerId: { models: [...] } } }
      let modelArray: any[] = [];

      if (Array.isArray(data)) {
        modelArray = data;
      } else if (data.models && Array.isArray(data.models)) {
        modelArray = data.models;
      } else if (data.providers && typeof data.providers === "object") {
        // Handle nested provider format: { providers: { providerId: { models: [...] } } }
        for (const [providerId, providerData] of Object.entries(data.providers)) {
          if (
            providerData &&
            typeof providerData === "object" &&
            (providerData as any).models &&
            Array.isArray((providerData as any).models)
          ) {
            for (const model of (providerData as any).models) {
              modelArray.push({
                ...model,
                provider: providerId,
              });
            }
          }
        }
      }

      if (!Array.isArray(modelArray) || modelArray.length === 0) {
        logger.warn(
          "Invalid models.json format: expected array, { models: [...] }, or { providers: {...} }"
        );
        return await this.loadStaticModelCatalog();
      }

      const models: ModelCatalogEntry[] = modelArray
        .filter((entry: any) => entry && typeof entry === "object")
        .map((entry: any) => {
          // Parse provider from key (format: "provider/model-id") or from entry.provider
          const key = String(entry.key || "").trim();
          const providerFromKey = key.includes("/") ? key.split("/")[0] : "";
          const provider =
            providerFromKey ||
            String(entry.provider || "").trim() ||
            "unknown";
          const id = key.includes("/")
            ? key.split("/").slice(1).join("/")
            : String(entry.id || "").trim();

          // Parse input format (e.g., "text+image" or ["text", "image"])
          let input: Array<"text" | "image"> | undefined;
          if (typeof entry.input === "string") {
            input = entry.input
              .split("+")
              .filter((i: string) => i === "text" || i === "image") as Array<
              "text" | "image"
            >;
          } else if (Array.isArray(entry.input)) {
            input = entry.input.filter(
              (i: string) => i === "text" || i === "image"
            );
          }

          return {
            id,
            name: String(entry.name || id || "").trim() || id,
            provider: provider || "unknown",
            contextWindow:
              typeof entry.contextWindow === "number"
                ? entry.contextWindow
                : undefined,
            reasoning:
              typeof entry.reasoning === "boolean"
                ? entry.reasoning
                : undefined,
            input: input && input.length > 0 ? input : undefined,
          };
        })
        .filter((entry) => entry.id && entry.provider);

      // 按提供商和名称排序
      models.sort((a, b) => {
        const p = a.provider.localeCompare(b.provider);
        if (p !== 0) return p;
        return a.name.localeCompare(b.name);
      });

      logger.info(`Loaded ${models.length} models from catalog`);

      // 更新缓存
      this.cache = models;
      this.cacheTime = Date.now();

      return models;
    } catch (error) {
      logger.error("Failed to load model catalog:", error);
      return await this.loadStaticModelCatalog();
    }
  }

  /**
   * 从 OpenClaw 资源目录加载静态模型目录
   * 当 models.json 不存在时作为回退
   */
  private async loadStaticModelCatalog(): Promise<ModelCatalogEntry[]> {
    logger.info(
      "Attempting to load static model catalog from OpenClaw resources..."
    );

    // 尝试从 resources/openclaw 目录加载静态模型数据
    const openclawResourcePath = getOpenClawResourcePath();
    const possiblePaths = [
      // 优先从 resources/openclaw/dist/agents/ 加载
      path.join(openclawResourcePath, "dist/agents/pi-model-discovery.js"),
      path.join(openclawResourcePath, "dist/agents/models.json"),
      // 备用路径
      path.join(__dirname, "../../../../resources/openclaw/dist/agents/models.json"),
      path.join(__dirname, "../../../resources/openclaw/dist/agents/models.json"),
    ];

    for (const modelPath of possiblePaths) {
      try {
        if (fs.existsSync(modelPath)) {
          logger.info(`Found model discovery module at: ${modelPath}`);

          // 尝试加载内置模型数据
          const builtinModelsPath = path.join(
            path.dirname(modelPath),
            "models.json"
          );
          if (fs.existsSync(builtinModelsPath)) {
            const content = fs.readFileSync(builtinModelsPath, "utf8");
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
              const models = data
                .filter((entry: any) => entry && typeof entry === "object")
                .map((entry: any) => ({
                  id: String(entry.id || "").trim(),
                  name: String(entry.name || entry.id || "").trim(),
                  provider: String(entry.provider || "").trim(),
                  contextWindow:
                    typeof entry.contextWindow === "number"
                      ? entry.contextWindow
                      : undefined,
                  reasoning:
                    typeof entry.reasoning === "boolean"
                      ? entry.reasoning
                      : undefined,
                  input: Array.isArray(entry.input) ? entry.input : undefined,
                }))
                .filter(
                  (entry: ModelCatalogEntry) => entry.id && entry.provider
                );

              models.sort((a, b) => {
                const p = a.provider.localeCompare(b.provider);
                if (p !== 0) return p;
                return a.name.localeCompare(b.name);
              });

              logger.info(`Loaded ${models.length} models from static catalog`);
              this.cache = models;
              this.cacheTime = Date.now();
              return models;
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to load from ${modelPath}:`, error);
      }
    }

    // 如果所有方法都失败，返回空数组
    logger.warn("Could not load model catalog from any source");
    return [];
  }

  /**
   * 获取所有提供商列表
   * 包含所有已知供应商（即使没有配置 API Key / 没有模型数据）
   */
  async getProviders(): Promise<ProviderInfo[]> {
    const models = await this.loadModelCatalog();
    const providerSet = new Set<string>();

    // 添加模型目录中已有的供应商
    models.forEach((model) => {
      providerSet.add(model.provider);
    });

    // 添加所有已知供应商（确保未配置的也能在 UI 展示）
    for (const id of Object.keys(PROVIDER_DISPLAY_NAMES)) {
      providerSet.add(id);
    }

    const providers = Array.from(providerSet).map((id) => ({
      id,
      name:
        PROVIDER_DISPLAY_NAMES[id] || id.charAt(0).toUpperCase() + id.slice(1),
    }));

    providers.sort((a, b) => a.name.localeCompare(b.name));

    return providers;
  }

  /**
   * 获取指定提供商的所有模型
   */
  async getModelsByProvider(providerId: string): Promise<ModelCatalogEntry[]> {
    const models = await this.loadModelCatalog();
    return models.filter((m) => m.provider === providerId);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTime = 0;
    logger.info("Model catalog cache cleared");
  }
}

// 导出单例实例
export const modelCatalogService = new ModelCatalogService();
