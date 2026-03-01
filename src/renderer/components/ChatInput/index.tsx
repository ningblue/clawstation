/**
 * ChatInput 组件
 * 聊天输入区域，包含文本输入框、发送按钮和智能提示
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface ChatInputProps {
  /** 发送消息回调 */
  onSend: (message: string) => void;
  /** 是否禁用输入 */
  disabled?: boolean;
  /** 占位符文本 */
  placeholder?: string;
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
export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = '输入消息... (按 Enter 发送, Shift+Enter 换行)',
}) => {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!trimmed || disabled) return;

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
  }, [inputValue, disabled, onSend]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

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
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={disabled || !inputValue.trim()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
