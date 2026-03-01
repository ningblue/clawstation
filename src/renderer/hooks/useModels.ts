/**
 * 模型选择器 Hook
 */

import { useState, useEffect, useCallback } from 'react';
import type { ModelConfig, ProviderModelGroup, UserModelSelection } from '../types/models';

// 服务商显示名称映射
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  'google-generative-ai': 'Google Gemini',
  minimax: 'MiniMax',
  moonshot: 'Moonshot (Kimi)',
  'moonshot-pro': 'Moonshot Kimi',
  baidu: '百度千帆',
  bytedance: '字节豆包',
  ollama: 'Ollama',
  vllm: 'vLLM',
  deepseek: 'DeepSeek',
  cohere: 'Cohere',
  azure: 'Azure OpenAI',
  bedrock: 'Amazon Bedrock',
  togetherai: 'Together AI',
  huggingface: 'Hugging Face',
  openrouter: 'OpenRouter',
};

/**
 * 获取服务商显示名称
 */
export function getProviderDisplayName(providerId: string): string {
  return PROVIDER_DISPLAY_NAMES[providerId] || providerId;
}

export function useModels() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [providerGroups, setProviderGroups] = useState<ProviderModelGroup[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [currentSelection, setCurrentSelection] = useState<UserModelSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载模型和配置数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[Frontend] Starting to load model data...');
      console.log('[Frontend] electronAPI exists:', !!window.electronAPI);
      console.log('[Frontend] getModelCatalog exists:', typeof window.electronAPI?.getModelCatalog);
      console.log('[Frontend] getCatalogProviders exists:', typeof window.electronAPI?.getCatalogProviders);

      // 并行获取全量模型目录、提供商列表和已配置的认证信息
      const [catalogResult, providersResult, authResult] = await Promise.all([
        window.electronAPI.getModelCatalog(),
        window.electronAPI.getCatalogProviders(),
        window.electronAPI.getAuthProfiles(),
      ]);

      console.log('[Frontend] catalogResult:', catalogResult);
      console.log('[Frontend] providersResult:', providersResult);
      console.log('[Frontend] authResult:', authResult);

      // 处理模型数据
      const catalogModels = catalogResult.models || [];
      const providers = providersResult.providers || [];
      const authProfiles = authResult.profiles || [];

      // 获取已配置的提供商列表
      const configured = authProfiles.filter((p: { provider: string; hasKey: boolean }) => p.hasKey).map((p: { provider: string }) => p.provider);
      setConfiguredProviders(configured);

      // 转换为 ModelConfig 格式
      const loadedModels: ModelConfig[] = catalogModels.map((m: any) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        contextWindow: m.contextWindow,
        maxTokens: m.contextWindow, // 使用 contextWindow 作为 maxTokens
      }));

      // 按服务商分组
      const groups: ProviderModelGroup[] = [];
      for (const provider of providers) {
        const providerId = provider.id;
        const providerModels = loadedModels.filter((m: ModelConfig) => m.provider === providerId);
        if (providerModels.length > 0) {
          groups.push({
            provider: providerId,
            providerName: provider.name || getProviderDisplayName(providerId),
            models: providerModels,
            hasApiKey: configured.includes(providerId),
          });
        }
      }

      // 按服务商名称排序
      groups.sort((a, b) => a.providerName.localeCompare(b.providerName));

      setModels(loadedModels);
      setProviderGroups(groups);

      // 设置当前选中的模型（从默认Agent获取）
      const defaultAgent = await window.electronAPI.getDefaultAgent();
      if (defaultAgent.success && defaultAgent.agent?.model) {
        const modelConfig = defaultAgent.agent.model;
        if (typeof modelConfig === 'string') {
          const parts = modelConfig.split('/');
          if (parts.length >= 2) {
            const [provider, modelId] = parts;
            if (provider && modelId) {
              setCurrentSelection({ provider, model: modelId });
            }
          }
        } else if (modelConfig.primary) {
          const parts = modelConfig.primary.split('/');
          if (parts.length >= 2) {
            const [provider, modelId] = parts;
            if (provider && modelId) {
              setCurrentSelection({ provider, model: modelId });
            }
          }
        }
      }

    } catch (err) {
      console.error('Error loading models:', err);
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  // 切换模型
  const selectModel = useCallback(async (provider: string, modelId: string) => {
    try {
      const modelString = `${provider}/${modelId}`;

      // 更新默认Agent的模型
      const defaultAgent = await window.electronAPI.getDefaultAgent();
      if (defaultAgent.success && defaultAgent.agent) {
        const updatedAgent = {
          ...defaultAgent.agent,
          model: {
            primary: modelString,
            fallbacks: defaultAgent.agent.model?.fallbacks || [],
          },
        };

        await window.electronAPI.setAgent(updatedAgent);
        setCurrentSelection({ provider, model: modelId });
      }
    } catch (err) {
      console.error('Error selecting model:', err);
      setError(err instanceof Error ? err.message : 'Failed to select model');
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

  return {
    models,
    providerGroups,
    configuredProviders,
    currentSelection,
    loading,
    error,
    selectModel,
    refresh,
    getProviderDisplayName,
  };
}
