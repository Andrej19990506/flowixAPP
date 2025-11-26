# iOS Разработка - Инструкция

## ⚠️ Важно

Для разработки под iOS **ОБЯЗАТЕЛЬНО нужен Mac** с установленным Xcode.

## Что такое Xcode?

**Xcode** - это IDE (интегрированная среда разработки) от Apple для разработки под iOS/macOS, похожа на Visual Studio для Windows.

- **Бесплатная** (в App Store)
- **Очень большая** (~12+ GB)
- **Работает только на Mac**

## Текущий статус проекта

### ✅ Android - РАБОТАЕТ
- Все нативные модули готовы
- QR Scanner работает
- Можно разрабатывать на Windows

### ⏳ iOS - КОД ГОТОВ, НУЖЕН MAC
- Все файлы созданы в `ios/FlowixApp/QrScanner/`
- Код написан и готов к сборке
- **НО:** нужен Mac для компиляции

## Файлы для iOS (уже созданы)

1. `QrScannerNativeModule.swift` - React Native мост
2. `QrScannerViewController.swift` - Нативный экран сканера
3. `QrScannerNativeModule.m` - Objective-C bridge

## Когда появится Mac - шаги для интеграции:

### 1. Установить Xcode
   - Открыть App Store
   - Найти "Xcode"
   - Установить (бесплатно, но долго ~12GB)

### 2. Установить Command Line Tools
   ```bash
   xcode-select --install
   ```

### 3. Установить CocoaPods (если еще нет)
   ```bash
   sudo gem install cocoapods
   ```

### 4. Добавить файлы в проект
   - Открыть `ios/FlowixApp.xcodeproj` в Xcode
   - Перетащить папку `QrScanner` в проект
   - Убедиться что файлы в target `FlowixApp`

### 5. Установить зависимости
   ```bash
   cd ios
   pod install
   cd ..
   ```

### 6. Запустить
   ```bash
   npm run ios
   ```

## Альтернативы (если нет Mac):

1. **Разрабатывать только на Android** - всё работает ✅
2. **Использовать облачную Mac-машину** (MacStadium, AWS EC2 Mac)
3. **Попросить друга с Mac** помочь со сборкой

## Текущая стратегия

- **Android:** полностью функционален, продолжаем разработку
- **iOS:** код готов, интеграция отложена до появления Mac

---

*Документ создан: 2024*

