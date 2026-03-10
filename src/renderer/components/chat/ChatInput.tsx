// ChatInput.tsx - 输入区域（操作栏+编辑器+发送按钮）

import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface ChatInputProps {
  onSend: (message: string) => void;
  onTyping?: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  modelName?: string;
  onModelClick?: () => void;
  onImageUpload?: (files: FileList) => void;
  onFileUpload?: (files: FileList) => void;
  onCancel?: () => void;
  isStreaming?: boolean;
}

// 快捷提示配置
const SMART_PROMPTS = [
  { icon: '👋', text: '自我介绍', prompt: '你好，请介绍一下你自己' },
  { icon: '🐍', text: 'Python代码', prompt: '请帮我写一段Python代码' },
  { icon: '📝', text: '内容总结', prompt: '请帮我总结这段内容' },
  { icon: '🌐', text: '翻译', prompt: '请帮我翻译这段话' },
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onTyping,
  disabled = false,
  placeholder = '输入消息... (按 Enter 发送, Shift+Enter 换行)',
  modelName,
  onModelClick,
  onImageUpload,
  onFileUpload,
  onCancel,
  isStreaming = false,
}) => {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showPrompts, setShowPrompts] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 自动调整textarea高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // 处理输入变化
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    onTyping?.(newText);
    adjustHeight();

    if (newText.length > 0) {
      setShowPrompts(false);
    }
  }, [onTyping, adjustHeight]);

  // 处理发送
  const handleSend = useCallback(() => {
    const trimmedText = text.trim();
    if (trimmedText && !disabled) {
      onSend(trimmedText);
      setText('');
      setShowPrompts(true);

      // 重置textarea高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [text, disabled, onSend]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 只有在非组合输入状态下按下 Enter 才发送
    if (e.key === 'Enter' && !isComposing && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isComposing]);

  // 使用快捷提示
  const usePrompt = useCallback((prompt: string) => {
    setText(prompt);
    setShowPrompts(false);
    textareaRef.current?.focus();

    // 延迟调整高度
    setTimeout(adjustHeight, 0);
  }, [adjustHeight]);

  // 处理文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (type === 'image' && onImageUpload) {
        onImageUpload(files);
      } else if (type === 'file' && onFileUpload) {
        onFileUpload(files);
      }
    }
    // 重置input以便可以再次选择相同文件
    e.target.value = '';
  }, [onImageUpload, onFileUpload]);

  // 拖放处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // 检查是否包含图片
      const hasImages = Array.from(files).some(file => file.type.startsWith('image/'));
      if (hasImages && onImageUpload) {
        onImageUpload(files);
      } else if (onFileUpload) {
        onFileUpload(files);
      }
    }
  }, [onImageUpload, onFileUpload]);

  // 聚焦时隐藏提示
  useEffect(() => {
    if (isFocused && text.length > 0) {
      setShowPrompts(false);
    }
  }, [isFocused, text]);

  return (
    <div className="chat-input-container">
      {/* 快捷提示 */}
      {showPrompts && !disabled && (
        <div className="smart-prompts">
          <span className="prompts-label">快捷提示:</span>
          <div className="prompts-list">
            {SMART_PROMPTS.map((item, index) => (
              <button
                key={index}
                className="prompt-btn"
                onClick={() => usePrompt(item.prompt)}
              >
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div
        className={`input-wrapper ${isFocused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* 工具栏 */}
        <div className="input-toolbar">
          <div className="toolbar-left">
            {/* 模型选择按钮 */}
            {modelName && (
              <button
                className="toolbar-btn model-btn"
                onClick={onModelClick}
                title="切换模型"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                <span className="model-name">{modelName}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            )}

            {/* 图片上传按钮 */}
            <button
              className="toolbar-btn"
              onClick={() => imageInputRef.current?.click()}
              title="上传图片"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e, 'image')}
            />

            {/* 文件上传按钮 */}
            <button
              className="toolbar-btn"
              onClick={() => fileInputRef.current?.click()}
              title="上传文件"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e, 'file')}
            />
          </div>

          <div className="toolbar-right">
            {/* 工具选择 */}
            <button className="toolbar-btn" title="工具">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* 文本输入 */}
        <div className="textarea-wrapper">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={disabled ? '请等待响应完成...' : placeholder}
            disabled={disabled}
            rows={1}
          />

          {/* 发送/停止按钮 */}
          {isStreaming ? (
            <button
              className="send-btn active stop-btn"
              onClick={onCancel}
              title="停止生成"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          ) : (
            <button
              className={`send-btn ${text.trim() && !disabled ? 'active' : ''}`}
              onClick={handleSend}
              disabled={!text.trim() || disabled}
              title="发送消息"
            >
              {disabled ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinner">
                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </button>
          )}
        </div>

        {/* 底部提示 */}
        <div className="input-footer">
          <span className="hint-text">
            {disabled ? 'AI正在思考中...' : 'Enter 发送 · Shift+Enter 换行'}
          </span>
          {text.length > 0 && (
            <span className="char-count">{text.length} 字符</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
