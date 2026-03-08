/**
 * 主入口文件
 * 渲染 React 应用到 DOM
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles/chat.css';
import './components/ToolCard/styles.css';

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (!container) {
    console.error('Root element not found');
    return;
  }

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
