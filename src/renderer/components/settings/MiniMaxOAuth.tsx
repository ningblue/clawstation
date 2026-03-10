/**
 * MiniMax OAuth 登录组件
 */
import React, { useState, useEffect, useCallback } from 'react';

interface MiniMaxOAuthProps {
  onShowToast: (message: string, type: 'success' | 'error') => void;
  onSuccess?: () => void;
}

type OAuthState = 'idle' | 'starting' | 'waiting' | 'polling' | 'success' | 'error';

export const MiniMaxOAuth: React.FC<MiniMaxOAuthProps> = ({ onShowToast, onSuccess }) => {
  const [oauthState, setOauthState] = useState<OAuthState>('idle');
  const [region, setRegion] = useState<'global' | 'cn'>('global');
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  // 检查 OAuth 状态
  useEffect(() => {
    checkOAuthStatus();
  }, []);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(c => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const checkOAuthStatus = async () => {
    try {
      const result = await window.electronAPI.miniMaxOAuthStatus();
      if (result.success && result.configured) {
        setOauthState('success');
      }
    } catch (err) {
      console.error('Failed to check OAuth status:', err);
    }
  };

  const startOAuth = async () => {
    try {
      setOauthState('starting');
      setError('');

      const result = await window.electronAPI.miniMaxOAuthStart(region);

      if (!result.success) {
        throw new Error(result.error || '启动 OAuth 失败');
      }

      setUserCode(result.userCode || '');
      setVerificationUri(result.verificationUri || '');
      setExpiresAt(result.expiresAt || 0);
      setOauthState('waiting');
      setCountdown(Math.floor(((result.expiresAt || 0) - Date.now()) / 1000));

      // 自动打开浏览器
      if (result.verificationUri) {
        window.electronAPI.openExternalUrl?.(result.verificationUri);
      }

      // 开始轮询
      pollForToken();
    } catch (err) {
      setError((err as Error).message);
      setOauthState('error');
      onShowToast('OAuth 启动失败: ' + (err as Error).message, 'error');
    }
  };

  const pollForToken = useCallback(async () => {
    setOauthState('polling');

    const maxAttempts = 180; // 最多轮询 180 次 (约 3-6 分钟)
    let attempts = 0;

    const doPoll = async () => {
      try {
        attempts++;
        const result = await window.electronAPI.miniMaxOAuthPoll();

        if (!result.success) {
          throw new Error(result.error || '获取 token 失败');
        }

        if (result.token) {
          // 授权成功
          setOauthState('success');
          onShowToast('MiniMax OAuth 授权成功！', 'success');
          onSuccess?.();
          return;
        }

        // 仍在等待用户授权
        if (attempts < maxAttempts) {
          setTimeout(doPoll, 2000);
        } else {
          throw new Error('授权超时，请重试');
        }
      } catch (err) {
        setError((err as Error).message);
        setOauthState('error');
        onShowToast('OAuth 失败: ' + (err as Error).message, 'error');
      }
    };

    doPoll();
  }, [onShowToast, onSuccess]);

  const cancelOAuth = async () => {
    try {
      await window.electronAPI.miniMaxOAuthCancel();
      setOauthState('idle');
      setUserCode('');
      setVerificationUri('');
      setCountdown(0);
    } catch (err) {
      console.error('Failed to cancel OAuth:', err);
    }
  };

  const clearOAuth = async () => {
    if (!confirm('确定要清除 MiniMax OAuth 授权吗？')) return;

    try {
      const result = await window.electronAPI.miniMaxOAuthClear();
      if (result.success) {
        setOauthState('idle');
        onShowToast('OAuth 授权已清除', 'success');
      } else {
        throw new Error(result.error || '清除失败');
      }
    } catch (err) {
      onShowToast('清除失败: ' + (err as Error).message, 'error');
    }
  };

  const copyUserCode = () => {
    navigator.clipboard.writeText(userCode);
    onShowToast('用户码已复制到剪贴板', 'success');
  };

  const openVerificationUrl = () => {
    if (verificationUri) {
      window.electronAPI.openExternalUrl?.(verificationUri);
    }
  };

  // 格式化倒计时
  const formatCountdown = () => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (oauthState === 'success') {
    return (
      <div className="minimax-oauth-box configured">
        <div className="oauth-status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>MiniMax OAuth 已授权</span>
        </div>
        <button className="btn btn-xs btn-text-danger" onClick={clearOAuth}>
          取消授权
        </button>
      </div>
    );
  }

  if (oauthState === 'waiting' || oauthState === 'polling') {
    return (
      <div className="minimax-oauth-box pending">
        <div className="oauth-header">
          <span className="oauth-title">等待 OAuth 授权</span>
          <span className="oauth-countdown">{formatCountdown()}</span>
        </div>

        <div className="oauth-instructions">
          <p>请按以下步骤完成授权：</p>
          <ol>
            <li>访问 <a href="#" onClick={openVerificationUrl}>{verificationUri}</a></li>
            <li>输入用户码：<code onClick={copyUserCode} title="点击复制">{userCode}</code></li>
            <li>点击授权按钮</li>
          </ol>
        </div>

        <div className="oauth-actions">
          <button className="btn btn-sm" onClick={copyUserCode}>
            复制用户码
          </button>
          <button className="btn btn-sm btn-primary" onClick={openVerificationUrl}>
            打开授权页面
          </button>
          <button className="btn btn-sm btn-text" onClick={cancelOAuth}>
            取消
          </button>
        </div>

        {oauthState === 'polling' && (
          <div className="oauth-polling">
            <span className="spinner"></span>
            <span>等待授权确认...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="minimax-oauth-box">
      <div className="oauth-config">
        <div className="oauth-region">
          <label>选择区域：</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as 'global' | 'cn')}
            disabled={oauthState === 'starting'}
          >
            <option value="global">Global (api.minimax.io)</option>
            <option value="cn">CN (api.minimaxi.com)</option>
          </select>
        </div>

        <button
          className="btn btn-sm btn-primary"
          onClick={startOAuth}
          disabled={oauthState === 'starting'}
        >
          {oauthState === 'starting' ? (
            <>
              <span className="spinner"></span>
              <span>启动中...</span>
            </>
          ) : (
            'OAuth 登录'
          )}
        </button>
      </div>

      {error && (
        <div className="oauth-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default MiniMaxOAuth;
