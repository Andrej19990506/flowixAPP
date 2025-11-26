// API-слой для работы с инвентарём через backend (axiosInstance).
// Здесь все функции для загрузки, обновления, удаления, истории, генерации отчётов и сброса инвентаря.

import { axiosInstance } from './api';
import {
  InventoryData,
  InventoryUpdatePayload,
  ChatItem,
  InventoryHistoryItem,
} from '../types/inventory';

/**
 * Получить шаблон структуры инвентаря (например, для создания новых чатов)
 * @returns {Promise<Record<string, any>>} The inventory template data.
 */
export const getInventoryTemplate = async (): Promise<Record<string, any>> => {
  try {
    const response = await axiosInstance.get<Record<string, any>>('/v1/inventory/template');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Получить инвентарь для конкретного чата
 * @param chatId
 * @returns {Promise<InventoryData>}
 */
export const getChatInventory = async (chatId: string): Promise<InventoryData> => {
  if (!chatId) {
    throw new Error('chatId обязателен для получения инвентаря.');
  }
  try {
    const response = await axiosInstance.get<InventoryData>(`/v1/inventory/${chatId}`);
    if (!response.data.inventory) {
      response.data.inventory = {};
    }
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Обновить инвентарь для чата (POST)
 * @param chatId
 * @param payload
 * @returns {Promise<InventoryData>}
 */
export const updateChatInventory = async (
  chatId: string,
  payload: InventoryUpdatePayload
): Promise<InventoryData> => {
  if (!chatId) {
    throw new Error('chatId обязателен для обновления инвентаря.');
  }
  try {
    const response = await axiosInstance.post<InventoryData>(`/v1/inventory/${chatId}`, payload);
    if (!response.data.inventory) {
      response.data.inventory = {};
    }
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Обновить один товар в инвентаре (PUT)
 * @param chatId
 * @param category
 * @param itemId
 * @param item
 * @returns {Promise<InventoryData>}
 */
export const updateInventoryItem = async (
  chatId: string,
  category: string,
  itemId: string,
  item: any,
  historyData?: {
    action: string;
    itemType: 'raw' | 'semifinished';
    oldQuantity: number;
    newQuantity: number;
    authorMemberId?: number;
  }
): Promise<InventoryData> => {
  if (!chatId || !category || !itemId) {
    throw new Error('chatId, category и itemId обязательны для обновления товара.');
  }
  try {
    // Кодируем category и itemId для URL (на случай спецсимволов)
    const encodedCategory = encodeURIComponent(category);
    const encodedItemId = encodeURIComponent(itemId);
    
    // Формируем payload с историей, если она предоставлена
    const payload: any = {
      item,
      metadata: {
        lastUpdated: new Date().toISOString(),
        progress: 0,
        chat_id: chatId,
      },
    };
    
    if (historyData) {
      payload.history = {
        action: historyData.action,
        itemType: historyData.itemType,
        oldQuantity: historyData.oldQuantity,
        newQuantity: historyData.newQuantity,
        category: category,
        itemName: itemId,
        authorMemberId: historyData.authorMemberId,
      };
      console.log('[inventoryApi] 📝 Передаем данные истории в API:', payload.history);
    } else {
      console.log('[inventoryApi] ⚠️ Данные истории не предоставлены');
    }
    
    const response = await axiosInstance.put<InventoryData>(
      `/v1/inventory/${chatId}/items/${encodedCategory}/${encodedItemId}`,
      payload
    );
    if (!response.data.inventory) {
      response.data.inventory = {};
    }
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Получить историю изменений по конкретному товару
 * @param chatId
 * @param category
 * @param itemName
 * @returns {Promise<InventoryHistoryItem[]>}
 */
export const getItemHistory = async (
  chatId: string,
  category: string,
  itemName: string
): Promise<InventoryHistoryItem[]> => {
  if (!chatId || !category || !itemName) {
    throw new Error('chatId, категория и название товара обязательны для получения истории.');
  }
  const url = `/v1/inventory/history/${chatId}`;
  try {
    console.log('[inventoryApi] 🔍 Запрос истории:', { chatId, category, itemName });
    const response = await axiosInstance.get<InventoryHistoryItem[]>(url, {
      params: {
        category,
        item_name: itemName,
      },
    });
    console.log('[inventoryApi] ✅ История получена:', {
      recordsCount: response.data.length,
      firstRecord: response.data[0] ? {
        id: response.data[0].id,
        hasAuthor: !!response.data[0].author,
        authorName: response.data[0].author?.first_name,
        authorPhoto: response.data[0].author?.photo_url,
        fullAuthor: response.data[0].author,
        fullRecord: JSON.stringify(response.data[0], null, 2),
      } : null,
      allRecords: response.data.map(r => ({
        id: r.id,
        hasAuthor: !!r.author,
        author: r.author,
      })),
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Получить список "поварских" чатов пользователя
 * @param userId
 * @returns {Promise<ChatItem[]>}
 */
export const getChefChats = async (userId: number | string, groupType?: string): Promise<ChatItem[]> => {
  if (!userId) {
    throw new Error('userId обязателен для получения списка чатов.');
  }
  try {
    const params: Record<string, any> = { user_id: userId };
    if (groupType && groupType !== 'none') {
      params.group_type = groupType;
    }
    console.log('[inventoryApi] 🔄 Запрос списка чатов:', params);
    const response = await axiosInstance.get<ChatItem[]>('/v1/groups/chats', {
      params,
    });
    console.log('[inventoryApi] ✅ Получен ответ от сервера:', {
      status: response.status,
      dataLength: response.data?.length || 0,
      data: response.data,
    });
    return response.data;
  } catch (error: any) {
    console.error('[inventoryApi] ❌ Ошибка при запросе списка чатов:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
};

/**
 * Добавить новый товар в инвентарь (custom item)
 * @param chatId
 * @param category
 * @param itemName
 * @param hasSemifinshed
 * @returns {Promise<any>}
 */
export const addCustomInventoryItem = async (
  chatId: string,
  category: string,
  itemName: string,
  hasSemifinshed: boolean
): Promise<any> => {
  if (!chatId || !category || !itemName) {
    throw new Error('chatId, категория и название товара обязательны для добавления товара.');
  }
  const url = `/v1/inventory/${chatId}/items`;
  const payload = { category, item_name: itemName, has_semifinished: hasSemifinshed };
  try {
    const response = await axiosInstance.post<any>(url, payload);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Удалить товар из инвентаря
 * @param chatId
 * @param category
 * @param itemName
 * @returns {Promise<any>}
 */
export const deleteInventoryItem = async (
  chatId: string,
  category: string,
  itemName: string
): Promise<any> => {
  if (!chatId || !category || !itemName) {
    throw new Error('chatId, категория и название товара обязательны для удаления товара.');
  }
  const url = `/v1/inventory/${chatId}/items`;
  try {
    const response = await axiosInstance.delete<any>(url, {
      params: {
        category,
        item_name: itemName,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Сохранить заметки для товара
 * @param chatId
 * @param category
 * @param itemName
 * @param rawNotes
 * @param semifinishedNotes
 * @returns {Promise<any>}
 */
export const saveItemNotes = async (
  chatId: string,
  category: string,
  itemName: string,
  rawNotes?: string,
  semifinishedNotes?: string
): Promise<any> => {
  if (!chatId || !category || !itemName) {
    throw new Error('chatId, категория и название товара обязательны для сохранения заметок.');
  }
  const url = `/v1/inventory/${chatId}/items/notes`;
  try {
    const response = await axiosInstance.post<any>(url, {
      category,
      item_name: itemName,
      raw_notes: rawNotes,
      semifinished_notes: semifinishedNotes,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

