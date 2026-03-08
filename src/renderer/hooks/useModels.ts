/**
 * 模型选择器 Hook
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type {
  ModelConfig,
  ProviderModelGroup,
  ProviderGroup,
  SubCategory,
  UserModelSelection,
} from "../types/models";
import {
  PROVIDER_GROUP_DEFINITIONS,
  buildProviderToGroupIndex,
} from "../config/provider-groups";
import type { ProviderGroupDef } from "../config/provider-groups";

// 默认模型配置（与 OpenClaw 内置模型对齐，当模型目录中没有该 provider 的模型时使用）
const DEFAULT_PROVIDER_MODELS: Record<
  string,
  { id: string; name: string; contextWindow?: number }[]
> = {
  // Z.AI - GLM 系列模型
  zai: [
    { id: "glm-5", name: "GLM-5", contextWindow: 128000 },
    { id: "glm-4.7", name: "GLM-4.7", contextWindow: 128000 },
    { id: "glm-4.7-flash", name: "GLM-4.7 Flash", contextWindow: 128000 },
    { id: "glm-4.7-flashx", name: "GLM-4.7 FlashX", contextWindow: 128000 },
  ],
  // MiniMax
  minimax: [
    { id: "MiniMax-M2.5", name: "MiniMax-M2.5", contextWindow: 200000 },
  ],
  // Moonshot / Kimi
  moonshot: [{ id: "kimi-k2.5", name: "Kimi K2.5", contextWindow: 256000 }],
  "kimi-coding": [
    { id: "k2p5", name: "Kimi K2.5 Coding", contextWindow: 256000 },
  ],
  // xAI
  xai: [{ id: "grok-2", name: "Grok 2", contextWindow: 128000 }],
  // Mistral
  mistral: [
    {
      id: "mistral-large-latest",
      name: "Mistral Large",
      contextWindow: 128000,
    },
  ],
  // Qwen
  qwen: [{ id: "qwen-max", name: "Qwen Max", contextWindow: 128000 }],
  // Qianfan
  qianfan: [{ id: "ernie-4.0", name: "ERNIE 4.0", contextWindow: 128000 }],
  // Volcano Engine / BytePlus
  volcengine: [{ id: "doubao-pro", name: "Doubao Pro", contextWindow: 128000 }],
  byteplus: [{ id: "doubao-pro", name: "Doubao Pro", contextWindow: 128000 }],
  // OpenRouter
  openrouter: [{ id: "auto", name: "Auto", contextWindow: 128000 }],
  // Together AI
  together: [
    { id: "llama-3.1-70b", name: "Llama 3.1 70B", contextWindow: 128000 },
  ],
  // HuggingFace
  huggingface: [
    {
      id: "meta-llama/Llama-3.1-70B-Instruct",
      name: "Llama 3.1 70B",
      contextWindow: 128000,
    },
  ],
  // Venice
  venice: [
    { id: "llama-3.3-70b", name: "Llama 3.3 70B", contextWindow: 128000 },
  ],
  // Synthetic
  synthetic: [
    {
      id: "claude-3-5-sonnet",
      name: "Claude 3.5 Sonnet",
      contextWindow: 200000,
    },
  ],
};

// 服务商显示名称映射 - 与 openclaw 支持的全部供应商对齐
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
  "qwen-portal": "Qwen",
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

/**
 * 获取服务商显示名称
 */
export function getProviderDisplayName(providerId: string): string {
  return PROVIDER_DISPLAY_NAMES[providerId] || providerId;
}

export function useModels() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [providerGroups, setProviderGroups] = useState<ProviderModelGroup[]>(
    []
  );
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [currentSelection, setCurrentSelection] =
    useState<UserModelSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const restartingRef = useRef(false);

  // 加载模型和配置数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("[Frontend] Starting to load model data...");
      console.log("[Frontend] electronAPI exists:", !!window.electronAPI);
      console.log(
        "[Frontend] getModelCatalog exists:",
        typeof window.electronAPI?.getModelCatalog
      );
      console.log(
        "[Frontend] getCatalogProviders exists:",
        typeof window.electronAPI?.getCatalogProviders
      );

      // 并行获取全量模型目录、提供商列表和已配置的认证信息
      const [catalogResult, providersResult, authResult] = await Promise.all([
        window.electronAPI.getModelCatalog(),
        window.electronAPI.getCatalogProviders(),
        window.electronAPI.getAuthProfiles(),
      ]);

      console.log("[Frontend] catalogResult:", catalogResult);
      console.log("[Frontend] providersResult:", providersResult);
      console.log("[Frontend] authResult:", authResult);

      // 处理模型数据
      const catalogModels = catalogResult.models || [];
      const providers = providersResult.providers || [];
      const authProfiles = authResult.profiles || [];

      // 获取已配置的提供商列表
      const configured = authProfiles
        .filter((p: { provider: string; hasKey: boolean }) => p.hasKey)
        .map((p: { provider: string }) => p.provider);
      setConfiguredProviders(configured);

      // 转换为 ModelConfig 格式
      const loadedModels: ModelConfig[] = catalogModels.map((m: any) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        contextWindow: m.contextWindow,
        maxTokens: m.contextWindow, // 使用 contextWindow 作为 maxTokens
      }));

      // 按服务商分组（包含没有模型的供应商，供 UI 展示"未配置"状态）
      const groups: ProviderModelGroup[] = [];
      for (const provider of providers) {
        const providerId = provider.id;
        let providerModels = loadedModels.filter(
          (m: ModelConfig) => m.provider === providerId
        );

        // 如果没有找到模型，但配置了 API Key，使用默认模型
        if (providerModels.length === 0 && configured.includes(providerId)) {
          const defaults = DEFAULT_PROVIDER_MODELS[providerId];
          if (defaults) {
            providerModels = defaults.map((d) => ({
              id: d.id,
              name: d.name,
              provider: providerId,
              contextWindow: d.contextWindow,
              maxTokens: d.contextWindow,
            }));
          }
        }

        groups.push({
          provider: providerId,
          providerName: provider.name || getProviderDisplayName(providerId),
          models: providerModels,
          hasApiKey: configured.includes(providerId),
        });
      }

      // 按服务商名称排序
      groups.sort((a, b) => a.providerName.localeCompare(b.providerName));

      setModels(loadedModels);
      setProviderGroups(groups);

      // 设置当前选中的模型（从默认Agent获取）
      const defaultAgent = await window.electronAPI.getDefaultAgent();
      if (defaultAgent.success && defaultAgent.agent?.model) {
        const modelConfig = defaultAgent.agent.model;
        if (typeof modelConfig === "string") {
          const parts = modelConfig.split("/");
          if (parts.length >= 2) {
            const [provider, modelId] = parts;
            if (provider && modelId) {
              setCurrentSelection({ provider, model: modelId });
            }
          }
        } else if (modelConfig.primary) {
          const parts = modelConfig.primary.split("/");
          if (parts.length >= 2) {
            const [provider, modelId] = parts;
            if (provider && modelId) {
              setCurrentSelection({ provider, model: modelId });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error loading models:", err);
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  // 切换模型（含静默重启引擎）
  const selectModel = useCallback(async (provider: string, modelId: string) => {
    // 防抖：重启中忽略新的切换请求
    if (restartingRef.current) return;

    try {
      const modelString = `${provider}/${modelId}`;

      // 使用 setDefaultModel 同时更新 agents.defaults.model 和默认 agent 的模型
      // OpenClaw 引擎优先使用 agents.defaults.model
      await window.electronAPI.setDefaultModel({
        primary: modelString,
        fallbacks: [],
      });

      setCurrentSelection({ provider, model: modelId });

      // 静默重启引擎
      setIsRestarting(true);
      restartingRef.current = true;

      // 超时保护：10秒后强制恢复
      const timeout = setTimeout(() => {
        setIsRestarting(false);
        restartingRef.current = false;
        console.warn("[useModels] Engine restart timed out after 10s");
      }, 10000);

      try {
        const restartResult = await window.electronAPI.restartOpenClaw();
        clearTimeout(timeout);
        if (!restartResult.success) {
          console.error(
            "[useModels] Engine restart failed:",
            restartResult.error
          );
        }
      } catch (restartErr) {
        clearTimeout(timeout);
        console.error("[useModels] Engine restart error:", restartErr);
      } finally {
        setIsRestarting(false);
        restartingRef.current = false;
      }

      // 通知全局模型已变更
      window.dispatchEvent(new CustomEvent("model-changed"));
    } catch (err) {
      console.error("Error selecting model:", err);
      setError(err instanceof Error ? err.message : "Failed to select model");
      setIsRestarting(false);
      restartingRef.current = false;
    }
  }, []);

  // 刷新数据
  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 监听 model-changed 事件，自动刷新数据
  useEffect(() => {
    const handler = () => {
      loadData();
    };
    window.addEventListener("model-changed", handler);
    return () => window.removeEventListener("model-changed", handler);
  }, [loadData]);

  // 构建三栏层级分组数据: ProviderGroup[]
  const providerGroupList = useMemo(() => {
    const providerToGroup = buildProviderToGroupIndex();
    // 用 providerGroups（扁平数据）按 groupId 索引
    const flatMap = new Map<string, ProviderModelGroup>();
    for (const g of providerGroups) {
      flatMap.set(g.provider, g);
    }

    const usedProviderIds = new Set<string>();
    const groups: ProviderGroup[] = [];

    for (const def of PROVIDER_GROUP_DEFINITIONS) {
      const subCategories: SubCategory[] = [];

      for (let memberIdx = 0; memberIdx < def.members.length; memberIdx++) {
        const member = def.members[memberIdx]!;
        // 合并同一子分类下所有 providerIds 的模型
        const allModels: ModelConfig[] = [];
        const seenModelIds = new Set<string>();

        // 主 providerId（用于 API Key 配置）
        const primaryProviderId = member.providerIds[0] || member.label;

        for (const pid of member.providerIds) {
          usedProviderIds.add(pid);
          const flat = flatMap.get(pid);
          if (flat) {
            // 去重: 多个别名 provider 可能有相同的模型
            for (const m of flat.models) {
              const key = `${m.provider}/${m.id}`;
              if (!seenModelIds.has(key)) {
                seenModelIds.add(key);
                allModels.push(m);
              }
            }
          }
        }

        // 只检查主 providerId 的 API Key 状态
        // 这样确保每个子分类独立显示配置状态
        const primaryFlat = flatMap.get(primaryProviderId);
        let hasApiKey = primaryFlat?.hasApiKey || false;

        // 共享认证: 如果父 provider 已配置，子分类也标记为已配置
        if (!hasApiKey && member.sharesAuthWith) {
          const parentFlat = flatMap.get(member.sharesAuthWith);
          if (parentFlat?.hasApiKey) hasApiKey = true;
        }

        subCategories.push({
          id: `${def.groupId}/${memberIdx}`,
          providerId: primaryProviderId,
          label: member.label,
          models: allModels,
          hasApiKey,
        });
      }

      const hasAnyApiKey = subCategories.some((sc) => sc.hasApiKey);

      groups.push({
        groupId: def.groupId,
        groupName: def.groupName,
        icon: def.icon,
        subCategories,
        hasAnyApiKey,
        hasMultipleSubCategories: subCategories.length > 1,
      });
    }

    // 注意：不再添加不在 PROVIDER_GROUP_DEFINITIONS 中的 provider
    // 确保列表严格与 OpenClaw AUTH_CHOICE_GROUP_DEFS 一致
    return groups;
  }, [providerGroups]);

  return {
    models,
    providerGroups,
    providerGroupList,
    configuredProviders,
    currentSelection,
    loading,
    error,
    isRestarting,
    selectModel,
    refresh,
    getProviderDisplayName,
  };
}
