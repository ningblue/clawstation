import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface FeedbackButtonProps {
  onClick: () => void;
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({ onClick }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title="问题反馈"
      className="gap-1 text-muted-foreground hover:text-foreground"
    >
      <MessageCircle className="size-4" />
      <span>问题反馈</span>
    </Button>
  );
};
