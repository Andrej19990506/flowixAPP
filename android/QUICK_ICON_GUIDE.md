# 🚀 Быстрая инструкция по созданию иконки

## Самый простой способ (5 минут):

### 1. Откройте Android Asset Studio
👉 https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html

### 2. Загрузите логотип
- Нажмите "Image" в разделе "Foreground"
- Выберите файл: `FlowixApp/src/assets/Logo.png`
- Убедитесь, что логотип центрирован и имеет прозрачный фон

### 3. Настройте Background
- Выберите "Color"
- Введите цвет: `#FF6B35` (оранжевый бренд Flowix)

### 4. Скачайте и распакуйте
- Нажмите "Download" (Zip)
- Распакуйте архив

### 5. Скопируйте файлы
Из распакованной папки `res/mipmap-*/` скопируйте файлы:
```
ic_launcher_foreground.png
```
В соответствующие папки проекта:
```
FlowixApp/android/app/src/main/res/
├── mipmap-mdpi/ic_launcher_foreground.png
├── mipmap-hdpi/ic_launcher_foreground.png
├── mipmap-xhdpi/ic_launcher_foreground.png
├── mipmap-xxhdpi/ic_launcher_foreground.png
└── mipmap-xxxhdpi/ic_launcher_foreground.png
```

### 6. Обновите XML файл
Откройте `FlowixApp/android/app/src/main/res/drawable/ic_launcher_foreground.xml` и замените содержимое на:
```xml
<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@mipmap/ic_launcher_foreground" />
```

### 7. Готово! 🎉
Пересоберите проект:
```bash
cd FlowixApp/android
./gradlew clean assembleDebug
```

Установите на устройство и проверьте иконку!

---

## Альтернативный способ: Android Studio

1. Откройте проект в Android Studio
2. Правый клик на `res` → **New** → **Image Asset**
3. Выберите **Launcher Icons (Adaptive and Legacy)**
4. В разделе **Foreground Layer**:
   - Выберите "Image"
   - Загрузите `Logo.png`
5. В разделе **Background Layer**:
   - Выберите "Color"
   - Введите `#FF6B35`
6. Нажмите **Next** → **Finish**

Android Studio автоматически создаст все нужные файлы!

