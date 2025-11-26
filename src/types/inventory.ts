// Типы для работы с инвентаризацией в нативном приложении

// Основной тип данных инвентаря чата
export interface InventoryData {
  inventory: Inventory; // Инвентарь (структура ниже)
  metadata: InventoryMetadata; // Метаданные инвентаря
  chat_title: string; // Название чата
  admins: Admin[]; // Список админов
}

// Пэйлоад для обновления инвентаря (частичный или полный)
export interface InventoryUpdatePayload {
  inventory?: Inventory; // Обновлённый инвентарь
  metadata?: InventoryMetadata; // Обновлённые метаданные
  history?: InventoryHistoryItem; // Запись для истории изменений
}

export interface ChatItem {
  id: number;
  chat_id: string;
  title: string;
  group_type: string;
  created_at: string;
  admins: Admin[];
  metadata: InventoryMetadata | null;
  slot_config?: any;
  access_settings?: any;
}

export interface InventoryHistoryItem {
  id: number;
  group_id: number;
  category: string;
  item_name: string;
  action: string;
  type: 'raw' | 'semifinished';
  old_quantity: number | null;
  new_quantity: number | null;
  timestamp: string;
  author: {
    user_id: number;
    first_name: string | null;
    photo_url: string | null;
  } | null;
}

export interface InventoryItemDetails {
  quantity: number;
  filled: boolean;
  isOutOfStock?: boolean;
  notes?: string;
}

export interface InventoryItem {
  name: string;
  unit?: string;
  itemType: 'raw' | 'semifinished' | 'both';
  raw?: InventoryItemDetails;
  semifinished?: InventoryItemDetails;
  has_semifinished?: boolean;
  lastUpdated?: string; // Timestamp последнего обновления для предотвращения race conditions
  qrData?: string; // Полный QR код (например: "0104600721015725215.)"5N*93MKhL")
  gtin?: string; // GTIN (Global Trade Item Number) - часть после "01" (14 цифр)
  barcode?: string; // Штрих-код (EAN-13, EAN-8, UPC-A, UPC-E и т.д.) - используется как fallback, если QR кода нет
  barcodeFormat?: string; // Формат штрих-кода (EAN_13, EAN_8, UPC_A, UPC_E, CODE_128 и т.д.)
  photoUrl?: string; // URL фото товара
}

export type Inventory = Record<string, Record<string, InventoryItem>>;

export interface Admin {
  id: number;
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
}

export interface InventoryMetadata {
  lastUpdated: string;
  progress: number;
  chat_id: string;
  start_time?: string; // Время начала инвентаризации (когда прогресс стал > 0)
  lastTemplateUpdate?: {
    timestamp: string;
    changes: {
      added: string[];
      removed: string[];
      added_count: number;
      removed_count: number;
    };
    viewed: boolean;
    viewedAt?: string;
  };
}

// Тип для состояния истории в Redux
export interface HistoryState {
  records: Record<string, InventoryHistoryItem[]>;
  isLoading: boolean;
  error: string | null;
  lastUpdate: string | null;
}

// Тип для состояния инвентаризации в Redux
export interface InventoryState {
  items: ChatItem[];
  selectedChatId: string | null;
  selectedChat: ChatItem | null;
  isLoading: boolean;
  error: string | null;
  currentInventory: InventoryData | null;
  history: HistoryState;
}

