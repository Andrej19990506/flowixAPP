import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticateWithTelegram, authenticateWithBotToken, getUserIdFromToken, axiosInstance } from '../../services/api';
import type { User, Role } from '../../types/user';

// Интерфейс для аккаунта
export interface Account {
  userId: string;
  user: User;
  accessToken: string;
  refreshToken: string;
  addedAt: number; // timestamp
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  // Множественные аккаунты
  accounts: Record<string, Account>; // userId -> Account
  currentAccountId: string | null; // ID текущего активного аккаунта
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: false,
  accounts: {},
  currentAccountId: null,
};

// Thunk для авторизации через Telegram Mini App
export const authenticateWithTelegramThunk = createAsyncThunk(
  'auth/authenticateWithTelegram',
  async (initData: string, { rejectWithValue }: { rejectWithValue: (value: string) => any }) => {
    try {
      const result = await authenticateWithTelegram(initData);
      // Сохраняем токены в AsyncStorage
      await AsyncStorage.setItem('access_token', result.access_token);
      await AsyncStorage.setItem('refresh_token', result.refresh_token);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка авторизации через Telegram');
    }
  }
);

// Вспомогательная функция для сохранения аккаунта
const saveAccount = async (user: User, accessToken: string, refreshToken: string) => {
  const account: Account = {
    userId: user.id,
    user,
    accessToken,
    refreshToken,
    addedAt: Date.now(),
  };
  
  // Загружаем существующие аккаунты
  const accountsJson = await AsyncStorage.getItem('accounts');
  const accounts: Record<string, Account> = accountsJson ? JSON.parse(accountsJson) : {};
  
  // Добавляем/обновляем аккаунт
  accounts[user.id] = account;
  
  // Сохраняем все аккаунты
  await AsyncStorage.setItem('accounts', JSON.stringify(accounts));
  
  // Сохраняем текущий активный аккаунт
  await AsyncStorage.setItem('current_account_id', user.id);
  
  // Для обратной совместимости сохраняем также старые ключи
  await AsyncStorage.setItem('access_token', accessToken);
  await AsyncStorage.setItem('refresh_token', refreshToken);
  
  console.log('💾 [saveAccount] Аккаунт сохранен:', { userId: user.id, accountsCount: Object.keys(accounts).length });
  
  return accounts;
};

// Вспомогательная функция для загрузки всех аккаунтов
const loadAccounts = async (): Promise<Record<string, Account>> => {
  const accountsJson = await AsyncStorage.getItem('accounts');
  if (!accountsJson) {
    return {};
  }
  return JSON.parse(accountsJson);
};

// Thunk для авторизации через токен от бота
export const authenticateWithBotTokenThunk = createAsyncThunk(
  'auth/authenticateWithBotToken',
  async (token: string, { rejectWithValue }: { rejectWithValue: (value: string) => any }) => {
    try {
      console.log('🔐 [authenticateWithBotTokenThunk] Начало авторизации через токен бота:', token.substring(0, 8) + '...');
      const result = await authenticateWithBotToken(token);
      console.log('✅ [authenticateWithBotTokenThunk] Авторизация успешна:', {
        hasAccessToken: !!result.access_token,
        hasRefreshToken: !!result.refresh_token,
        hasUser: !!result.user,
        hasGroups: !!result.groups,
      });
      
      // Сохраняем токены в AsyncStorage ПЕРЕД запросом контекста, чтобы интерцептор axios мог их использовать
      await AsyncStorage.setItem('access_token', result.access_token);
      await AsyncStorage.setItem('refresh_token', result.refresh_token);
      console.log('💾 [authenticateWithBotTokenThunk] Токены сохранены в AsyncStorage');
      
      // Загружаем полный контекст пользователя с информацией о компаниях, ролях и функциях
      // Токен уже сохранен, поэтому интерцептор axios сможет его использовать
      let userContext = null;
      try {
        const userId = result.user.user_id;
        console.log('📦 [authenticateWithBotTokenThunk] Загружаем полный контекст пользователя для userId:', userId);
        const contextResponse = await axiosInstance.get(`/v1/users/${userId}/context`);
        userContext = contextResponse.data;
        console.log('✅ [authenticateWithBotTokenThunk] Полный контекст пользователя загружен:', {
          groupsCount: userContext?.length || 0,
          firstGroup: userContext?.[0] ? {
            title: userContext[0].title,
            hasCompany: !!userContext[0].company,
            hasRole: !!userContext[0].company_role,
            featuresCount: userContext[0].features?.length || 0,
            company: userContext[0].company,
            company_role: userContext[0].company_role,
            features: userContext[0].features,
            fullGroupData: JSON.stringify(userContext[0], null, 2),
          } : null,
        });
      } catch (contextError: any) {
        console.error('❌ [authenticateWithBotTokenThunk] Ошибка при загрузке контекста пользователя:', contextError);
        // Продолжаем с базовыми данными групп
      }
      
      // Преобразуем данные пользователя для сохранения
      let photoUrl = '';
      if (result.user.photo_url) {
        const API_BASE_URL = 'https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net/api';
        photoUrl = `${API_BASE_URL}/v1/users/${result.user.user_id}/photo`;
      }
      
      // Используем полный контекст пользователя, если он загружен
      let mappedGroups;
      if (userContext && userContext.length > 0) {
        mappedGroups = userContext.map((group: any) => ({
          id: (group.group_id || group.chat_id || group.id).toString(),
          group_id: group.group_id || group.chat_id,
          group_type: (group.group_type || 'none') as Role,
          name: group.title || '',
          company: group.company,
          company_role: group.company_role,
          features: group.features || [],
        }));
      } else {
        mappedGroups = (result.groups || []).map((group: any) => ({
          id: group.group_id.toString(),
          group_type: (group.group_type || 'none') as Role,
          name: group.title || '',
        }));
      }
      
      const user: User = {
        id: result.user.user_id.toString(),
        firstName: result.user.first_name || '',
        lastName: result.user.last_name || '',
        username: result.user.username || '',
        photoUrl: photoUrl,
        groups: mappedGroups,
      };
      
      // Сохраняем аккаунт
      const accounts = await saveAccount(user, result.access_token, result.refresh_token);
      
      // Возвращаем результат с контекстом и информацией об аккаунтах
      return {
        ...result,
        userContext: userContext,
        user: user,
        accounts: accounts,
      };
    } catch (error: any) {
      console.error('❌ [authenticateWithBotTokenThunk] Ошибка авторизации:', error);
      return rejectWithValue(error.message || 'Ошибка авторизации через токен бота');
    }
  }
);

// Thunk для переключения между аккаунтами
export const switchAccountThunk = createAsyncThunk(
  'auth/switchAccount',
  async (userId: string, { rejectWithValue, dispatch }: { rejectWithValue: (value: string) => any; dispatch: any }) => {
    try {
      console.log('🔄 [switchAccountThunk] Переключение на аккаунт:', userId);
      const accounts = await loadAccounts();
      const account = accounts[userId];
      
      if (!account) {
        return rejectWithValue('Аккаунт не найден');
      }
      
      // Устанавливаем токены для axios интерцептора
      await AsyncStorage.setItem('access_token', account.accessToken);
      await AsyncStorage.setItem('refresh_token', account.refreshToken);
      await AsyncStorage.setItem('current_account_id', userId);
      
      // Сначала возвращаем сохраненные данные для мгновенного переключения
      const immediateResult = {
        user: account.user,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        accounts,
        currentAccountId: userId,
      };
      
      // Обновляем данные в фоне (не блокируем переключение)
      (async () => {
        try {
          console.log('🔄 [switchAccountThunk] Обновление данных в фоне для userId:', userId);
          
          // Проверяем, что токен соответствует userId
          const tokenUserId = getUserIdFromToken(account.accessToken);
          if (tokenUserId !== parseInt(userId, 10)) {
            console.warn(`⚠️ [switchAccountThunk] Токен не соответствует userId: токен=${tokenUserId}, запрос=${userId}. Пропускаем обновление.`);
            return;
          }
          
          // Убеждаемся, что токен установлен в AsyncStorage перед запросами
          // Явно устанавливаем заголовок Authorization с правильным токеном
          const userProfile = await axiosInstance.get(`/v1/users/${userId}/profile`, {
            headers: {
              Authorization: `Bearer ${account.accessToken}`
            }
          });
          const userContext = await axiosInstance.get(`/v1/users/${userId}/context`, {
            headers: {
              Authorization: `Bearer ${account.accessToken}`
            }
          });
          
          let photoUrl = '';
          // Устанавливаем photoUrl только если есть photo_url в ответе
          // Если фото не существует (404), компонент Image обработает это через onError
          if (userProfile.data.photo_url) {
            const API_BASE_URL = 'https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net/api';
            photoUrl = `${API_BASE_URL}/v1/users/${userId}/photo`;
          }
          
          const user: User = {
            id: (userProfile.data.id || userProfile.data.user_id || userId).toString(),
            firstName: userProfile.data.first_name || '',
            lastName: userProfile.data.last_name || '',
            username: userProfile.data.username || '',
            photoUrl: photoUrl,
            groups: (userContext.data || []).map((group: any) => ({
              id: (group.group_id || group.chat_id || group.id)?.toString() || '',
              group_id: group.group_id || group.chat_id,
              group_type: (group.group_type || 'none') as Role,
              name: group.title || group.chat_title || '',
              company: group.company,
              company_role: group.company_role,
              features: group.features || [],
            })),
          };
          
          // Обновляем аккаунт с новыми данными
          const updatedAccounts = await loadAccounts();
          updatedAccounts[userId] = {
            ...updatedAccounts[userId],
            user,
          };
          await AsyncStorage.setItem('accounts', JSON.stringify(updatedAccounts));
          
          // Обновляем состояние через dispatch (но не блокируем текущее переключение)
          // Используем setTimeout чтобы не блокировать основной поток
          setTimeout(() => {
            dispatch({
              type: 'auth/updateAccountData',
              payload: {
                userId,
                user,
                accounts: updatedAccounts,
              },
            });
          }, 0);
          
          console.log('✅ [switchAccountThunk] Данные обновлены в фоне');
        } catch (apiError: any) {
          console.error('❌ [switchAccountThunk] Ошибка обновления данных в фоне:', apiError);
          // Игнорируем ошибку, используем сохраненные данные
        }
      })();
      
      return immediateResult;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка переключения аккаунта');
    }
  }
);

// Thunk для удаления аккаунта
export const removeAccountThunk = createAsyncThunk(
  'auth/removeAccount',
  async (userId: string, { rejectWithValue }: { rejectWithValue: (value: string) => any }) => {
    try {
      console.log('🗑️ [removeAccountThunk] Удаление аккаунта:', userId);
      const accounts = await loadAccounts();
      
      if (!accounts[userId]) {
        return rejectWithValue('Аккаунт не найден');
      }
      
      // Удаляем аккаунт
      delete accounts[userId];
      await AsyncStorage.setItem('accounts', JSON.stringify(accounts));
      
      // Если удалили текущий аккаунт, переключаемся на другой или выходим
      const currentAccountId = await AsyncStorage.getItem('current_account_id');
      if (currentAccountId === userId) {
        const remainingAccountIds = Object.keys(accounts);
        if (remainingAccountIds.length > 0) {
          // Переключаемся на первый доступный аккаунт
          await AsyncStorage.setItem('current_account_id', remainingAccountIds[0]);
          return {
            accounts,
            shouldSwitch: true,
            switchToUserId: remainingAccountIds[0],
          };
        } else {
          // Нет аккаунтов, выходим
          await AsyncStorage.removeItem('current_account_id');
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('refresh_token');
          return {
            accounts,
            shouldSwitch: false,
            shouldLogout: true,
          };
        }
      }
      
      return { accounts };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка удаления аккаунта');
    }
  }
);

// Thunk для восстановления сессии из AsyncStorage
export const restoreSessionThunk = createAsyncThunk(
  'auth/restoreSession',
  async (_: void, { rejectWithValue }: { rejectWithValue: (value: string) => any }) => {
    try {
      console.log('🔄 [restoreSessionThunk] Проверяем сохраненные аккаунты...');
      
      // Загружаем все аккаунты
      const accounts = await loadAccounts();
      const currentAccountId = await AsyncStorage.getItem('current_account_id');
      
      // Если есть сохраненные аккаунты, используем их
      if (Object.keys(accounts).length > 0 && currentAccountId && accounts[currentAccountId]) {
        const account = accounts[currentAccountId];
        console.log('✅ [restoreSessionThunk] Найден сохраненный аккаунт:', currentAccountId);
        
        // Устанавливаем токены для axios интерцептора
        await AsyncStorage.setItem('access_token', account.accessToken);
        await AsyncStorage.setItem('refresh_token', account.refreshToken);
        
        // Обновляем данные пользователя через API
        try {
          const userId = account.user.id;
          const userProfile = await axiosInstance.get(`/v1/users/${userId}/profile`);
          const userContext = await axiosInstance.get(`/v1/users/${userId}/context`);
          
          let photoUrl = '';
          if (userProfile.data.photo_url) {
            const API_BASE_URL = 'https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net/api';
            photoUrl = `${API_BASE_URL}/v1/users/${userId}/photo`;
          }
          
          const user: User = {
            id: (userProfile.data.id || userProfile.data.user_id || userId).toString(),
            firstName: userProfile.data.first_name || '',
            lastName: userProfile.data.last_name || '',
            username: userProfile.data.username || '',
            photoUrl: photoUrl,
            groups: (userContext.data || []).map((group: any) => ({
              id: (group.group_id || group.chat_id || group.id)?.toString() || '',
              group_id: group.group_id || group.chat_id,
              group_type: (group.group_type || 'none') as Role,
              name: group.title || group.chat_title || '',
              company: group.company,
              company_role: group.company_role,
              features: group.features || [],
            })),
          };
          
          // Обновляем аккаунт с новыми данными
          accounts[currentAccountId] = {
            ...account,
            user,
          };
          await AsyncStorage.setItem('accounts', JSON.stringify(accounts));
          
          return {
            user,
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
            accounts,
            currentAccountId,
          };
        } catch (apiError: any) {
          console.error('❌ [restoreSessionThunk] Ошибка обновления данных, используем сохраненные:', apiError);
          // Используем сохраненные данные
          return {
            user: account.user,
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
            accounts,
            currentAccountId,
          };
        }
      }
      
      // Fallback на старую логику для обратной совместимости
      console.log('⚠️ [restoreSessionThunk] Аккаунты не найдены, проверяем старые токены...');
      const accessToken = await AsyncStorage.getItem('access_token');
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      
      if (!accessToken) {
        console.log('⚠️ [restoreSessionThunk] Токен не найден в AsyncStorage');
        return { user: null, accessToken: null, refreshToken: null, accounts: {}, currentAccountId: null };
      }
      
      console.log('✅ [restoreSessionThunk] Токен найден, проверяем валидность...');

      // Проверяем валидность токена, получая данные пользователя
      const userId = getUserIdFromToken(accessToken);
      if (!userId) {
        console.log('❌ [restoreSessionThunk] Не удалось извлечь user_id из токена');
        // Токен невалидный, очищаем
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        return { user: null, accessToken: null, refreshToken: null, accounts: {}, currentAccountId: null };
      }

      console.log(`🔍 [restoreSessionThunk] User ID из токена: ${userId}, получаем данные пользователя...`);
      
      // Получаем данные пользователя через API используя токен
      try {
        const userProfile = await axiosInstance.get(`/v1/users/${userId}/profile`);
        const userContext = await axiosInstance.get(`/v1/users/${userId}/context`);
        console.log('✅ [restoreSessionThunk] Данные пользователя получены:', {
          hasProfile: !!userProfile.data,
          hasContext: !!userContext.data,
          contextLength: userContext.data?.length || 0,
          firstGroupContext: userContext.data?.[0] ? {
            title: userContext.data[0].title,
            hasCompany: !!userContext.data[0].company,
            hasRole: !!userContext.data[0].company_role,
            featuresCount: userContext.data[0].features?.length || 0,
            company: userContext.data[0].company,
            company_role: userContext.data[0].company_role,
            features: userContext.data[0].features,
          } : null,
        });
        
        // Преобразуем данные пользователя
        // Преобразуем photoUrl в API endpoint для получения фото
        let photoUrl = '';
        if (userProfile.data.photo_url) {
          // Используем API endpoint для получения фото пользователя
          const API_BASE_URL = 'https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net/api';
          photoUrl = `${API_BASE_URL}/v1/users/${userId}/photo`;
        }
        
        // Используем полный контекст с компаниями, ролями и функциями
        const user: User = {
          id: (userProfile.data.id || userProfile.data.user_id || userId).toString(),
          firstName: userProfile.data.first_name || '',
          lastName: userProfile.data.last_name || '',
          username: userProfile.data.username || '',
          photoUrl: photoUrl,
          groups: (userContext.data || []).map((group: any) => ({
            id: (group.group_id || group.chat_id || group.id)?.toString() || '',
            group_id: group.group_id || group.chat_id,
            group_type: (group.group_type || 'none') as Role,
            name: group.title || group.chat_title || '',
            company: group.company,
            company_role: group.company_role,
            features: group.features || [],
          })),
        };
        
        console.log('✅ [restoreSessionThunk] Группы с контекстом:', {
          groupsCount: user.groups.length,
          firstGroup: user.groups[0] ? {
            name: user.groups[0].name,
            hasCompany: !!user.groups[0].company,
            hasRole: !!user.groups[0].company_role,
            featuresCount: user.groups[0].features?.length || 0,
          } : null,
        });
      
        // Мигрируем старый аккаунт в новую структуру
        const accounts = await loadAccounts();
        const migratedAccount: Account = {
          userId: user.id,
          user,
          accessToken: accessToken!,
          refreshToken: refreshToken || '',
          addedAt: Date.now(),
        };
        accounts[user.id] = migratedAccount;
        await AsyncStorage.setItem('accounts', JSON.stringify(accounts));
        await AsyncStorage.setItem('current_account_id', user.id);
        
        return { user, accessToken, refreshToken, accounts, currentAccountId: user.id };
      } catch (apiError: any) {
        console.error('❌ [Auth] Ошибка получения данных пользователя:', apiError);
        // Если токен невалидный, очищаем его
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        return { user: null, accessToken: null, refreshToken: null, accounts: {}, currentAccountId: null };
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка восстановления сессии');
    }
  }
);

// Thunk для выхода (выход только из текущего аккаунта, если есть другие - переключаемся)
export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { getState }: { getState: () => any }) => {
    const state = getState() as { auth: AuthState };
    const accounts = state.auth.accounts;
    const currentAccountId = state.auth.currentAccountId;
    
    // Если есть другие аккаунты, удаляем текущий и переключаемся
    if (Object.keys(accounts).length > 1 && currentAccountId) {
      const remainingAccounts = { ...accounts };
      delete remainingAccounts[currentAccountId];
      
      const remainingAccountIds = Object.keys(remainingAccounts);
      if (remainingAccountIds.length > 0) {
        // Переключаемся на первый доступный аккаунт
        const nextAccountId = remainingAccountIds[0];
        const nextAccount = remainingAccounts[nextAccountId];
        await AsyncStorage.setItem('accounts', JSON.stringify(remainingAccounts));
        await AsyncStorage.setItem('current_account_id', nextAccountId);
        await AsyncStorage.setItem('access_token', nextAccount.accessToken);
        await AsyncStorage.setItem('refresh_token', nextAccount.refreshToken);
        return { shouldSwitch: true, switchToUserId: nextAccountId, accounts: remainingAccounts };
      }
    }
    
    // Полный выход - удаляем все
    await AsyncStorage.removeItem('accounts');
    await AsyncStorage.removeItem('current_account_id');
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    return { shouldSwitch: false, shouldLogout: true, accounts: {} };
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state: AuthState, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearError: (state: AuthState) => {
      state.error = null;
    },
    updateAccountData: (state: AuthState, action: PayloadAction<{ userId: string; user: User; accounts: Record<string, Account> }>) => {
      // Обновляем данные аккаунта, если это текущий аккаунт
      if (state.currentAccountId === action.payload.userId) {
        state.user = action.payload.user;
      }
      state.accounts = action.payload.accounts;
    },
  },
  extraReducers: (builder: any) => {
    // authenticateWithTelegramThunk
    builder
      .addCase(authenticateWithTelegramThunk.pending, (state: AuthState) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(authenticateWithTelegramThunk.fulfilled, (state: AuthState, action: any) => {
        console.log('✅ [authSlice] authenticateWithTelegramThunk.fulfilled, обновляем состояние');
        console.log('📦 [authSlice] Полный payload от сервера:', JSON.stringify(action.payload, null, 2));
        console.log('👤 [authSlice] Данные пользователя от сервера:', JSON.stringify(action.payload.user, null, 2));
        console.log('👥 [authSlice] Группы от сервера:', JSON.stringify(action.payload.groups, null, 2));
        state.isLoading = false;
        state.isAuthenticated = true;
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        // Преобразуем данные пользователя из ответа API
        // Преобразуем photoUrl в API endpoint для получения фото
        let photoUrl = '';
        if (action.payload.user.photo_url) {
          // Используем API endpoint для получения фото пользователя
          const API_BASE_URL = 'https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net/api';
          photoUrl = `${API_BASE_URL}/v1/users/${action.payload.user.user_id}/photo`;
        }
        
        state.user = {
          id: action.payload.user.user_id.toString(),
          firstName: action.payload.user.first_name || '',
          lastName: action.payload.user.last_name || '',
          username: action.payload.user.username || '',
          photoUrl: photoUrl,
          groups: action.payload.groups.map((group: any) => ({
            id: group.group_id.toString(),
            group_type: (group.group_type || 'none') as Role,
            name: group.title || '',
          })),
        };
        console.log('✅ [authSlice] Состояние обновлено:', {
          isAuthenticated: state.isAuthenticated,
          hasUser: !!state.user,
          userId: state.user?.id,
          userFirstName: state.user?.firstName,
          userLastName: state.user?.lastName,
          userUsername: state.user?.username,
          userPhotoUrl: state.user?.photoUrl,
          photoUrlLength: state.user?.photoUrl?.length || 0,
          groupsCount: state.user?.groups?.length || 0,
        });
        console.log('🖼️ [authSlice] Полный photoUrl для отладки:', state.user?.photoUrl);
      })
      .addCase(authenticateWithTelegramThunk.rejected, (state: AuthState, action: any) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // authenticateWithBotTokenThunk
    builder
      .addCase(authenticateWithBotTokenThunk.pending, (state: AuthState) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(authenticateWithBotTokenThunk.fulfilled, (state: AuthState, action: any) => {
        console.log('✅ [authSlice] authenticateWithBotTokenThunk.fulfilled, обновляем состояние');
        state.isLoading = false;
        state.isAuthenticated = true;
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        
        // Используем данные пользователя из payload (уже обработанные в thunk)
        state.user = action.payload.user;
        state.accounts = action.payload.accounts || {};
        state.currentAccountId = action.payload.user.id;
        
        console.log('✅ [authSlice] Состояние обновлено:', {
          isAuthenticated: state.isAuthenticated,
          hasUser: !!state.user,
          userId: state.user?.id,
          accountsCount: Object.keys(state.accounts).length,
          currentAccountId: state.currentAccountId,
        });
      })
      .addCase(authenticateWithBotTokenThunk.rejected, (state: AuthState, action: any) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // restoreSessionThunk
    builder
      .addCase(restoreSessionThunk.pending, (state: AuthState) => {
        state.isLoading = true;
      })
      .addCase(restoreSessionThunk.fulfilled, (state: AuthState, action: any) => {
        state.isLoading = false;
        state.isInitialized = true;
        if (action.payload.accessToken) {
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
          state.user = action.payload.user;
          state.accounts = action.payload.accounts || {};
          state.currentAccountId = action.payload.currentAccountId;
          state.isAuthenticated = true;
        } else {
          state.isAuthenticated = false;
          state.user = null;
          state.accounts = {};
          state.currentAccountId = null;
        }
      })
      .addCase(restoreSessionThunk.rejected, (state: AuthState, action: any) => {
        console.error('❌ [authSlice] restoreSessionThunk.rejected:', action.payload || action.error);
        state.isLoading = false;
        state.isInitialized = true;
        state.isAuthenticated = false;
      });

    // switchAccountThunk
    builder
      .addCase(switchAccountThunk.pending, (state: AuthState) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(switchAccountThunk.fulfilled, (state: AuthState, action: any) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.accounts = action.payload.accounts;
        state.currentAccountId = action.payload.currentAccountId;
        state.isAuthenticated = true;
      })
      .addCase(switchAccountThunk.rejected, (state: AuthState, action: any) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // removeAccountThunk
    builder
      .addCase(removeAccountThunk.pending, (state: AuthState) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeAccountThunk.fulfilled, (state: AuthState, action: any) => {
        state.isLoading = false;
        state.accounts = action.payload.accounts;
        
        if (action.payload.shouldSwitch && action.payload.switchToUserId) {
          // Переключаемся на другой аккаунт
          const account = action.payload.accounts[action.payload.switchToUserId];
          if (account) {
            state.user = account.user;
            state.accessToken = account.accessToken;
            state.refreshToken = account.refreshToken;
            state.currentAccountId = action.payload.switchToUserId;
            state.isAuthenticated = true;
          }
        } else if (action.payload.shouldLogout) {
          // Полный выход
          state.user = null;
          state.accessToken = null;
          state.refreshToken = null;
          state.currentAccountId = null;
          state.isAuthenticated = false;
        }
      })
      .addCase(removeAccountThunk.rejected, (state: AuthState, action: any) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // logoutThunk
    builder
      .addCase(logoutThunk.fulfilled, (state: AuthState, action: any) => {
        if (action.payload.shouldSwitch && action.payload.switchToUserId) {
          // Переключаемся на другой аккаунт
          const account = action.payload.accounts[action.payload.switchToUserId];
          if (account) {
            state.user = account.user;
            state.accessToken = account.accessToken;
            state.refreshToken = account.refreshToken;
            state.currentAccountId = action.payload.switchToUserId;
            state.accounts = action.payload.accounts;
            state.isAuthenticated = true;
          }
        } else {
          // Полный выход
          state.user = null;
          state.accessToken = null;
          state.refreshToken = null;
          state.accounts = {};
          state.currentAccountId = null;
          state.isAuthenticated = false;
        }
        state.error = null;
      });
  },
});

export const { setUser, clearError, updateAccountData } = authSlice.actions;
export default authSlice.reducer;

