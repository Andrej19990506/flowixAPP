# 📦 Inventory Feature

Фича инвентаризации для нативного приложения FlowixApp.

## 📁 Структура

```
Inventory/
├── components/          # Переиспользуемые компоненты
│   ├── EmptyInventoryState.tsx
│   └── index.ts
├── screens/            # Экраны
│   ├── InventoryScreen.tsx
│   └── index.ts
├── hooks/              # Custom hooks
│   ├── useInventoryFooter.ts
│   └── index.ts
├── store/              # Redux slice (будущее)
├── services/           # API слой (будущее)
└── index.ts            # Экспорты фичи
```

## 🎯 Компоненты

### EmptyInventoryState

Компонент пустого состояния инвентаря.

**Использование:**
```tsx
import { EmptyInventoryState } from '@features/Inventory';

<EmptyInventoryState
  title="Инвентарь пуст"
  description="Начните добавлять товары"
  icon="inventory-2"
  onAction={() => console.log('Add item')}
  actionLabel="Добавить товар"
/>
```

**Props:**
- `title?: string` - Заголовок (по умолчанию: "Инвентарь пуст")
- `description?: string` - Описание
- `icon?: string` - Иконка MaterialIcons (по умолчанию: "inventory-2")
- `onAction?: () => void` - Обработчик действия
- `actionLabel?: string` - Текст кнопки действия

### InventoryScreen

Основной экран инвентаризации.

**Использование:**
```tsx
import { InventoryScreen } from '@features/Inventory';

<InventoryScreen navigation={navigation} />
```

## 🎨 Стили

Компоненты используют тему из `ThemeContext`:
- Поддержка светлой и темной темы
- Адаптивные цвета
- Брендовый цвет: `#FF6B35`

### useInventoryFooter

Хук для управления кнопками футера инвентаризации.

**Использование:**
```tsx
import { useInventoryFooter } from '@features/Inventory/hooks';

const { buttons } = useInventoryFooter({
  onSearchPress: () => console.log('Search'),
  onQrScanPress: () => console.log('QR Scan'),
  isSearchActive: false,
  isQrScannerOpen: false,
});
```

**Возвращает:**
- `buttons: FooterButton[]` - Массив кнопок для футера
- `isSearchOpen: boolean` - Состояние поиска
- `setIsSearchOpen: (value: boolean) => void` - Установка состояния поиска

## 📝 TODO

- [ ] Добавить Redux slice для состояния инвентаря
- [ ] Реализовать загрузку данных из API
- [ ] Создать компоненты списка категорий и товаров
- [ ] Реализовать поиск
- [ ] Добавить QR-сканер
- [ ] Добавить WebSocket синхронизацию

## 🔗 Связанные документы

- [INVENTORY_ANALYSIS.md](../../../../INVENTORY_ANALYSIS.md) - Анализ функционала веб-версии
- [DYNAMIC_INVENTORY_ARCHITECTURE.md](../../../../DYNAMIC_INVENTORY_ARCHITECTURE.md) - Архитектура динамической системы

