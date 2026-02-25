import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用程序交互
  appExit: () => ipcRenderer.invoke('app-exit'),
  appRestart: () => ipcRenderer.invoke('app-restart'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // 外部链接处理
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),

  // 错误对话框
  showErrorDialog: (options: { title: string; message: string }) =>
    ipcRenderer.invoke('show-error-dialog', options),

  // 监听主进程发送的消息
  onNewConversation: (callback: () => void) =>
    ipcRenderer.on('new-conversation', callback),

  onToggleSearch: (callback: () => void) =>
    ipcRenderer.on('toggle-search', callback),

  // 移除监听器
  removeNewConversationListener: (callback: () => void) =>
    ipcRenderer.removeListener('new-conversation', callback),

  removeToggleSearchListener: (callback: () => void) =>
    ipcRenderer.removeListener('toggle-search', callback)
});

// 定义API接口以便在渲染进程中使用类型提示
declare global {
  interface Window {
    electronAPI: {
      // 应用程序交互
      appExit: () => Promise<void>;
      appRestart: () => Promise<void>;
      getAppInfo: () => Promise<{
        name: string;
        version: string;
        platform: string;
      }>;

      // 外部链接处理
      openExternalUrl: (url: string) => Promise<void>;

      // 错误对话框
      showErrorDialog: (options: { title: string; message: string }) => Promise<void>;

      // 监听主进程发送的消息
      onNewConversation: (callback: () => void) => void;
      onToggleSearch: (callback: () => void) => void;

      // 移除监听器
      removeNewConversationListener: (callback: () => void) => void;
      removeToggleSearchListener: (callback: () => void) => void;
    };
  }
}