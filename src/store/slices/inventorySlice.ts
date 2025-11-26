import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  getChatInventory,
  getChefChats,
  getInventoryTemplate,
  saveItemNotes as saveItemNotesApi,
  getItemHistory as getItemHistoryApi,
} from '../../services/inventoryApi';
import type {
  InventoryData,
  ChatItem,
  InventoryState,
  Inventory,
  InventoryHistoryItem,
} from '../../types/inventory';

const initialState: InventoryState = {
  items: [],
  selectedChatId: null,
  selectedChat: null,
  isLoading: false,
  error: null,
  currentInventory: null,
  history: {
    records: {},
    isLoading: false,
    error: null,
    lastUpdate: null,
  },
};

// Thunk для загрузки списка чатов инвентаризации
export const fetchInventoryChats = createAsyncThunk<
  ChatItem[],
  { userId: number | string; role?: string },
  { rejectValue: string }
>(
  'inventory/fetchChats',
  async ({ userId, role }, { rejectWithValue }) => {
    try {
      console.log('[inventorySlice] 🔄 Загружаем список чатов:', { userId, role });
      // Передаем role как group_type в API
      const response = await getChefChats(userId, role);
      console.log('[inventorySlice] ✅ Список чатов получен:', response.length, 'чатов');
      return response;
    } catch (error: any) {
      console.error('[inventorySlice] ❌ Ошибка загрузки списка чатов:', error);
      const message = error.response?.data?.detail || error.message || 'Не удалось загрузить список чатов';
      return rejectWithValue(message);
    }
  }
);

// Thunk для загрузки инвентаря конкретного чата
export const fetchChatInventory = createAsyncThunk<
  InventoryData & { chatId: string },
  string,
  { rejectValue: string }
>(
  'inventory/fetchChatInventory',
  async (chatId: string, { rejectWithValue }) => {
    try {
      console.log('[inventorySlice] 🔄 Загружаем инвентарь для chatId:', chatId);
      const inventoryData = await getChatInventory(chatId);
      console.log('[inventorySlice] ✅ Инвентарь получен:', {
        hasInventory: !!inventoryData.inventory,
        categoriesCount: Object.keys(inventoryData.inventory || {}).length,
        chatTitle: inventoryData.chat_title,
        progress: inventoryData.metadata?.progress,
      });
      if (!inventoryData) {
        return rejectWithValue('Не получены данные инвентаря от API');
      }
      return {
        chatId,
        ...inventoryData,
      };
    } catch (error: any) {
      console.error('[inventorySlice] ❌ Ошибка загрузки инвентаря:', error);
      const message = error.response?.data?.detail || error.message || 'Не удалось загрузить инвентарь';
      return rejectWithValue(message);
    }
  }
);

// Thunk для загрузки шаблона инвентаря
export const fetchInventoryTemplate = createAsyncThunk<
  Inventory,
  void,
  { rejectValue: string }
>(
  'inventory/fetchTemplate',
  async (_, { rejectWithValue }) => {
    try {
      const template = await getInventoryTemplate();
      return template as Inventory;
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Не удалось загрузить шаблон';
      return rejectWithValue(message);
    }
  }
);

// Thunk для сохранения заметок к товару
export const saveItemNotes = createAsyncThunk<
  { success: boolean; message: string },
  { chatId: string; category: string; itemName: string; rawNotes?: string; semifinishedNotes?: string },
  { rejectValue: string }
>(
  'inventory/saveItemNotes',
  async ({ chatId, category, itemName, rawNotes, semifinishedNotes }, { rejectWithValue }) => {
    try {
      console.log('[inventorySlice] 🔄 Сохраняем заметки:', { chatId, category, itemName, rawNotes, semifinishedNotes });
      const response = await saveItemNotesApi(chatId, category, itemName, rawNotes, semifinishedNotes);
      console.log('[inventorySlice] ✅ Заметки сохранены:', response);
      return { success: true, message: response.message || 'Заметки сохранены' };
    } catch (error: any) {
      console.error('[inventorySlice] ❌ Ошибка сохранения заметок:', error);
      const message = error.response?.data?.detail || error.message || 'Не удалось сохранить заметки';
      return rejectWithValue(message);
    }
  }
);

// Thunk для загрузки истории товара
export const fetchItemHistory = createAsyncThunk<
  { itemId: string; history: InventoryHistoryItem[] },
  { chatId: string; itemId: string; category: string; itemName: string; background?: boolean },
  { rejectValue: string }
>(
  'inventory/fetchItemHistory',
  async ({ chatId, category, itemName, background }, { rejectWithValue }) => {
    try {
      if (!background) {
        console.log('[inventorySlice] 🔄 Загружаем историю товара:', { chatId, category, itemName });
      }
      const response = await getItemHistoryApi(chatId, category, itemName);
      if (!Array.isArray(response)) {
        throw new Error('История должна быть массивом');
      }
      // Используем itemName как itemId для ключа
      const itemId = itemName;
      if (!background) {
        console.log('[inventorySlice] ✅ История загружена:', { itemId, recordsCount: response.length });
      }
      return {
        itemId,
        history: response as InventoryHistoryItem[],
      };
    } catch (error: any) {
      console.error('[inventorySlice] ❌ Ошибка загрузки истории:', error);
      const message = error.response?.data?.detail || error.message || 'Не удалось загрузить историю товара';
      return rejectWithValue(message);
    }
  }
);

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    // Выбор чата
    selectChat: (state, action: PayloadAction<string>) => {
      const chatId = action.payload;
      console.log('[inventorySlice] 🎯 Выбираем чат:', {
        chatId,
        itemsCount: state.items.length,
        previousSelectedChatId: state.selectedChatId,
        foundChat: state.items.find((chat) => chat.chat_id === chatId) ? 'найден' : 'не найден',
      });
      state.selectedChatId = chatId;
      const foundChat = state.items.find((chat) => chat.chat_id === chatId) || null;
      state.selectedChat = foundChat;
      if (foundChat) {
        console.log('[inventorySlice] ✅ Чат выбран:', {
          chat_id: foundChat.chat_id,
          title: foundChat.title,
        });
      } else {
        console.warn('[inventorySlice] ⚠️ Чат не найден в списке items, но выбран:', chatId);
      }
    },
    // Очистка выбранного чата
    clearSelectedChat: (state) => {
      state.selectedChatId = null;
      state.selectedChat = null;
      state.currentInventory = null;
    },
    // Очистка ошибки
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchInventoryChats
    builder
      .addCase(fetchInventoryChats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInventoryChats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.map((chat) => ({
          ...chat,
          chat_title: chat.title || chat.chat_id || 'Без названия',
        }));
      })
      .addCase(fetchInventoryChats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Не удалось загрузить список чатов';
      });

    // fetchChatInventory
    builder
      .addCase(fetchChatInventory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchChatInventory.fulfilled, (state, action) => {
        const { chatId, inventory, metadata, chat_title, admins } = action.payload;
        state.isLoading = false;
        state.currentInventory = {
          inventory,
          metadata,
          chat_title,
          admins,
        };

        // Обновляем или добавляем чат в список
        const chatIndex = state.items.findIndex((chat) => chat.chat_id === chatId);
        if (chatIndex !== -1) {
          state.items[chatIndex] = {
            ...state.items[chatIndex],
            metadata,
            admins,
          };
        }

        // Обновляем selectedChat если это текущий чат
        if (state.selectedChatId === chatId) {
          state.selectedChat = state.items[chatIndex] || {
            id: 0,
            chat_id: chatId,
            title: chat_title,
            group_type: 'chef',
            created_at: new Date().toISOString(),
            admins,
            metadata,
          };
        }
      })
      .addCase(fetchChatInventory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Не удалось загрузить инвентарь чата';
      });

    // fetchInventoryTemplate
    builder
      .addCase(fetchInventoryTemplate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInventoryTemplate.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(fetchInventoryTemplate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Не удалось загрузить шаблон';
      });

    // saveItemNotes
    builder
      .addCase(saveItemNotes.pending, (state) => {
        // Можно добавить индикатор загрузки для заметок
      })
      .addCase(saveItemNotes.fulfilled, (state, action) => {
        console.log('[inventorySlice] ✅ Заметки сохранены успешно:', action.payload);
      })
      .addCase(saveItemNotes.rejected, (state, action) => {
        console.error('[inventorySlice] ❌ Ошибка сохранения заметок:', action.payload);
        state.error = action.payload || 'Не удалось сохранить заметки';
      });

    // fetchItemHistory
    builder
      .addCase(fetchItemHistory.pending, (state, action) => {
        if (!action.meta.arg.background) {
          state.history.isLoading = true;
        }
        state.history.error = null;
      })
      .addCase(fetchItemHistory.fulfilled, (state, action) => {
        const { itemId, history } = action.payload;
        console.log('[inventorySlice] 💾 Сохраняем историю в Redux:', { 
          itemId, 
          recordsCount: history.length,
          firstRecord: history[0] ? {
            id: history[0].id,
            hasAuthor: !!history[0].author,
            authorName: history[0].author?.first_name,
            authorPhoto: history[0].author?.photo_url
          } : null
        });
        state.history.records[itemId] = history;
        state.history.isLoading = false;
        state.history.lastUpdate = new Date().toISOString();
        state.history.error = null;
      })
      .addCase(fetchItemHistory.rejected, (state, action) => {
        state.history.isLoading = false;
        state.history.error = action.payload || 'Не удалось загрузить историю товара';
      });
  },
});

export const { selectChat, clearSelectedChat, clearError } = inventorySlice.actions;

// Селектор для получения истории конкретного товара
export const selectHistoryForItem = (state: { inventory: InventoryState }, itemId: string) => {
  return state.inventory.history.records[itemId] || [];
};

// Селектор для проверки загрузки истории
export const selectIsHistoryLoading = (state: { inventory: InventoryState }) => {
  return state.inventory.history.isLoading;
};

export default inventorySlice.reducer;

