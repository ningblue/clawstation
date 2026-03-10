import React, { useState, useRef, useEffect } from 'react';
import './styles.css';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScreenshot?: string | null;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, initialScreenshot }) => {
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // If there's an initial screenshot, add it
      if (initialScreenshot) {
        // Convert base64 to File object
        fetch(initialScreenshot)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], "screenshot.png", { type: "image/png" });
            setImages([file]);
            setPreviews([initialScreenshot]);
          })
          .catch(console.error);
      }
    } else {
      // Reset form when closed
      setContent('');
      setContact('');
      setImages([]);
      setPreviews([]);
    }
  }, [isOpen, initialScreenshot]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    // Limit to 4 images for example
    if (images.length >= 4) {
      alert('最多只能上传4张截图');
      return;
    }

    setImages(prev => [...prev, file]);
    const url = URL.createObjectURL(file);
    setPreviews(prev => [...prev, url]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(handleFile);
    }
    // Reset value so same file can be selected again if needed
    if (e.target.value) e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) handleFile(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) handleFile(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = () => {
    if (!content.trim()) return;

    // TODO: Implement actual submission logic
    console.log('Feedback submitted:', {
      content,
      contact,
      images
    });

    alert('感谢您的反馈！');
    onClose();
  };

  return (
    <div className="feedback-modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="feedback-modal">
        <div className="feedback-header">
          <h2 className="feedback-title">问题反馈</h2>
          <p className="feedback-subtitle">
            如果您在使用过程中遇到任何问题，请随时反馈给我们。您的反馈将帮助我们不断改进和优化产品。
          </p>
        </div>

        <div className="feedback-form-group">
          <textarea
            className="feedback-textarea"
            placeholder="请输入您的问题或建议"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
          />
        </div>

        <div className="feedback-form-group">
          <label className="feedback-label">屏幕截图：</label>
          <div 
            className="feedback-image-upload"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {previews.map((url, index) => (
              <div key={index} className="feedback-image-item">
                <img src={url} alt={`Screenshot ${index + 1}`} />
                <button 
                  className="feedback-image-remove"
                  onClick={() => removeImage(index)}
                >
                  ✕
                </button>
              </div>
            ))}
            
            <button 
              className="feedback-upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="feedback-upload-icon">+</span>
              <span className="feedback-upload-text">点击添加，或拖拽/粘贴图片到此区域</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="feedback-form-group">
          <label className="feedback-label">联系电话</label>
          <input
            type="text"
            className="feedback-input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder=""
          />
        </div>

        <div className="feedback-footer">
          <button className="feedback-btn feedback-btn-cancel" onClick={onClose}>
            取消
          </button>
          <button 
            className={`feedback-btn feedback-btn-submit ${content.trim() ? 'active' : ''}`}
            onClick={handleSubmit}
            disabled={!content.trim()}
          >
            提交
          </button>
        </div>
      </div>
    </div>
  );
};
