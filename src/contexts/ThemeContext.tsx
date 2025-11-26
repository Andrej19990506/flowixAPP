import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isSystemTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'flowix-app-theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>('light');
  const [isInitialized, setIsInitialized] = useState(false);

  // Загружаем сохраненную тему при инициализации
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme as Theme);
          console.log('✅ [Theme] Загружена сохраненная тема:', savedTheme);
        } else {
          // Если тема не сохранена, используем системную
          const systemTheme = systemColorScheme === 'dark' ? 'dark' : 'light';
          setTheme(systemTheme);
          console.log('✅ [Theme] Используется системная тема:', systemTheme);
        }
      } catch (error) {
        console.error('❌ [Theme] Ошибка загрузки темы:', error);
        // Fallback на системную тему
        const systemTheme = systemColorScheme === 'dark' ? 'dark' : 'light';
        setTheme(systemTheme);
      } finally {
        setIsInitialized(true);
      }
    };

    loadTheme();
  }, [systemColorScheme]);

  // Сохраняем тему при изменении
  useEffect(() => {
    if (isInitialized) {
      AsyncStorage.setItem(THEME_STORAGE_KEY, theme).catch((error) => {
        console.error('❌ [Theme] Ошибка сохранения темы:', error);
      });
      console.log('💾 [Theme] Тема сохранена:', theme);
    }
  }, [theme, isInitialized]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      console.log('🔄 [Theme] Переключение темы:', prev, '->', newTheme);
      return newTheme;
    });
  };

  const isSystemTheme = !isInitialized || theme === (systemColorScheme === 'dark' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

