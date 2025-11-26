import { Linking } from 'react-native';

export interface LinkingConfig {
  prefixes: string[];
  config: {
    screens: {
      Auth: string;
      MainMenu: string;
    };
  };
}

// Схема для deep linking
export const linking: LinkingConfig = {
  prefixes: ['flowixapp://', 'https://app.flowix.ru'],
  config: {
    screens: {
      Auth: 'auth',
      MainMenu: 'main',
    },
  },
};

// Функция для извлечения auth_token из URL
export const extractAuthTokenFromUrl = (url: string): string | null => {
  try {
    console.log('🔗 [extractAuthTokenFromUrl] Парсим URL:', url);
    // Для deep links вида flowixapp://auth?auth_token=... нужно использовать другой подход
    if (url.startsWith('flowixapp://')) {
      // Убираем схему и парсим вручную
      const withoutScheme = url.replace('flowixapp://', '');
      const parts = withoutScheme.split('?');
      if (parts.length > 1) {
        const params = new URLSearchParams(parts[1]);
        const token = params.get('auth_token');
        console.log('🔗 [extractAuthTokenFromUrl] Токен из deep link:', token ? token.substring(0, 8) + '...' : 'не найден');
        return token;
      }
    }
    // Для обычных URL
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('auth_token');
    console.log('🔗 [extractAuthTokenFromUrl] Токен из обычного URL:', token ? token.substring(0, 8) + '...' : 'не найден');
    return token;
  } catch (error) {
    console.error('❌ [Linking] Ошибка парсинга URL:', error);
    return null;
  }
};

// Функция для обработки входящих ссылок
export const handleIncomingLink = (url: string): { type: 'auth_token'; token: string } | null => {
  console.log('🔗 [handleIncomingLink] Обрабатываем URL:', url);
  try {
    // Пробуем обработать как обычный URL
    let token = extractAuthTokenFromUrl(url);
    
    // Если не получилось, пробуем как deep link формат flowixapp://auth?auth_token=...
    if (!token && url.includes('flowixapp://')) {
      const urlObj = new URL(url);
      token = urlObj.searchParams.get('auth_token');
    }
    
    // Если все еще не получилось, пробуем парсить вручную
    if (!token) {
      const match = url.match(/[?&]auth_token=([^&]+)/);
      if (match) {
        token = match[1];
      }
    }
    
    console.log('🔗 [handleIncomingLink] Извлеченный токен:', token ? token.substring(0, 8) + '...' : 'не найден');
    
    if (token) {
      return { type: 'auth_token', token };
    }
    return null;
  } catch (error) {
    console.error('❌ [handleIncomingLink] Ошибка обработки URL:', error);
    return null;
  }
};

