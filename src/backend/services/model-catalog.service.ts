/**
 * Model Catalog Service
 * 负责从 OpenClaw 加载完整的模型目录，不修改 OpenClaw 源代码
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import log from "electron-log";

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

// 提供商显示名称映射 - 与 openclaw 支持的全部供应商对齐
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  // 主流云服务商
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  "google-generative-ai": "Google Gemini",
  "google-gemini": "Google Gemini",
  "azure-openai": "Azure OpenAI",
  "azure-openai-responses": "Azure OpenAI (Responses)",
  "amazon-bedrock": "Amazon Bedrock",
  "github-copilot": "GitHub Copilot",
  // 国际 AI 供应商
  mistral: "Mistral AI",
  cohere: "Cohere",
  ai21: "AI21 Labs",
  groq: "Groq",
  together: "Together AI",
  fireworks: "Fireworks AI",
  perplexity: "Perplexity",
  xai: "xAI",
  zai: "Z.ai",
  deepseek: "DeepSeek",
  nvidia: "NVIDIA",
  kilocode: "Kilo Code",
  huggingface: "HuggingFace",
  openrouter: "OpenRouter",
  venice: "Venice",
  synthetic: "Synthetic",
  // 国内 AI 供应商
  moonshot: "Moonshot AI",
  "kimi-coding": "Kimi Coding",
  minimax: "MiniMax",
  "minimax-portal": "MiniMax Portal",
  volcengine: "Volcengine",
  "volcengine-plan": "Volcengine Plan",
  byteplus: "BytePlus",
  "byteplus-plan": "BytePlus Plan",
  doubao: "Doubao",
  "qwen-portal": "Qwen",
  qwen: "Qwen",
  qianfan: "Qianfan",
  zhipu: "Zhipu AI",
  xiaomi: "Xiaomi",
  siliconflow: "SiliconFlow",
  stepfun: "StepFun",
  ppio: "PPIO",
  // 本地/自托管
  ollama: "Ollama",
  vllm: "vLLM",
  // 网关/代理
  "cloudflare-ai-gateway": "Cloudflare AI Gateway",
  "vercel-ai-gateway": "Vercel AI Gateway",
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

      // Handle both formats: { count, models: [...] } and raw array
      const modelArray = Array.isArray(data) ? data : data.models;

      if (!Array.isArray(modelArray)) {
        logger.warn(
          "Invalid models.json format: expected array or { models: [...] }"
        );
        return await this.loadStaticModelCatalog();
      }

      const models: ModelCatalogEntry[] = modelArray
        .filter((entry: any) => entry && typeof entry === "object")
        .map((entry: any) => {
          // Parse provider from key (format: "provider/model-id")
          const key = String(entry.key || entry.id || "").trim();
          const provider = key.includes("/")
            ? key.split("/")[0]
            : String(entry.provider || "").trim();
          const id = key.includes("/")
            ? key.split("/").slice(1).join("/")
            : key;

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
   * 从 OpenClaw 源代码加载静态模型目录
   * 当 models.json 不存在时作为回退
   */
  private async loadStaticModelCatalog(): Promise<ModelCatalogEntry[]> {
    logger.info(
      "Attempting to load static model catalog from OpenClaw source..."
    );

    // 尝试从 OpenClaw 的 pi-model-discovery 模块加载
    const possiblePaths = [
      path.join(
        __dirname,
        "../../../../lib/openclaw/dist/agents/pi-model-discovery.js"
      ),
      path.join(
        __dirname,
        "../../../lib/openclaw/dist/agents/pi-model-discovery.js"
      ),
      path.join(
        __dirname,
        "../../../../lib/openclaw/src/agents/pi-model-discovery.ts"
      ),
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
