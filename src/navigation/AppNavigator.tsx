import React, { useEffect, useRef } from 'react';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Linking, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useTheme } from '../contexts/ThemeContext';
import { restoreSessionThunk, authenticateWithBotTokenThunk } from '../store/slices/authSlice';
import { handleIncomingLink, linking } from '../utils/linking';
import AuthScreen from '../screens/AuthScreen';
import MainMenuScreen from '../screens/MainMenuScreen';
import { InventoryScreen } from '../features/Inventory';
import { QrScannerScreen } from '../features/Inventory/components/QrScanner';
import LoadingOverlay from '../shared/components/LoadingOverlay';

export type RootStackParamList = {
  Auth: undefined;
  MainMenu: undefined;
  Inventory: { chatId?: string } | undefined;
  QrScanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized, isLoading, user } = useAppSelector((state) => state.auth);
  const { theme } = useTheme();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Логирование состояния авторизации
  useEffect(() => {
    console.log('🔍 [AppNavigator] Состояние авторизации:', {
      isAuthenticated,
      isInitialized,
      isLoading,
      hasUser: !!user,
      userId: user?.id,
    });
  }, [isAuthenticated, isInitialized, isLoading, user]);

  useEffect(() => {
    // Восстанавливаем сессию при запуске приложения
    console.log('🔄 [AppNavigator] Восстанавливаем сессию...');
    dispatch(restoreSessionThunk());
  }, [dispatch]);

  // Обработка deep linking для авторизации через бота
  useEffect(() => {
    console.log('🔗 [AppNavigator] Настраиваем обработку deep links...');
    
    // Обрабатываем начальную ссылку (если приложение было открыто по ссылке)
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          console.log('🔗 [AppNavigator] Начальная ссылка:', url);
          handleDeepLink(url);
        } else {
          console.log('🔗 [AppNavigator] Начальная ссылка не найдена');
        }
      })
      .catch((err) => {
        console.error('❌ [AppNavigator] Ошибка получения начальной ссылки:', err);
      });

    // Обрабатываем ссылки, когда приложение уже открыто
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔗 [AppNavigator] Получено событие deep link:', event.url);
      handleDeepLink(event.url);
    });

    return () => {
      console.log('🔗 [AppNavigator] Отписываемся от deep links');
      subscription.remove();
    };
  }, [dispatch]);

  const handleDeepLink = (url: string) => {
    console.log('🔗 [Deep Link] Получена ссылка:', url);
    try {
      const result = handleIncomingLink(url);
      console.log('🔗 [Deep Link] Результат обработки:', result);
      if (result && result.type === 'auth_token') {
        console.log('🔐 [Deep Link] Обнаружен auth_token, начинаем авторизацию...', result.token?.substring(0, 8));
        dispatch(authenticateWithBotTokenThunk(result.token));
      } else {
        console.log('⚠️ [Deep Link] Ссылка не содержит auth_token или не распознана');
      }
    } catch (error) {
      console.error('❌ [Deep Link] Ошибка обработки ссылки:', error);
    }
  };

  // Обработка авторизации через Telegram Mini App
  useEffect(() => {
    // Проверяем, запущено ли приложение из Telegram Mini App
    const checkTelegramMiniApp = async () => {
      try {
        const { getTelegramInitData } = await import('../utils/telegramMiniApp');
        const initData = await getTelegramInitData();
        
        if (initData) {
          console.log('🔐 [Telegram Mini App] Обнаружен initData, авторизуемся автоматически...');
          const { authenticateWithTelegramThunk } = await import('../store/slices/authSlice');
          dispatch(authenticateWithTelegramThunk(initData));
        }
      } catch (error) {
        console.error('❌ [Telegram Mini App] Ошибка проверки:', error);
      }
    };

    if (isInitialized && !isAuthenticated) {
      checkTelegramMiniApp();
    }
  }, [isInitialized, isAuthenticated, dispatch]);

  // Автоматический переход на главный экран после успешной авторизации
  useEffect(() => {
    if (isInitialized && isAuthenticated && navigationRef.current) {
      console.log('✅ [AppNavigator] Пользователь авторизован, переходим на MainMenu');
      // Проверяем текущий экран
      const currentRoute = navigationRef.current.getCurrentRoute();
      if (currentRoute?.name !== 'MainMenu') {
        console.log('🔄 [AppNavigator] Перенаправляем на MainMenu с экрана:', currentRoute?.name);
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'MainMenu' }],
        });
      }
    }
  }, [isInitialized, isAuthenticated]);

  // Не рендерим навигацию до завершения инициализации
  if (!isInitialized) {
    return (
      <View className={`flex-1 ${theme === 'dark' ? 'dark' : ''}`}>
        <LoadingOverlay isLoading={true} />
      </View>
    );
  }

  // Определяем начальный экран на основе состояния авторизации
  // Важно: используем isInitialized && isAuthenticated, чтобы не показывать Auth, если еще идет инициализация
  const initialRouteName = (isInitialized && isAuthenticated) ? 'MainMenu' : 'Auth';

  return (
    <View className={`flex-1 ${theme === 'dark' ? 'dark' : ''}`}>
      <NavigationContainer 
        ref={navigationRef} 
        linking={linking}
      >
        <Stack.Navigator 
          screenOptions={{ headerShown: false }}
          initialRouteName={initialRouteName}
        >
          {/* Всегда рендерим MainMenu, чтобы initialRouteName работал правильно */}
          <Stack.Screen name="MainMenu" component={MainMenuScreen} />
          <Stack.Screen 
            name="Inventory" 
            component={InventoryScreen}
            options={{ 
              headerShown: false,
              animation: 'slide_from_right'
            }}
          />
          <Stack.Screen 
            name="QrScanner" 
            component={QrScannerScreen}
            options={{ 
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'fade'
            }}
          />
          <Stack.Screen 
            name="Auth" 
            component={AuthScreen}
            options={{ presentation: 'modal' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};

export default AppNavigator;
