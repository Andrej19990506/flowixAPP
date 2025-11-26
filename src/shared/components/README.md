# 🧩 Shared Components

Общие переиспользуемые компоненты для всего приложения.

## 📁 Структура

```
shared/components/
├── Footer/
│   ├── Footer.tsx
│   └── index.ts
└── index.ts
```

## 🎯 Компоненты

### Footer

Универсальный футер с кнопками для разных фич.

**Использование:**
```tsx
import { Footer, type FooterButton } from '@shared/components';

const buttons: FooterButton[] = [
  {
    id: 'search',
    icon: 'search',
    label: 'Поиск',
    onPress: () => console.log('Search'),
    active: false,
  },
  {
    id: 'qr-scan',
    icon: 'qr-code-scanner',
    label: 'QR-сканер',
    onPress: () => console.log('QR Scan'),
  },
];

<Footer buttons={buttons} variant="compact" />
```

**Props:**
- `buttons: FooterButton[]` - Массив кнопок для отображения
- `variant?: 'default' | 'compact'` - Вариант отображения (по умолчанию: 'default')

**FooterButton:**
```typescript
interface FooterButton {
  id: string;              // Уникальный ID кнопки
  icon: string;            // Название иконки MaterialIcons
  label?: string;          // Текст под иконкой (только для variant="default")
  onPress: () => void;     // Обработчик нажатия
  active?: boolean;        // Активна ли кнопка
  disabled?: boolean;      // Отключена ли кнопка
  badge?: number;         // Бейдж с числом (опционально)
}
```

**Особенности:**
- ✅ Поддержка светлой и темной темы
- ✅ Адаптивные отступы (SafeArea)
- ✅ Анимации при нажатии
- ✅ Бейджи для уведомлений
- ✅ Состояния: активная, отключенная, нажатая
- ✅ Два варианта: default (с текстом) и compact (только иконки)

## 🎨 Стили

Компоненты используют тему из `ThemeContext`:
- Поддержка светлой и темной темы
- Адаптивные цвета
- Брендовый цвет: `#FF6B35` для активных состояний
- Тени и границы для визуального разделения

## 📝 Примеры использования

### Для инвентаризации

```tsx
import { useInventoryFooter } from '@features/Inventory/hooks';
import { Footer } from '@shared/components';

const { buttons } = useInventoryFooter({
  onSearchPress: handleSearch,
  onQrScanPress: handleQrScan,
});

<Footer buttons={buttons} variant="compact" />
```

### Кастомный футер

```tsx
import { Footer, type FooterButton } from '@shared/components';

const customButtons: FooterButton[] = [
  {
    id: 'home',
    icon: 'home',
    label: 'Главная',
    onPress: () => navigation.navigate('Home'),
  },
  {
    id: 'notifications',
    icon: 'notifications',
    label: 'Уведомления',
    onPress: () => navigation.navigate('Notifications'),
    badge: 5, // Показывает бейдж с числом
  },
];

<Footer buttons={customButtons} />
```

