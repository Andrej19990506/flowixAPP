import axios, { type AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Базовый URL API (можно вынести в конфиг)
// Для Android эмулятора используем 10.0.2.2 вместо localhost
// Для iOS симулятора можно использовать localhost
// Для реального устройства используйте IP адрес машины
// Локальный IP компьютера в сети (замените на свой, если отличается)
// Для эмулятора используйте: 'http://10.0.2.2:8000/api'
// Для реального устройства используйте: `http://${LOCAL_NETWORK_IP}:8000/api`
const LOCAL_NETWORK_IP = '192.168.0.115';

// Определяем базовый URL API в зависимости от окружения
let API_BASE_URL: string;

if (__DEV__) {
  // В режиме разработки используем локальный сервер
  // WebSocket работает на порту 8001, API скорее всего на 8000
  const { Platform } = require('react-native');
  
  if (Platform.OS === 'android') {
    // Для Android эмулятора используем 10.0.2.2
    API_BASE_URL = 'http://10.0.2.2:8000/api';
  } else if (Platform.OS === 'ios') {
    // Для iOS эмулятора используем localhost
    API_BASE_URL = 'http://localhost:8000/api';
  } else {
    // Fallback для реального устройства
    API_BASE_URL = `http://${LOCAL_NETWORK_IP}:8000/api`;
  }
  
  console.log('🔧 [API] Используется ЛОКАЛЬНЫЙ API сервер:', API_BASE_URL);
} else {
  // В продакшене используем продакшен URL (CDN Selectel)
  API_BASE_URL = 'https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net/api';
  console.log('🌐 [API] Используется ПРОДАКШЕН API сервер:', API_BASE_URL);
}

// Создаем инстанс axios
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для добавления токена к запросам
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор для обработки ошибок и обновления токена
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/v1/auth/token/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data;
          await AsyncStorage.setItem('access_token', access_token);
          await AsyncStorage.setItem('refresh_token', refresh_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Очищаем токены при ошибке обновления
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Функция для декодирования base64 в React Native
const base64Decode = (str: string): string => {
  try {
    // В React Native используем полифилл для atob
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');
    for (let i = 0; i < str.length; i += 4) {
      const enc1 = chars.indexOf(str.charAt(i));
      const enc2 = chars.indexOf(str.charAt(i + 1));
      const enc3 = chars.indexOf(str.charAt(i + 2));
      const enc4 = chars.indexOf(str.charAt(i + 3));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    return output;
  } catch (error) {
    console.error('❌ [Auth] Ошибка декодирования base64:', error);
    return '';
  }
};

// Функция для декодирования JWT токена
export const decodeJWT = (token: string): { sub?: string; [key: string]: any } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = JSON.parse(base64Decode(paddedPayload));
    return decoded;
  } catch (error) {
    console.error('❌ [Auth] Ошибка декодирования JWT:', error);
    return null;
  }
};

// Функция для получения user_id из токена
export const getUserIdFromToken = (token: string | null): number | null => {
  if (!token) {
    return null;
  }
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.sub) {
    return null;
  }
  try {
    return parseInt(decoded.sub, 10);
  } catch (error) {
    console.error('❌ [Auth] Ошибка парсинга user_id из токена:', error);
    return null;
  }
};

// Функция для получения токена
export const getAuthToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('access_token');
};

// Функция для авторизации через Telegram WebApp
export const authenticateWithTelegram = async (initData: string): Promise<{
  access_token: string;
  refresh_token: string;
  user: any;
  groups: any[];
}> => {
  console.log('🔐 [Auth] Начинаем авторизацию через Telegram WebApp');
  const response = await axiosInstance.post('/v1/auth/telegram/webapp', {
    init_data: initData,
  });

  const { tokens, user, groups } = response.data;
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    user,
    groups,
  };
};

// Функция для авторизации через токен от бота
export const authenticateWithBotToken = async (token: string): Promise<{
  access_token: string;
  refresh_token: string;
  user: any;
  groups: any[];
}> => {
  const requestStartTime = Date.now();
  console.log('🔐 [authenticateWithBotToken] Начинаем авторизацию через токен бота:', token.substring(0, 8) + '...');
  console.log('🔗 [authenticateWithBotToken] API URL:', `${API_BASE_URL}/v1/auth/telegram/bot`);
  console.log('🔑 [authenticateWithBotToken] Длина токена:', token.length);
  console.log('🔑 [authenticateWithBotToken] Полный токен (для отладки):', token);
  console.log('⏰ [authenticateWithBotToken] Время начала запроса:', new Date(requestStartTime).toISOString());
  
  try {
    const requestBody = {
      token: token,
    };
    console.log('📤 [authenticateWithBotToken] Отправляем запрос с телом:', JSON.stringify(requestBody));
    
    const response = await axiosInstance.post('/v1/auth/telegram/bot', requestBody);

    console.log('✅ [authenticateWithBotToken] Ответ получен:', {
      status: response.status,
      hasTokens: !!response.data.tokens,
      hasUser: !!response.data.user,
      hasGroups: !!response.data.groups,
    });
    console.log('📦 [authenticateWithBotToken] Полный ответ от сервера:', JSON.stringify(response.data, null, 2));
    console.log('👤 [authenticateWithBotToken] Данные пользователя:', JSON.stringify(response.data.user, null, 2));
    console.log('👥 [authenticateWithBotToken] Группы:', JSON.stringify(response.data.groups, null, 2));
    console.log('🎫 [authenticateWithBotToken] Токены:', {
      hasAccessToken: !!response.data.tokens?.access_token,
      hasRefreshToken: !!response.data.tokens?.refresh_token,
      accessTokenPreview: response.data.tokens?.access_token?.substring(0, 20) + '...',
    });

    const { tokens, user, groups } = response.data;
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user,
      groups,
    };
  } catch (error: any) {
    const errorDetails = {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      requestData: error.config?.data,
      fullUrl: error.config?.url ? `${API_BASE_URL}${error.config.url}` : undefined,
    };
    
    console.error('❌ [authenticateWithBotToken] Ошибка запроса:', errorDetails);
    console.error('🌐 [authenticateWithBotToken] Запрос отправлен на:', errorDetails.fullUrl || `${API_BASE_URL}/v1/auth/telegram/bot`);
    console.error('🌐 [authenticateWithBotToken] Базовый URL API:', API_BASE_URL);
    
    // Более детальная обработка ошибки валидации токена
    if (error.response?.status === 500 && error.response?.data?.detail === 'Failed to validate token') {
      console.error('🔴 [authenticateWithBotToken] КРИТИЧЕСКАЯ ОШИБКА: Сервер не может валидировать токен');
      console.error('🔴 [authenticateWithBotToken] Возможные причины:');
      console.error('   1. Токен уже был использован (одноразовый токен)');
      console.error('   2. Токен истек или был удален с сервера');
      console.error('   3. Токен не был создан на сервере');
      console.error('   4. Проблема на стороне бэкенда');
      console.error(`🔴 [authenticateWithBotToken] Полученный токен: ${token}`);
      console.error(`🔴 [authenticateWithBotToken] Длина токена: ${token.length}`);
      console.error(`🔴 [authenticateWithBotToken] Отправленный запрос: ${JSON.stringify({ token })}`);
      console.error(`🔴 [authenticateWithBotToken] Полный URL запроса: ${errorDetails.fullUrl || `${API_BASE_URL}/v1/auth/telegram/bot`}`);
      
      // Создаем более информативную ошибку
      const validationError = new Error('Токен авторизации недействителен или уже использован. Попробуйте авторизоваться снова.');
      (validationError as any).code = 'TOKEN_VALIDATION_FAILED';
      (validationError as any).originalError = error;
      throw validationError;
    }
    
    throw error;
  }
};

export { axiosInstance };

