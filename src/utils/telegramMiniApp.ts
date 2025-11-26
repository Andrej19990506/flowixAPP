/**
 * Утилиты для работы с Telegram Mini App в React Native
 * 
 * В React Native приложении Telegram Mini App может быть встроен через WebView
 * или через нативный модуль, если Telegram предоставляет SDK для React Native.
 * 
 * Пока используем WebView подход для получения initData от Telegram.
 */

// Интерфейс для initData от Telegram Mini App
export interface TelegramInitData {
  query_id?: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
  start_param?: string;
}

/**
 * Парсит initData строку от Telegram Mini App
 * Формат: key1=value1&key2=value2&hash=...
 */
export const parseInitData = (initDataString: string): TelegramInitData | null => {
  try {
    const params = new URLSearchParams(initDataString);
    const initData: TelegramInitData = {
      auth_date: parseInt(params.get('auth_date') || '0', 10),
      hash: params.get('hash') || '',
    };

    if (params.get('query_id')) {
      initData.query_id = params.get('query_id') || undefined;
    }

    if (params.get('user')) {
      try {
        initData.user = JSON.parse(decodeURIComponent(params.get('user') || '{}'));
      } catch (e) {
        console.error('❌ [Telegram] Ошибка парсинга user из initData:', e);
      }
    }

    if (params.get('start_param')) {
      initData.start_param = params.get('start_param') || undefined;
    }

    return initData;
  } catch (error) {
    console.error('❌ [Telegram] Ошибка парсинга initData:', error);
    return null;
  }
};

/**
 * Проверяет, запущено ли приложение из Telegram Mini App
 * В React Native это можно определить через:
 * 1. WebView с Telegram Mini App скриптом
 * 2. Нативные параметры запуска
 * 3. Deep linking параметры
 */
export const isTelegramMiniApp = (): boolean => {
  // TODO: Реализовать проверку через WebView или нативные параметры
  // Пока возвращаем false, так как это будет реализовано позже
  return false;
};

/**
 * Получает initData от Telegram Mini App
 * В React Native это делается через WebView с Telegram Mini App скриптом
 */
export const getTelegramInitData = async (): Promise<string | null> => {
  // TODO: Реализовать получение initData через WebView
  // Пока возвращаем null
  return null;
};

