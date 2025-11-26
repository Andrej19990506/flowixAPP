import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Linking,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Dimensions,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  authenticateWithBotTokenThunk,
  clearError,
} from '../store/slices/authSlice';
import { socketService } from '../services/socketService';

const AuthScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, error, isAuthenticated } = useAppSelector((state: any) => state.auth);
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [botUsername, setBotUsername] = useState<string>('Flouix_bot');
  const [sessionId, setSessionId] = useState<string>(() => {
    // Генерируем уникальный session_id для WebSocket
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  });
  const hasJoinedRoom = useRef(false);
  const authInProgress = useRef(false);
  const unsubscribeBotAuthToken = useRef<(() => void) | null>(null);
  const currentRoomName = useRef<string | null>(null);
  
  // Функция для генерации нового session_id
  const generateNewSessionId = () => {
    const newSessionId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    console.log('🔄 [AuthScreen] Генерируем новый session_id:', newSessionId);
    setSessionId(newSessionId);
    return newSessionId;
  };

  useEffect(() => {
    // Получаем username бота с бэкенда
    const fetchBotUsername = async () => {
      try {
        // TODO: Заменить на реальный API endpoint
        // const response = await axiosInstance.get('/v1/auth/bot-username');
        // if (response.data?.bot_username) {
        //   setBotUsername(response.data.bot_username);
        // }
      } catch (error) {
        console.warn('⚠️ [Auth] Не удалось получить username бота, используем дефолтный:', error);
      }
    };

    fetchBotUsername();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Ошибка авторизации', error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  // Функция для присоединения к комнате и подписки на события
  const setupRoomAndSubscription = async () => {
    if (authInProgress.current || !socketService.isConnected()) {
      return;
    }

    const roomName = `auth_session:${sessionId}`;
    currentRoomName.current = roomName;

    // Если уже присоединились, просто проверяем подписку
    if (hasJoinedRoom.current) {
      // Если подписка уже есть, ничего не делаем
      if (unsubscribeBotAuthToken.current) {
        return;
      }
    } else {
      // Присоединяемся к комнате для получения токена
      console.log(`🔗 [AuthScreen] Пытаемся присоединиться к комнате: ${roomName}`);
      try {
        await socketService.joinRoom(roomName);
        hasJoinedRoom.current = true;
        console.log(`✅ [AuthScreen] Успешно присоединились к комнате ${roomName} для получения токена`);
      } catch (joinError) {
        console.error(`❌ [AuthScreen] Ошибка присоединения к комнате ${roomName}:`, joinError);
        return;
      }
    }

    // Подписываемся на событие bot_auth_token через EventEmitter
    if (!unsubscribeBotAuthToken.current) {
      console.log('🔐 [AuthScreen] Подписываемся на событие bot_auth_token для session_id:', sessionId);
      console.log('🔍 [AuthScreen] Состояние перед подпиской:', {
        isConnected: socketService.isConnected(),
        hasJoinedRoom: hasJoinedRoom.current,
        roomName: roomName
      });

      unsubscribeBotAuthToken.current = socketService.subscribe('bot_auth_token', async (data: { token: string; session_id: string }) => {
        console.log('🔐 [AuthScreen] ✅✅✅ Получено событие bot_auth_token через subscribe:', {
          received_session_id: data.session_id,
          expected_session_id: sessionId,
          match: data.session_id === sessionId,
          authInProgress: authInProgress.current,
          fullData: JSON.stringify(data)
        });

        // Проверяем, что это наш session_id и авторизация еще не начата
        if (data.session_id !== sessionId) {
          console.log('⚠️ [AuthScreen] Получен токен для другого session_id, игнорируем');
          return;
        }

        // Защита от повторной обработки - проверяем ДО установки флага
        if (authInProgress.current) {
          console.log('⚠️ [AuthScreen] Авторизация уже в процессе, игнорируем повторное событие');
          return;
        }

        // Устанавливаем флаг сразу, чтобы предотвратить повторную обработку
        authInProgress.current = true;
        const tokenReceivedAt = Date.now();
        console.log('🔐 [AuthScreen] Получен токен через WebSocket, начинаем авторизацию');
        console.log('⏰ [AuthScreen] Время получения токена:', new Date(tokenReceivedAt).toISOString());

        try {
          // Авторизуемся через токен
          await dispatch(authenticateWithBotTokenThunk(data.token)).unwrap();
          console.log('✅ [AuthScreen] Авторизация успешна');

          // Отписываемся от события
          if (unsubscribeBotAuthToken.current) {
            unsubscribeBotAuthToken.current();
            unsubscribeBotAuthToken.current = null;
          }

          // Покидаем комнату авторизации
          if (currentRoomName.current) {
            await socketService.leaveRoom(currentRoomName.current);
            hasJoinedRoom.current = false;
            currentRoomName.current = null;
          }

          // НЕ отключаем WebSocket - он нужен для работы с инвентаризацией и другими функциями
          // WebSocket останется подключенным для получения обновлений в реальном времени
          console.log('✅ [AuthScreen] WebSocket остается подключенным для работы приложения');

          // Если мы уже были авторизованы (добавляем новый аккаунт), закрываем модальный экран
          // Если не были авторизованы, навигация произойдет автоматически через AppNavigator
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        } catch (authError: any) {
          console.error('❌ [AuthScreen] Ошибка авторизации через WebSocket токен:', authError);
          
          // При ошибке сбрасываем флаг, чтобы можно было попробовать снова
          authInProgress.current = false;
          
          // Определяем сообщение об ошибке
          let errorMessage = 'Ошибка авторизации';
          let errorTitle = 'Ошибка авторизации';
          
          if (authError?.code === 'TOKEN_VALIDATION_FAILED') {
            errorTitle = 'Токен недействителен';
            errorMessage = authError.message || 'Токен авторизации недействителен или уже использован. Пожалуйста, нажмите кнопку авторизации снова.';
          } else if (authError?.message) {
            errorMessage = authError.message;
          } else if (typeof authError === 'string') {
            errorMessage = authError;
          }
          
          // Проверяем, не является ли ошибка связанной с валидацией токена
          if (authError?.response?.data?.detail === 'Failed to validate token' || 
              authError?.message?.includes('Failed to validate token')) {
            errorTitle = 'Токен недействителен';
            errorMessage = 'Токен авторизации недействителен или уже использован. Пожалуйста, нажмите кнопку авторизации снова.';
          }
          
          console.error('❌ [AuthScreen] Показываем пользователю ошибку:', { errorTitle, errorMessage });
          
          // Сбрасываем состояние комнаты при ошибке валидации токена, чтобы можно было начать заново
          if (authError?.code === 'TOKEN_VALIDATION_FAILED' || 
              authError?.response?.data?.detail === 'Failed to validate token' ||
              authError?.message?.includes('Failed to validate token')) {
            console.log('🔄 [AuthScreen] Сбрасываем состояние при ошибке валидации токена');
            // Покидаем комнату, чтобы можно было присоединиться к новой
            if (currentRoomName.current && hasJoinedRoom.current) {
              socketService.leaveRoom(currentRoomName.current).catch((err) => {
                console.error('❌ [AuthScreen] Ошибка при выходе из комнаты:', err);
              });
              hasJoinedRoom.current = false;
              currentRoomName.current = null;
            }
            
            // Отписываемся от событий, чтобы можно было подписаться заново
            if (unsubscribeBotAuthToken.current) {
              unsubscribeBotAuthToken.current();
              unsubscribeBotAuthToken.current = null;
            }
            
            // Генерируем новый session_id для следующей попытки
            console.log('🔄 [AuthScreen] Генерируем новый session_id для повторной попытки');
            generateNewSessionId();
          }
          
          Alert.alert(errorTitle, errorMessage, [
            {
              text: 'Понятно',
              style: 'default',
            },
          ]);
        }
      });
    }
  };

  // Настройка WebSocket для получения токена
  useEffect(() => {
    let unsubscribeConnect: (() => void) | null = null;

    const setupWebSocket = async () => {
      try {
        // Инициализируем и подключаемся к WebSocket
        socketService.init();
        socketService.setReconnectOnForeground(true); // Включаем автопереподключение
        socketService.connect();

        // Ждем подключения
        const waitForConnection = (): Promise<void> => {
          return new Promise((resolve) => {
            if (socketService.isConnected()) {
              resolve();
              return;
            }

            const checkInterval = setInterval(() => {
              if (socketService.isConnected()) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);

            // Таймаут 5 секунд
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 5000);
          });
        };

        await waitForConnection();

        console.log(`🔍 [AuthScreen] Проверка подключения WebSocket:`, {
          isConnected: socketService.isConnected(),
          hasJoinedRoom: hasJoinedRoom.current,
          sessionId: sessionId
        });

        // Подписываемся на события подключения для автоматического восстановления
        unsubscribeConnect = socketService.subscribe('connect', async () => {
          console.log('🔄 [AuthScreen] WebSocket переподключен, восстанавливаем комнату...');
          if (!authInProgress.current) {
            await setupRoomAndSubscription();
          }
        });

        // Настраиваем комнату и подписку
        await setupRoomAndSubscription();
      } catch (wsError) {
        console.error('❌ [AuthScreen] Ошибка настройки WebSocket:', wsError);
      }
    };

    setupWebSocket();

    // Обработка изменений AppState для восстановления при возврате из фона
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // Когда приложение возвращается из фона
      if (nextAppState === 'active' && !authInProgress.current) {
        console.log('📱 [AuthScreen] Приложение вернулось в активное состояние, проверяем WebSocket...');
        // Даем небольшую задержку для стабилизации соединения
        setTimeout(async () => {
          if (socketService.isConnected() && !hasJoinedRoom.current && currentRoomName.current) {
            console.log('🔄 [AuthScreen] Восстанавливаем подключение к комнате после возврата из фона');
            await setupRoomAndSubscription();
          }
        }, 1500);
      }
    });

    return () => {
      // Отписываемся от события подключения
      if (unsubscribeConnect) {
        unsubscribeConnect();
      }
      appStateSubscription.remove();
      // Отписываемся от события bot_auth_token
      if (unsubscribeBotAuthToken.current) {
        unsubscribeBotAuthToken.current();
        unsubscribeBotAuthToken.current = null;
      }
      // Отключаемся от комнаты при размонтировании
      if (hasJoinedRoom.current && currentRoomName.current) {
        socketService.leaveRoom(currentRoomName.current);
        hasJoinedRoom.current = false;
        currentRoomName.current = null;
      }
    };
  }, [sessionId, dispatch, navigation]);

  const handleAuthorizeViaBot = async () => {
    console.log('🔐 [AuthScreen] Нажата кнопка авторизации через бота');
    console.log('🔍 [AuthScreen] Текущее состояние:', {
      sessionId: sessionId,
      isConnected: socketService.isConnected(),
      hasJoinedRoom: hasJoinedRoom.current
    });

    // Убеждаемся, что WebSocket подключен
    if (!socketService.isConnected()) {
      console.log('⚠️ [AuthScreen] WebSocket не подключен, пытаемся подключиться...');
      socketService.connect();
      // Ждем подключения
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (socketService.isConnected()) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(undefined);
        }, 3000);
      });
    }

    // Убеждаемся, что мы присоединены к комнате и подписаны на события перед открытием бота
    if (!hasJoinedRoom.current || !unsubscribeBotAuthToken.current) {
      console.log('⚠️ [AuthScreen] Еще не присоединились к комнате или не подписались на события, пытаемся восстановить...');
      try {
        await setupRoomAndSubscription();
      } catch (err) {
        console.error(`❌ [AuthScreen] Не удалось присоединиться к комнате:`, err);
        Alert.alert('Ошибка', 'Не удалось установить соединение. Попробуйте еще раз.');
        return;
      }
    }

    // Открываем ссылку на бота
    const botLink = `https://t.me/${botUsername}?start=auth_${sessionId}`;
    console.log('🔗 [AuthScreen] Открываем ссылку с session_id:', botLink);
    Linking.openURL(botLink)
      .then(() => {
        console.log('✅ [AuthScreen] Ссылка открыта успешно, ожидаем токен через WebSocket...');
        console.log(`🔍 [AuthScreen] Ожидаем событие bot_auth_token для session_id: ${sessionId}`);
      })
      .catch((err) => {
        console.error('❌ [AuthScreen] Ошибка открытия ссылки на бота:', err);
        Alert.alert('Ошибка', 'Не удалось открыть Telegram');
      });
  };

  const handleCheckAuthToken = async () => {
    // Проверяем, есть ли auth_token в deep link
    // Это будет обрабатываться через deep linking
    console.log('🔍 [Auth] Проверка токена авторизации...');
  };

  const isDark = theme === 'dark';
  const styles = createStyles(isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Логотип */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/Logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Заголовок */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Добро пожаловать в Flowix</Text>
          <Text style={styles.subtitle}>
            Для доступа к приложению необходимо авторизоваться через Telegram
          </Text>
        </View>

        {/* Кнопка авторизации через Telegram */}
        <Pressable
          onPress={handleAuthorizeViaBot}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.telegramButton,
            isLoading && styles.telegramButtonDisabled,
            pressed && styles.telegramButtonPressed,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <FontAwesomeIcon name="telegram" size={24} color="#FFFFFF" style={styles.telegramIcon} />
              <Text style={styles.telegramButtonText}>
                Авторизоваться через Telegram
              </Text>
            </>
          )}
        </Pressable>

        {/* Подсказка */}
        <Text style={styles.hint}>
          Нажмите на кнопку выше, чтобы перейти к авторизации через Telegram бота
        </Text>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (isDark: boolean) => {
  const screenWidth = Dimensions.get('window').width;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      // Градиентный фон через несколько слоев для эффекта градиента
      backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      // Добавляем градиентный эффект через overlay
      position: 'relative',
    },
    logoContainer: {
      marginBottom: 40,
      alignItems: 'center',
      justifyContent: 'center',
      // Добавляем тень для логотипа
      shadowColor: '#FF6B35',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 12,
    },
    logo: {
      width: 160,
      height: 160,
    },
    textContainer: {
      alignItems: 'center',
      marginBottom: 40,
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#1A1A1A',
      marginBottom: 16,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)',
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 8,
    },
    telegramButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0088cc', // Цвет Telegram
      borderRadius: 20,
      paddingVertical: 18,
      paddingHorizontal: 36,
      minWidth: screenWidth - 48,
      maxWidth: screenWidth - 48,
      // Улучшенная тень
      shadowColor: '#0088cc',
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 10,
    },
    telegramButtonDisabled: {
      opacity: 0.6,
    },
    telegramButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    telegramIcon: {
      marginRight: 12,
    },
    telegramButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    hint: {
      fontSize: 13,
      color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
      textAlign: 'center',
      marginTop: 32,
      paddingHorizontal: 24,
      lineHeight: 20,
    },
  });
};

export default AuthScreen;

