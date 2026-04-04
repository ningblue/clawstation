import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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
      if (initialScreenshot) {
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

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>问题反馈</DialogTitle>
          <DialogDescription>
            如果您在使用过程中遇到任何问题，请随时反馈给我们。您的反馈将帮助我们不断改进和优化产品。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Textarea
            placeholder="请输入您的问题或建议"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            rows={4}
            className="resize-none"
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium">屏幕截图：</label>
            <div
              className="border border-dashed border-border rounded-lg p-3"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="flex flex-wrap gap-2">
                {previews.map((url, index) => (
                  <div key={index} className="relative size-20 rounded-md overflow-hidden border border-border">
                    <img src={url} alt={`Screenshot ${index + 1}`} className="size-full object-cover" />
                    <button
                      className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                      onClick={() => removeImage(index)}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}

                <button
                  className="flex flex-col items-center justify-center size-20 rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-5 mb-1" />
                  <span className="text-[10px]">添加</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                点击添加，或拖拽/粘贴图片到此区域
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">联系电话</label>
            <Input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder=""
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!content.trim()}
          >
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
