# QR Scanner iOS Implementation

## Что было создано:

### 1. **QrScannerNativeModule.swift** - React Native мост
   - Экспортирует методы `openQrScanner` и `closeQrScanner`
   - Отправляет события `onQrCodeScanned` в JS

### 2. **QrScannerViewController.swift** - Нативный ViewController
   - Использует **AVFoundation** для камеры
   - Использует **Vision Framework** для распознавания QR/DataMatrix кодов
   - UI с overlay, кнопками закрытия и фонарика
   - Вибрация при сканировании
   - Определение дубликатов

### 3. **QrScannerNativeModule.m** - Objective-C bridge
   - Связывает Swift модуль с React Native

## Что нужно сделать для интеграции:

### 1. Добавить файлы в Xcode проект:
   - Открыть `ios/FlowixApp.xcodeproj` в Xcode
   - Перетащить папку `QrScanner` в проект
   - Убедиться что файлы добавлены в target `FlowixApp`

### 2. Проверить Info.plist:
   - Уже есть `NSCameraUsageDescription` ✅

### 3. Собрать проект:
   ```bash
   cd ios
   pod install
   cd ..
   ```

### 4. Сравнение с Android:

| Android | iOS |
|---------|-----|
| `QrScannerNativeActivity` | `QrScannerViewController` |
| CameraX | AVFoundation |
| ML Kit | Vision Framework |
| `QrScannerNativeModule.kt` | `QrScannerNativeModule.swift` |

### 5. JS код уже обновлен:
   - `openNativeQrScanner.ts` - проверяет наличие модуля
   - `QrScannerScreen.tsx` - работает на обеих платформах

## Примечания:

- iOS реализация использует те же события что и Android
- Интерфейс API одинаковый для обеих платформ
- После добавления файлов в Xcode, сканер будет работать на iOS так же как на Android

