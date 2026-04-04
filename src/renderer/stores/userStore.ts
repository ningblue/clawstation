/**
 * 用户状态管理 Store
 * 管理用户偏好设置、主题、语言等
 */

import { useState, useEffect, useCallback } from 'react';

// 主题类型
export type Theme = 'light' | 'dark';

// 字体大小类型
export type FontSize = 'small' | 'medium' | 'large';

// 语言类型
export type Locale = 'zh-CN' | 'en-US';

// 用户偏好设置接口
export interface UserPreferences {
  theme: Theme;
  locale: Locale;
  fontSize: FontSize;
  autoSave: boolean;
}

// 用户接口
export interface User {
  id: number;
  username: string;
  email: string;
  preferences: UserPreferences;
  createdAt?: string;
  updatedAt?: string;
}

// 默认用户偏好设置
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  locale: 'zh-CN',
  fontSize: 'medium',
  autoSave: true,
};

// 本地存储键名
const STORAGE_KEY = 'clawstation_user_prefs';

/**
 * 用户状态管理 Hook
 */
export function useUserStore() {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 从本地存储加载偏好设置
   */
  const loadPreferencesFromStorage = useCallback((): UserPreferences | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (err) {
      console.error('Failed to load preferences from storage:', err);
    }
    return null;
  }, []);

  /**
   * 保存偏好设置到本地存储
   */
  const savePreferencesToStorage = useCallback((prefs: UserPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (err) {
      console.error('Failed to save preferences to storage:', err);
    }
  }, []);

  /**
   * 应用主题到界面
   */
  const applyTheme = useCallback((theme: Theme) => {
    // Tailwind dark: 使用 .dark 类
    // 自定义 CSS 使用 body.dark-theme 类
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark-theme');
    }
  }, []);

  /**
   * 应用字体大小到界面
   */
  const applyFontSize = useCallback((fontSize: FontSize) => {
    const sizeMap: Record<FontSize, string> = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    document.documentElement.style.fontSize = sizeMap[fontSize] || '16px';
  }, []);

  /**
   * 应用所有设置到界面
   */
  const applySettings = useCallback((prefs: UserPreferences) => {
    applyTheme(prefs.theme);
    applyFontSize(prefs.fontSize);
  }, [applyTheme, applyFontSize]);

  /**
   * 初始化用户
   */
  const initializeUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 首先尝试从本地存储加载偏好设置
      const storedPrefs = loadPreferencesFromStorage();
      if (storedPrefs) {
        setPreferences(storedPrefs);
        applySettings(storedPrefs);
      }

      // 尝试从后端获取或创建默认用户
      let userData = await window.electronAPI.invoke('user:get-by-username', 'default');

      if (!userData) {
        // 创建默认用户
        userData = await window.electronAPI.invoke('user:create', {
          username: 'default',
          email: 'default@clawstation.local',
          preferences: storedPrefs || DEFAULT_PREFERENCES,
        });
      }

      // 合并后端偏好设置
      let backendPrefs = userData.preferences;
      if (typeof backendPrefs === 'string') {
        try {
          backendPrefs = JSON.parse(backendPrefs);
        } catch (e) {
          console.error('Failed to parse user preferences:', e);
          backendPrefs = {};
        }
      }
      const mergedPrefs = { ...DEFAULT_PREFERENCES, ...backendPrefs };
      setUser({ ...userData, preferences: mergedPrefs });
      setPreferences(mergedPrefs);
      applySettings(mergedPrefs);
      savePreferencesToStorage(mergedPrefs);

      return userData;
    } catch (err) {
      console.error('Failed to initialize user:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize user');
      // 使用本地存储的设置作为后备
      const storedPrefs = loadPreferencesFromStorage();
      if (storedPrefs) {
        setPreferences(storedPrefs);
        applySettings(storedPrefs);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadPreferencesFromStorage, savePreferencesToStorage, applySettings]);

  /**
   * 更新偏好设置
   */
  const updatePreferences = useCallback(async (newPrefs: Partial<UserPreferences>) => {
    const updatedPrefs = { ...preferences, ...newPrefs };
    setPreferences(updatedPrefs);
    applySettings(updatedPrefs);
    savePreferencesToStorage(updatedPrefs);

    // 如果用户已登录，同步到后端
    if (user) {
      try {
        await window.electronAPI.invoke('user:update', user.id, {
          preferences: updatedPrefs,
        });
        setUser({ ...user, preferences: updatedPrefs });
      } catch (err) {
        console.error('Failed to update user preferences:', err);
      }
    }
  }, [user, preferences, applySettings, savePreferencesToStorage]);

  /**
   * 设置主题
   */
  const setTheme = useCallback((theme: Theme) => {
    updatePreferences({ theme });
  }, [updatePreferences]);

  /**
   * 设置字体大小
   */
  const setFontSize = useCallback((fontSize: FontSize) => {
    updatePreferences({ fontSize });
  }, [updatePreferences]);

  /**
   * 设置语言
   */
  const setLocale = useCallback((locale: Locale) => {
    updatePreferences({ locale });
  }, [updatePreferences]);

  /**
   * 设置自动保存
   */
  const setAutoSave = useCallback((autoSave: boolean) => {
    updatePreferences({ autoSave });
  }, [updatePreferences]);

  /**
   * 刷新用户信息
   */
  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const userData = await window.electronAPI.invoke('user:get-by-id', user.id);
      if (userData) {
        const mergedPrefs = { ...DEFAULT_PREFERENCES, ...userData.preferences };
        setUser({ ...userData, preferences: mergedPrefs });
        setPreferences(mergedPrefs);
        applySettings(mergedPrefs);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, [user, applySettings]);

  // 初始化
  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  return {
    user,
    preferences,
    loading,
    error,
    theme: preferences.theme,
    fontSize: preferences.fontSize,
    locale: preferences.locale,
    autoSave: preferences.autoSave,
    setTheme,
    setFontSize,
    setLocale,
    setAutoSave,
    updatePreferences,
    initializeUser,
    refreshUser,
  };
}

export default useUserStore;
