/**
 * UserMenu 组件
 * 右下角用户头像和菜单，使用 shadcn DropdownMenu
 */

import React from 'react';
import { Settings, LogOut } from 'lucide-react';
import { useUserStore } from '../../stores';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserMenuProps {
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenSettings, onLogout }) => {
  const { user } = useUserStore();

  // 获取用户显示信息
  const getUserDisplay = () => {
    if (user?.username) {
      return {
        name: user.username,
        initial: user.username.charAt(0).toUpperCase(),
      };
    }
    return {
      name: 'Demo User',
      initial: 'D',
    };
  };

  const { name, initial } = getUserDisplay();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none">
        <Avatar size="sm">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={8}>
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{user?.email || 'demo@clawstation.local'}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onOpenSettings}>
            <Settings className="size-4" />
            <span>设置</span>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onLogout}>
            <LogOut className="size-4" />
            <span>退出</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
