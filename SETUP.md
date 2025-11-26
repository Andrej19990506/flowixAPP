# Настройка FlowixApp

## Установка зависимостей

После добавления новых зависимостей в `package.json`, выполните:

```bash
cd FlowixApp
npm install
```

Для iOS также нужно установить pods:
```bash
cd ios
pod install
cd ..
```

## Зависимости, которые нужно установить

Все зависимости уже добавлены в `package.json`:
- `@reduxjs/toolkit` - Redux Toolkit для управления состоянием
- `react-redux` - React bindings для Redux
- `@react-navigation/native` - Навигация
- `@react-navigation/native-stack` - Stack навигатор
- `@react-native-async-storage/async-storage` - Хранение токенов
- `axios` - HTTP клиент
- `react-native-gesture-handler` - Для навигации
- `react-native-reanimated` - Для навигации
- `react-native-screens` - Для навигации

## После установки

1. Перезапустите Metro bundler: `npm start`
2. Пересоберите приложение:
   - Android: `npm run android`
   - iOS: `npm run ios`

## Проверка работы

После установки зависимостей и запуска приложения:
- При первом запуске должен показаться экран авторизации (`AuthScreen`)
- При нажатии на кнопку "Авторизоваться через Telegram" откроется бот
- После авторизации через бота приложение должно автоматически перейти в главное меню

