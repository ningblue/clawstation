/**
 * ChatInput 组件
 * 聊天输入区域，包含文本输入框、发送按钮、模型选择器和智能提示
 */

import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { InlineModelPicker } from './InlineModelPicker';

export interface ChatInputProps {
  /** 发送消息回调 */
  onSend: (message: string) => void;
  /** 是否禁用输入 */
  disabled?: boolean;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否正在流式响应 */
  isStreaming?: boolean;
  /** 取消流式响应回调 */
  onCancel?: () => void;
  /** 引擎是否正在重启（模型切换中） */
  engineRestarting?: boolean;
  /** 模型名称 */
  modelName?: string;
}

/** Ref 接口 */
export interface ChatInputRef {
  /** 设置输入框文本 */
  setText: (text: string) => void;
}

// 智能提示配置
const SMART_PROMPTS = [
  { icon: '👋', text: '自我介绍', prompt: '你好，请介绍一下你自己' },
  { icon: '🐍', text: 'Python代码', prompt: '请帮我写一段Python代码' },
  { icon: '📝', text: '内容总结', prompt: '请帮我总结这段内容' },
  { icon: '🌐', text: '翻译', prompt: '请帮我翻译这段话' },
];

/**
 * 智能提示组件
 */
interface SmartPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const SmartPrompts: React.FC<SmartPromptsProps> = ({ onSelect, disabled }) => {
  return (
    <div className="smart-prompts">
      <div className="smart-prompts-label">快捷提示:</div>
      <div className="smart-prompts-list">
        {SMART_PROMPTS.map((item) => (
          <button
            key={item.text}
            className="smart-prompt-btn"
            onClick={() => onSelect(item.prompt)}
            disabled={disabled}
          >
            {item.icon} {item.text}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * ChatInput 组件
 */
export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({
  onSend,
  disabled = false,
  placeholder = '输入消息... (按 Enter 发送, Shift+Enter 换行)',
  isStreaming = false,
  onCancel,
  engineRestarting = false,
  modelName,
}, ref) => {
  const [inputValue, setInputValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    setText: (newText: string) => {
      console.log('[ChatInput] setText called:', newText.substring(0, 50));
      setInputValue(newText);
      textareaRef.current?.focus();
      // 延迟调整高度
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
      }, 0);
    }
  }));

  const effectivePlaceholder = engineRestarting ? '正在切换模型...' : placeholder;
  const effectiveDisabled = disabled || isStreaming || engineRestarting;

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // 处理输入变化
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustHeight();
  }, [adjustHeight]);

  // 处理发送
  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || disabled || isStreaming || engineRestarting) return;

    // 长度限制检查
    if (trimmed.length > 10000) {
      alert('消息过长，请控制在10000字符以内');
      return;
    }

    onSend(trimmed);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, disabled, isStreaming, engineRestarting, onSend]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 只有在非组合输入状态下按下 Enter 才发送
    if (e.key === 'Enter' && !isComposing && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isComposing]);

  // 处理智能提示选择
  const handlePromptSelect = useCallback((prompt: string) => {
    setInputValue(prompt);
    textareaRef.current?.focus();
    // 延迟调整高度
    setTimeout(adjustHeight, 0);
  }, [adjustHeight]);

  // 输入变化时调整高度
  useEffect(() => {
    adjustHeight();
  }, [inputValue, adjustHeight]);

  return (
    <div className="input-area">
      <div className="input-container">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={effectivePlaceholder}
          disabled={effectiveDisabled}
          rows={1}
        />
        <div className="chat-input-footer">
          <div className="chat-input-footer-left">
            <InlineModelPicker disabled={effectiveDisabled} />
          </div>
          <div className="chat-input-footer-right">
            {isStreaming ? (
              <button
                className="send-btn stop-btn"
                onClick={onCancel}
                title="停止生成"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={effectiveDisabled || !inputValue.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
