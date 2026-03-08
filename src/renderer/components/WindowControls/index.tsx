/**
 * WindowControls 组件
 * 自定义窗口控制按钮（最小化、最大化/还原、关闭）
 * 用于无边框窗口
 */

import React, { useState, useEffect } from 'react';
import './styles.css';

export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 检查窗口是否最大化
    const checkMaximized = async () => {
      if (window.electronAPI?.isWindowMaximized) {
        const maximized = await window.electronAPI.isWindowMaximized();
        setIsMaximized(maximized);
      }
    };
    checkMaximized();
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.windowMinimize?.();
  };

  const handleMaximize = async () => {
    if (window.electronAPI?.windowMaximize) {
      const maximized = await window.electronAPI.windowMaximize();
      setIsMaximized(maximized);
    }
  };

  const handleClose = () => {
    window.electronAPI?.windowClose?.();
  };

  // macOS 使用原生按钮，不显示自定义按钮
  // 使用 userAgent 检测平台，因为 renderer 进程中 process.platform 不可用
  const isMac = navigator.userAgent.toLowerCase().includes('mac');
  if (isMac) {
    return null;
  }

  return (
    <div className="window-controls">
      <button
        className="window-control-btn minimize"
        onClick={handleMinimize}
        title="最小化"
      >
        <svg width="10" height="2" viewBox="0 0 10 2">
          <rect width="10" height="2" fill="currentColor" />
        </svg>
      </button>
      <button
        className="window-control-btn maximize"
        onClick={handleMaximize}
        title={isMaximized ? '还原' : '最大化'}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              d="M2,4 L2,8 L6,8 M4,2 L8,2 L8,6"
            />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect
              x="1"
              y="1"
              width="8"
              height="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </button>
      <button
        className="window-control-btn close"
        onClick={handleClose}
        title="关闭"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            d="M1,1 L9,9 M9,1 L1,9"
          />
        </svg>
      </button>
    </div>
  );
};
