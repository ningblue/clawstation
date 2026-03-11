/**
 * AI模型设置面板 - 三栏选择逻辑
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useModels } from '../../hooks/useModels';
import MiniMaxOAuth from '../../components/settings/MiniMaxOAuth';

interface AIModelSettingsProps {
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

// 搜索 API 提供商配置
interface SearchProviderConfig {
  id: string;
  name: string;
  hasKey: boolean;
  description: string;
}

const DEFAULT_SEARCH_PROVIDERS: SearchProviderConfig[] = [
  { id: 'brave', name: 'Brave Search', hasKey: false, description: '免费额度：每月 2000 次请求' },
  { id: 'perplexity', name: 'Perplexity', hasKey: false, description: '需要 Perplexity API Key' },
  { id: 'grok', name: 'Grok (xAI)', hasKey: false, description: '需要 xAI API Key' },
  { id: 'gemini', name: 'Google Gemini', hasKey: false, description: '需要 Google AI API Key' },
  { id: 'kimi', name: 'Kimi (Moonshot)', hasKey: false, description: '需要 Kimi API Key' },
];

// 提供商图标（仅国内模型服务商）
const getProviderIcon = (providerId: string): string => {
  const icons: Record<string, string> = {
    // MiniMax
    minimax: 'MM',
    'minimax-portal': 'MM',
    'minimax-cn': 'MM',
    // Moonshot/Kimi
    moonshot: 'Ki',
    kimi: 'Ki',
    'kimi-coding': 'Ki',
    // Volcano Engine
    volcengine: 'VC',
    'volcengine-plan': 'VC',
    // BytePlus
    byteplus: 'BP',
    'byteplus-plan': 'BP',
    // Z.AI
    zai: 'Z',
    // Qwen
    qwen: 'QW',
    'qwen-portal': 'QW',
    // Bailian
    bailian: 'BL',
    // DeepSeek
    deepseek: 'DS',
    // Doubao
    doubao: '豆包',
  };
  return icons[providerId] || '🤖';
};

export const AIModelSettings: React.FC<AIModelSettingsProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [showAddKey, setShowAddKey] = useState(false);

  // 三栏状态 - 保持原有逻辑
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // 搜索 API
  const [searchProvider, setSearchProvider] = useState<string>('brave');
  const [searchApiKey, setSearchApiKey] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [showAddSearchKey, setShowAddSearchKey] = useState(false);
  const [searchProviders, setSearchProviders] = useState<SearchProviderConfig[]>(DEFAULT_SEARCH_PROVIDERS);

  const { providerGroupList, isRestarting, selectModel, refresh: refreshModels } = useModels();

  // 加载当前模型
  useEffect(() => {
    const loadCurrentModel = async () => {
      try {
        const agentResult = await window.electronAPI.getDefaultAgent();
        if (agentResult.success && agentResult.agent?.model) {
          const modelConfig = agentResult.agent.model;
          let modelStr = '';
          if (typeof modelConfig === 'string') {
            modelStr = modelConfig;
          } else if (modelConfig.primary) {
            modelStr = modelConfig.primary;
          }
          setCurrentModel(modelStr);
        }
      } catch (error) {
        console.error('Failed to load current model:', error);
      }
    };
    loadCurrentModel();
  }, []);

  // 自动选择第一个有配置的供应商
  useEffect(() => {
    if (providerGroupList.length > 0 && !selectedGroupId) {
      const configured = providerGroupList.find(g => g.hasAnyApiKey);
      if (configured) {
        setSelectedGroupId(configured.groupId);
        if (configured.hasMultipleSubCategories && configured.subCategories.length > 0) {
          const configuredSub = configured.subCategories.find(s => s.hasApiKey);
          if (configuredSub) {
            setSelectedSubCategoryId(configuredSub.id);
          }
        }
      }
    }
  }, [providerGroupList, selectedGroupId]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return providerGroupList.find(g => g.groupId === selectedGroupId) || null;
  }, [selectedGroupId, providerGroupList]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return providerGroupList;
    const query = searchQuery.toLowerCase();
    return providerGroupList.filter(g =>
      g.groupName.toLowerCase().includes(query) ||
      g.subCategories.some(s => s.label.toLowerCase().includes(query))
    );
  }, [providerGroupList, searchQuery]);

  const showMiddleColumn = selectedGroup?.hasMultipleSubCategories ?? false;

  const displaySubCategories = useMemo(() => {
    if (!selectedGroup) return [];
    if (selectedSubCategoryId) {
      const sc = selectedGroup.subCategories.find(s => s.id === selectedSubCategoryId);
      return sc ? [sc] : [];
    }
    return selectedGroup.subCategories;
  }, [selectedGroup, selectedSubCategoryId]);

  const handleSaveApiKey = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      onShowToast('请选择提供商并输入API Key', 'error');
      return;
    }
    try {
      setLoading(true);
      const result = await window.electronAPI.setApiKey(selectedProvider, apiKey);
      if (result.success) {
        onShowToast('API Key 已保存', 'success');
        setApiKey('');
        setShowAddKey(false);
        setSelectedProvider('');
        refreshModels();
        window.dispatchEvent(new CustomEvent('model-changed'));
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      onShowToast('保存失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveApiKey = async (providerId: string) => {
    if (!confirm(`确定要删除此 API Key 吗？`)) return;
    try {
      setLoading(true);
      const result = await window.electronAPI.removeApiKey(providerId);
      if (result.success) {
        onShowToast('API Key 已删除', 'success');
        refreshModels();
        window.dispatchEvent(new CustomEvent('model-changed'));
      } else {
        throw new Error(result.error || '删除失败');
      }
    } catch (error) {
      onShowToast('删除失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModel = async (providerId: string, modelId: string) => {
    try {
      setLoading(true);
      await selectModel(providerId, modelId);
      setCurrentModel(`${providerId}/${modelId}`);
      onShowToast('模型已切换', 'success');
    } catch (error) {
      onShowToast('切换失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupClick = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedSubCategoryId('');
  };

  const handleSubCategoryClick = (subCategoryId: string) => {
    setSelectedSubCategoryId(subCategoryId);
  };

  const handleSaveSearchApiKey = async () => {
    if (!searchApiKey.trim()) {
      onShowToast('请输入 API Key', 'error');
      return;
    }
    try {
      setLoading(true);
      const result = await window.electronAPI.setSearchApiKey(searchProvider, searchApiKey);
      if (result.success) {
        onShowToast('搜索 API Key 已保存', 'success');
        setSearchApiKey('');
        setShowAddSearchKey(false);
        setSearchProviders(prev => prev.map(p => p.id === searchProvider ? { ...p, hasKey: true } : p));
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      onShowToast('保存失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSearchApiKey = async (providerId: string) => {
    const providerName = searchProviders.find(p => p.id === providerId)?.name || providerId;
    if (!confirm(`确定要删除 ${providerName} 的搜索 API Key 吗？`)) return;
    try {
      setLoading(true);
      const result = await window.electronAPI.removeSearchApiKey(providerId);
      if (result.success) {
        onShowToast('搜索 API Key 已删除', 'success');
        setSearchProviders(prev => prev.map(p => p.id === providerId ? { ...p, hasKey: false } : p));
      } else {
        throw new Error(result.error || '删除失败');
      }
    } catch (error) {
      onShowToast('删除失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section-title">AI 模型</div>

      {/* 当前模型 */}
      <div className="current-model-simple">
        <span className="current-model-simple-label">当前使用</span>
        <div className="current-model-simple-value">
          {currentModel ? (
            <>
              <span className="current-model-simple-icon">{getProviderIcon(currentModel.split('/')[0] || '')}</span>
              <span className="current-model-simple-name">{currentModel}</span>
            </>
          ) : (
            <span className="current-model-simple-empty">未配置模型</span>
          )}
        </div>
      </div>

      {/* 三栏浏览器 */}
      <div className="settings-group">
        <div className="settings-group-title">
          <span>选择模型</span>
          <button className="btn btn-sm btn-primary" onClick={() => setShowAddKey(true)} disabled={loading}>
            + 添加 API Key
          </button>
        </div>

        {/* 搜索 */}
        <div className="provider-search-box">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" placeholder="搜索供应商..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        {/* 三栏布局 */}
        <div className="model-browser-three-col">
          {/* 左栏: 供应商 */}
          <div className="browser-col browser-col-left">
            <div className="browser-col-title">供应商</div>
            <div className="browser-col-list">
              {filteredGroups.map(group => (
                <div key={group.groupId}
                  className={`browser-item ${selectedGroupId === group.groupId ? 'active' : ''} ${group.hasAnyApiKey ? 'configured' : ''}`}
                  onClick={() => handleGroupClick(group.groupId)}>
                  <span className="browser-item-icon">{getProviderIcon(group.groupId)}</span>
                  <span className="browser-item-name">{group.groupName}</span>
                  {group.hasAnyApiKey && <span className="browser-item-indicator"></span>}
                </div>
              ))}
            </div>
          </div>

          {/* 中栏: 子分类 */}
          {showMiddleColumn && selectedGroup && (
            <div className="browser-col browser-col-middle">
              <div className="browser-col-title">分类</div>
              <div className="browser-col-list">
                {selectedGroup.subCategories.map(sc => (
                  <div key={sc.id}
                    className={`browser-item ${selectedSubCategoryId === sc.id ? 'active' : ''} ${sc.hasApiKey ? 'configured' : ''}`}
                    onClick={() => handleSubCategoryClick(sc.id)}>
                    <span className="browser-item-name">{sc.label}</span>
                    <span className="browser-item-count">{sc.models.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 右栏: 模型 */}
          <div className="browser-col browser-col-right">
            <div className="browser-col-title">模型</div>
            <div className="browser-col-content">
              {!selectedGroup ? (
                <div className="browser-empty-state">
                  <div className="browser-empty-icon">👈</div>
                  <div className="browser-empty-text">请从左侧选择供应商</div>
                </div>
              ) : displaySubCategories.length === 0 ? (
                <div className="browser-empty-state">
                  <div className="browser-empty-text">该供应商暂无可用模型</div>
                </div>
              ) : (
                displaySubCategories.map(sc => (
                  <div key={sc.id} className="subcategory-section">
                    {selectedGroup.hasMultipleSubCategories && (
                      <div className="subcategory-header">
                        <span className="subcategory-name">{sc.label}</span>
                        {!sc.hasApiKey && <span className="subcategory-badge">需配置</span>}
                      </div>
                    )}

                    <div className="apikey-status-bar">
                      {sc.hasApiKey ? (
                        <div className="apikey-status configured">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          <span>API Key 已配置</span>
                          <button className="btn btn-xs btn-text-danger" onClick={() => handleRemoveApiKey(sc.providerId)} disabled={loading}>
                            删除
                          </button>
                        </div>
                      ) : (
                        <div className="apikey-status unconfigured">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          <span>未配置 API Key</span>
                          <button className="btn btn-xs btn-primary" onClick={() => { setSelectedProvider(sc.providerId); setShowAddKey(true); }} disabled={loading}>
                            {sc.providerId === 'minimax-portal' ? 'OAuth 登录' : '配置'}
                          </button>
                        </div>
                      )}
                    </div>

                    {sc.hasApiKey && sc.models.length > 0 ? (
                      <div className="models-list">
                        {sc.models.map(model => (
                          <div key={`${model.provider}/${model.id}`}
                            className={`model-option ${currentModel === `${model.provider}/${model.id}` ? 'active' : ''}`}
                            onClick={() => handleSelectModel(model.provider, model.id)}>
                            <div className="model-option-radio">
                              <div className={`radio-dot ${currentModel === `${model.provider}/${model.id}` ? 'active' : ''}`}></div>
                            </div>
                            <div className="model-option-info">
                              <div className="model-option-name">{model.name}</div>
                              {model.contextWindow && (
                                <div className="model-option-context">{model.contextWindow >= 1000 ? `${Math.round(model.contextWindow / 1000)}K` : model.contextWindow} 上下文</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : sc.hasApiKey ? (
                      <div className="models-empty">暂无可用模型</div>
                    ) : (
                      <div className="models-hint">配置 API Key 后可使用 {sc.models.length} 个模型</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Key弹窗 */}
      {showAddKey && (
        <div className="modal-overlay active" onClick={() => { setShowAddKey(false); setSelectedProvider(''); }}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {selectedProvider === 'minimax-portal' ? 'MiniMax OAuth 登录' : '添加 API Key'}
              </h3>
              <button className="modal-close" onClick={() => { setShowAddKey(false); setSelectedProvider(''); }}>×</button>
            </div>
            <div className="modal-body">
              {!selectedProvider && (
                <div className="form-group">
                  <label className="form-label">选择提供商</label>
                  <select className="form-select" value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)}>
                    <option value="">请选择...</option>
                    {providerGroupList.flatMap(g => g.subCategories.map(sc => (
                      <option key={sc.id} value={sc.providerId}>
                        {g.hasMultipleSubCategories ? `${g.groupName} - ${sc.label}` : g.groupName}
                      </option>
                    )))}
                  </select>
                </div>
              )}

              {selectedProvider === 'minimax-portal' ? (
                <MiniMaxOAuth
                  onShowToast={onShowToast}
                  onSuccess={() => {
                    setShowAddKey(false);
                    setSelectedProvider('');
                    refreshModels();
                  }}
                />
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">API Key</label>
                    <input type="password" className="form-input" placeholder="输入 API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                    <div className="form-hint">API Key 将安全存储在本地</div>
                  </div>
                </>
              )}
            </div>
            {selectedProvider !== 'minimax-portal' && (
              <div className="modal-footer">
                <button className="btn" onClick={() => { setShowAddKey(false); setSelectedProvider(''); }}>取消</button>
                <button className="btn btn-primary" onClick={handleSaveApiKey} disabled={!selectedProvider || !apiKey.trim() || loading}>
                  {loading ? '保存中...' : '保存'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 网络搜索 */}
      <div className="settings-group" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
        <div className="settings-group-title"><span>🌐 网络搜索</span></div>
        <div className="settings-item-desc" style={{ marginBottom: '16px' }}>配置网络搜索 API Key，启用 AI 实时联网搜索功能</div>

        <div className="settings-item" style={{ marginBottom: '16px' }}>
          <div className="settings-item-label">
            <div className="settings-item-title">启用网络搜索</div>
            <div className="settings-item-desc">允许 AI 使用网络搜索工具</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={searchEnabled} onChange={(e) => setSearchEnabled(e.target.checked)} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="search-provider-list">
          {searchProviders.map(provider => (
            <div key={provider.id} className="provider-item" style={{ marginBottom: '12px' }}>
              <div className="provider-header">
                <span className="provider-name">{provider.name}</span>
                <span className={`provider-status ${provider.hasKey ? 'configured' : 'unconfigured'}`}>{provider.hasKey ? '已配置' : '未配置'}</span>
                {provider.hasKey ? (
                  <button className="btn-icon-sm" onClick={() => handleRemoveSearchApiKey(provider.id)} title="删除配置">×</button>
                ) : (
                  <button className="btn btn-sm" onClick={() => { setSearchProvider(provider.id); setShowAddSearchKey(true); }}>配置</button>
                )}
              </div>
              <div className="settings-item-desc" style={{ marginTop: '4px' }}>{provider.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 搜索API弹窗 */}
      {showAddSearchKey && (
        <div className="modal-overlay active" onClick={() => setShowAddSearchKey(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">配置 {searchProviders.find(p => p.id === searchProvider)?.name} API Key</h3>
              <button className="modal-close" onClick={() => setShowAddSearchKey(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input type="password" className="form-input" placeholder="输入 API Key" value={searchApiKey} onChange={e => setSearchApiKey(e.target.value)} />
              </div>
              <div className="form-hint">
                {searchProvider === 'brave' && '获取 Brave API Key: https://brave.com/search/api/'}
                {searchProvider === 'perplexity' && '获取 Perplexity API Key: https://www.perplexity.ai/settings'}
                {searchProvider === 'grok' && '获取 xAI API Key: https://console.x.ai'}
                {searchProvider === 'gemini' && '获取 Google AI API Key: https://aistudio.google.com/app/apikey'}
                {searchProvider === 'kimi' && '获取 Kimi API Key: https://platform.moonshot.cn/'}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAddSearchKey(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSaveSearchApiKey} disabled={!searchApiKey.trim() || loading}>
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="settings-actions">
        <button className="btn" onClick={refreshModels} disabled={loading}>刷新配置</button>
      </div>
    </div>
  );
};

export default AIModelSettings;
