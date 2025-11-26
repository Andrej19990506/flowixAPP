# Авторизация в FlowixApp

## Обзор

В нативном приложении реализована система авторизации через Telegram с двумя способами:

1. **Авторизация через Telegram бота** - пользователь переходит по ссылке в бота, получает токен и возвращается в приложение
2. **Авторизация через Telegram Mini App** - автоматическая авторизация при открытии приложения из Telegram Mini App

## Структура

### Redux Store
- `src/store/store.ts` - конфигурация Redux store
- `src/store/slices/authSlice.ts` - slice для управления состоянием авторизации
- `src/store/hooks.ts` - типизированные хуки для работы с Redux

### Сервисы
- `src/services/api.ts` - API клиент с поддержкой токенов и автоматического обновления

### Навигация
- `src/navigation/AppNavigator.tsx` - главный навигатор с проверкой авторизации
- `src/utils/linking.ts` - обработка deep linking для авторизации через бота

### Экраны
- `src/screens/AuthScreen.tsx` - экран авторизации
- `src/screens/MainMenuScreen.tsx` - главное меню (показывается после авторизации)

## Установка зависимостей

```bash
cd FlowixApp
npm install
```

Для iOS:
```bash
cd ios
pod install
cd ..
```

## Настройка Deep Linking

### Android
Deep linking уже настроен в `AndroidManifest.xml`:
- Схема: `flowixapp://auth?auth_token=...`

### iOS
Deep linking уже настроен в `Info.plist`:
- URL Scheme: `flowixapp`

## Использование

### Авторизация через бота

1. Пользователь нажимает кнопку "Авторизоваться через Telegram" на экране авторизации
2. Открывается Telegram бот с командой `/start auth`
3. Бот генерирует токен и создает ссылку вида `flowixapp://auth?auth_token=...`
4. Приложение получает deep link и автоматически авторизует пользователя

### Авторизация через Mini App

1. Пользователь открывает приложение из Telegram Mini App
2. Приложение получает `initData` от Telegram
3. Автоматически выполняется авторизация через `authenticateWithTelegramThunk`

## TODO

- [ ] Реализовать получение `initData` от Telegram Mini App через WebView
- [ ] Добавить SplashScreen компонент
- [ ] Реализовать загрузку данных пользователя при восстановлении сессии
- [ ] Добавить обработку ошибок авторизации с более понятными сообщениями

