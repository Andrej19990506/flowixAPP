import { io, Socket } from 'socket.io-client';
import EventEmitter from 'eventemitter3';
import { AppState, AppStateStatus } from 'react-native';

// Типы событий для авторизации
export interface ServerToClientEvents {
  bot_auth_token: (data: { token: string; session_id: string }) => void;
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
}

export interface ClientToServerEvents {
  join_room: (data: { room: string }, callback?: (response: any) => void) => void;
  leave_room: (data: { room: string }, callback?: (response: any) => void) => void;
}

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private wsUrl: string;
  private stateChangeEmitter = new EventEmitter();
  private appStateSubscription: any = null;
  private currentAppState: AppStateStatus = 'active';
  private reconnectOnForeground: boolean = true;
  private activeRooms: Set<string> = new Set(); // Отслеживаем активные комнаты

  constructor() {
    // URL WebSocket сервиса
    // Для Android эмулятора используем 10.0.2.2
    // Для реального Android устройства используем локальный IP компьютера в сети
    // Для iOS эмулятора - localhost
    // Можно переопределить через init() если нужно
    if (__DEV__) {
      // Определяем, эмулятор или реальное устройство
      // В React Native можно использовать Platform.OS и проверку эмулятора
      const { Platform } = require('react-native');
      
      // Для Android эмулятора используем 10.0.2.2
      // Для реального Android устройства используем локальный IP
      // Для iOS эмулятора используем localhost
      if (Platform.OS === 'android') {
        // Для Android эмулятора используем 10.0.2.2
        // Для реального Android устройства используем локальный IP
        const LOCAL_NETWORK_IP = '192.168.0.115'; // IP вашего компьютера в локальной сети
        
        // Автоматически определяем эмулятор по наличию '10.0.2.2' в bundle URL или используем эмулятор по умолчанию
        // Если вы используете реальное устройство, замените на LOCAL_NETWORK_IP
        // Для эмулятора Android всегда используем 10.0.2.2
        this.wsUrl = `http://10.0.2.2:8001`; // Эмулятор Android
      } else if (Platform.OS === 'ios') {
        // Для iOS эмулятора используем localhost
        this.wsUrl = 'http://localhost:8001';
      } else {
        // Fallback
        const LOCAL_NETWORK_IP = '192.168.0.115';
        this.wsUrl = `http://${LOCAL_NETWORK_IP}:8001`;
      }
    } else {
      this.wsUrl = 'wss://appninjabot.ru'; // Production URL
    }
    
    // Инициализируем текущее состояние приложения
    this.currentAppState = AppState.currentState;
    this.setupAppStateListener();
  }

  init(wsUrl?: string): void {
    if (wsUrl) {
      this.wsUrl = wsUrl;
    }
    console.log('🔌 [SocketService] Инициализация WebSocket:', this.wsUrl);
  }

  private setupAppStateListener(): void {
    // Отслеживаем изменения состояния приложения
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const previousAppState = this.currentAppState;
      this.currentAppState = nextAppState;

      console.log(`📱 [SocketService] Изменение состояния приложения: ${previousAppState} -> ${nextAppState}`);

      // Если приложение вернулось из фона
      if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 [SocketService] Приложение вернулось в активное состояние');
        
        // Проверяем состояние WebSocket соединения
        if (this.reconnectOnForeground && (!this.socket || !this.socket.connected)) {
          console.log('🔄 [SocketService] Переподключение WebSocket после возврата из фона...');
          // Даем небольшую задержку для стабилизации сети
          setTimeout(() => {
            this.connect();
          }, 1000);
        } else if (this.socket?.connected) {
          console.log('✅ [SocketService] WebSocket уже подключен после возврата из фона');
        }
      }
      // Если приложение ушло в фон
      else if (previousAppState === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('📱 [SocketService] Приложение ушло в фон');
        // НЕ отключаем соединение принудительно, позволяем Socket.IO самому управлять
        // Это важно для получения событий даже когда приложение в фоне
      }
    });
  }

  connect(): void {
    if (this.socket?.connected) {
      console.log('✅ [SocketService] WebSocket уже подключен');
      return;
    }

    if (!this.socket) {
      console.log('🔌 [SocketService] Создание нового подключения к WebSocket:', this.wsUrl);
      
      // Используем ТОЧНО те же настройки, что и в веб-версии
      // Увеличиваем таймаут для Android эмулятора (может быть медленнее)
      // Для React Native пробуем сначала websocket, потом polling
      this.socket = io(this.wsUrl, {
        transports: ['websocket', 'polling'], // Пробуем сначала websocket, если не работает - fallback на polling
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // Бесконечные попытки переподключения
        autoConnect: false,
        forceNew: true,
        timeout: 60000, // Увеличиваем таймаут до 60 секунд (как на сервере)
        path: '/socket.io/',
        auth: undefined, // В веб-версии auth передается только если есть userId, здесь userId нет при инициализации
        // Для React Native не отправляем Origin заголовок (его может не быть)
        extraHeaders: {},
        // Разрешаем обновление до websocket, но не принуждаем
        upgrade: true, // Разрешаем обновление до websocket
        rememberUpgrade: false, // Не запоминаем успешное обновление (каждый раз пробуем)
      });

      this.setupSocketHandlers();
    }

    if (this.socket && !this.socket.connected) {
      console.log('🔄 [SocketService] Подключение WebSocket...');
      this.socket.connect();
    }
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    // Добавляем обработчики для отладки (как в веб-версии)
    this.socket.io.on('error', (error: any) => {
      console.error('❌ [SocketService] Engine.IO ошибка:', error);
      // Не прерываем работу при ошибке, просто логируем
      // Socket.IO сам попытается переподключиться
    });
    
    // Обработка ошибок транспорта
    this.socket.io.engine?.on('error', (error: any) => {
      console.error('❌ [SocketService] Transport ошибка:', error);
      // При ошибке websocket Socket.IO автоматически переключится на polling
      if (this.socket?.io?.engine?.transport?.name === 'websocket') {
        console.log('🔄 [SocketService] WebSocket ошибка, переключаемся на polling...');
      }
    });
    
    // Обработка закрытия соединения
    this.socket.io.engine?.on('close', (reason: string) => {
      console.log('🔌 [SocketService] Соединение закрыто:', reason);
      // Socket.IO автоматически попытается переподключиться
    });
    
    // Обработка успешного обновления транспорта
    this.socket.io.engine?.on('upgrade', () => {
      const transport = this.socket?.io?.engine?.transport;
      console.log('⬆️ [SocketService] Транспорт обновлен до:', transport?.name);
    });
    
    // Обработка ошибки обновления транспорта
    this.socket.io.engine?.on('upgradeError', (error: any) => {
      console.error('❌ [SocketService] Ошибка обновления транспорта:', error);
      console.log('🔄 [SocketService] Остаемся на текущем транспорте:', this.socket?.io?.engine?.transport?.name);
    });

    this.socket.io.on('reconnect_attempt', (attempt: number) => {
      console.log(`🔄 [SocketService] Попытка переподключения #${attempt}`);
      
      // В React Native не принуждаем переключение на websocket, оставляем polling
      // так как websocket может не работать стабильно в эмуляторе
      // Если polling работает, используем его
      if (this.socket && this.socket.io && this.socket.io.opts) {
        // Не меняем transports, оставляем как есть (polling, websocket)
        // Socket.IO сам выберет рабочий транспорт
        console.log('🔄 [SocketService] Переподключение, используем доступные транспорты');
      }
    });

    this.socket.io.on('reconnect', (attempt: number) => {
      console.log(`✅ [SocketService] Переподключение успешно после ${attempt} попыток`);
    });

    this.socket.io.on('reconnect_error', (error: any) => {
      console.error('❌ [SocketService] Ошибка переподключения:', error);
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('❌ [SocketService] Переподключение не удалось после всех попыток');
    });

    this.socket.on('connect', () => {
      console.log('✅ [SocketService] WebSocket подключен, ID:', this.socket?.id);
      if (this.socket?.io?.engine?.transport) {
        console.log('🔗 [SocketService] Transport:', this.socket.io.engine.transport.name);
      }
      this.stateChangeEmitter.emit('connect');
      
      // Восстанавливаем подключение к активным комнатам после переподключения (асинхронно, без блокировки)
      if (this.activeRooms.size > 0) {
        console.log(`🔄 [SocketService] Восстанавливаем подключение к ${this.activeRooms.size} комнатам после переподключения`);
        const roomsToRestore = Array.from(this.activeRooms);
        // Выполняем восстановление асинхронно, не блокируя событие connect
        Promise.all(roomsToRestore.map(async (roomName) => {
          try {
            await this.joinRoom(roomName);
            console.log(`✅ [SocketService] Восстановлено подключение к комнате: ${roomName}`);
          } catch (error) {
            console.error(`❌ [SocketService] Ошибка восстановления подключения к комнате ${roomName}:`, error);
            // Удаляем комнату из списка активных, если не удалось восстановить
            this.activeRooms.delete(roomName);
          }
        })).catch((error) => {
          console.error('❌ [SocketService] Ошибка при восстановлении комнат:', error);
        });
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('❌ [SocketService] WebSocket отключен, причина:', reason);
      this.stateChangeEmitter.emit('disconnect', reason);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ [SocketService] Ошибка подключения WebSocket:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        url: this.wsUrl,
      });
      this.stateChangeEmitter.emit('connect_error', error);
    });

    // Обработчик события bot_auth_token - подписываемся напрямую на socket событие
    this.socket.on('bot_auth_token', (data: { token: string; session_id: string }) => {
      console.log('🔐 [SocketService] ✅✅✅ Получено событие bot_auth_token напрямую от socket:', JSON.stringify(data));
      // Эмитим через EventEmitter для подписчиков
      this.stateChangeEmitter.emit('bot_auth_token', data);
    });
    
    // Также подписываемся на все события для отладки (но НЕ дублируем bot_auth_token)
    this.socket.onAny((event: string, ...args: any[]) => {
      // Логируем все события кроме bot_auth_token (он уже обработан выше)
      if (event !== 'bot_auth_token') {
        console.log(`🔍 [SocketService] onAny: получено событие "${event}":`, args);
      } else {
        // Для bot_auth_token только логируем, но не эмитим (уже обработано выше)
        console.log('🔍 [SocketService] onAny: получено событие bot_auth_token (уже обработано через прямой обработчик)');
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 [SocketService] Отключение WebSocket...');
      this.reconnectOnForeground = false; // Отключаем автопереподключение
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Позволяет включить/выключить автопереподключение при возврате из фона
  setReconnectOnForeground(enabled: boolean): void {
    this.reconnectOnForeground = enabled;
    console.log(`🔄 [SocketService] Автопереподключение при возврате из фона: ${enabled ? 'включено' : 'выключено'}`);
  }

  // Очистка подписок при уничтожении сервиса
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.disconnect();
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  joinRoom(roomName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('WebSocket не подключен'));
        return;
      }

      console.log(`🔗 [SocketService] Присоединение к комнате: ${roomName}`);
      console.log(`🔍 [SocketService] Состояние сокета:`, {
        connected: this.socket.connected,
        id: this.socket.id,
        transport: this.socket.io?.engine?.transport?.name
      });
      
      // Таймаут для ответа
      const timeout = setTimeout(() => {
        console.error(`❌ [SocketService] Таймаут присоединения к комнате: ${roomName}`);
        reject(new Error('Timeout joining room'));
      }, 10000);
      
      this.socket.emit('join_room', { room: roomName }, (response: any) => {
        clearTimeout(timeout);
        console.log(`📨 [SocketService] Ответ от сервера при присоединении к комнате ${roomName}:`, response);
        if (response?.status === 'success') {
          console.log(`✅ [SocketService] Успешно присоединились к комнате: ${roomName}`);
          this.activeRooms.add(roomName); // Добавляем в список активных комнат
          resolve();
        } else {
          console.error(`❌ [SocketService] Ошибка присоединения к комнате: ${roomName}`, response);
          reject(new Error(response?.error || 'Ошибка присоединения к комнате'));
        }
      });
    });
  }

  leaveRoom(roomName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        resolve(); // Если не подключен, считаем что уже покинули
        return;
      }

      console.log(`🔗 [SocketService] Покидание комнаты: ${roomName}`);
      this.socket.emit('leave_room', { room: roomName }, (response: any) => {
        console.log(`✅ [SocketService] Покинули комнату: ${roomName}`);
        this.activeRooms.delete(roomName); // Удаляем из списка активных комнат
        resolve();
      });
    });
  }

  // Подписка на события
  subscribe<T = any>(event: string, callback: (data: T) => void): () => void {
    this.stateChangeEmitter.on(event, callback);
    return () => {
      this.stateChangeEmitter.off(event, callback);
    };
  }

  // Отписка от событий
  unsubscribe(event: string, callback: (...args: any[]) => void): void {
    this.stateChangeEmitter.off(event, callback);
  }
}

// Экспортируем singleton
export const socketService = new SocketService();

