#!/bin/bash

# Скрипт для генерации иконок приложения из логотипа
# Требуется: ImageMagick (для автоматической генерации) или Android Asset Studio

echo "🎨 Генерация иконок приложения Flowix"
echo ""

# Проверка наличия ImageMagick
if ! command -v convert &> /dev/null; then
    echo "⚠️  ImageMagick не установлен."
    echo "📝 Рекомендуется использовать Android Asset Studio:"
    echo "   https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html"
    echo ""
    echo "Или установите ImageMagick:"
    echo "   macOS: brew install imagemagick"
    echo "   Ubuntu: sudo apt-get install imagemagick"
    echo "   Windows: https://imagemagick.org/script/download.php"
    exit 1
fi

# Путь к исходному логотипу
LOGO_PATH="../../src/assets/Logo.png"

if [ ! -f "$LOGO_PATH" ]; then
    echo "❌ Логотип не найден: $LOGO_PATH"
    echo "   Укажите путь к PNG файлу логотипа (432x432px или больше)"
    read -p "Путь к логотипу: " LOGO_PATH
fi

if [ ! -f "$LOGO_PATH" ]; then
    echo "❌ Файл не найден: $LOGO_PATH"
    exit 1
fi

echo "✅ Найден логотип: $LOGO_PATH"
echo ""

# Создаем временную папку
TEMP_DIR=$(mktemp -d)
echo "📁 Временная папка: $TEMP_DIR"

# Создаем foreground изображения для разных плотностей
echo "🔄 Генерация foreground изображений..."

# mdpi: 108x108
convert "$LOGO_PATH" -resize 108x108 -background none -gravity center -extent 108x108 "$TEMP_DIR/ic_launcher_foreground_mdpi.png"

# hdpi: 162x162
convert "$LOGO_PATH" -resize 162x162 -background none -gravity center -extent 162x162 "$TEMP_DIR/ic_launcher_foreground_hdpi.png"

# xhdpi: 216x216
convert "$LOGO_PATH" -resize 216x216 -background none -gravity center -extent 216x216 "$TEMP_DIR/ic_launcher_foreground_xhdpi.png"

# xxhdpi: 324x324
convert "$LOGO_PATH" -resize 324x324 -background none -gravity center -extent 324x324 "$TEMP_DIR/ic_launcher_foreground_xxhdpi.png"

# xxxhdpi: 432x432
convert "$LOGO_PATH" -resize 432x432 -background none -gravity center -extent 432x432 "$TEMP_DIR/ic_launcher_foreground_xxxhdpi.png"

echo "✅ Foreground изображения созданы"
echo ""

# Копируем файлы в нужные папки
echo "📋 Копирование файлов..."

RES_DIR="app/src/main/res"

# Создаем папки если их нет
mkdir -p "$RES_DIR/mipmap-mdpi"
mkdir -p "$RES_DIR/mipmap-hdpi"
mkdir -p "$RES_DIR/mipmap-xhdpi"
mkdir -p "$RES_DIR/mipmap-xxhdpi"
mkdir -p "$RES_DIR/mipmap-xxxhdpi"

# Копируем foreground
cp "$TEMP_DIR/ic_launcher_foreground_mdpi.png" "$RES_DIR/mipmap-mdpi/ic_launcher_foreground.png"
cp "$TEMP_DIR/ic_launcher_foreground_hdpi.png" "$RES_DIR/mipmap-hdpi/ic_launcher_foreground.png"
cp "$TEMP_DIR/ic_launcher_foreground_xhdpi.png" "$RES_DIR/mipmap-xhdpi/ic_launcher_foreground.png"
cp "$TEMP_DIR/ic_launcher_foreground_xxhdpi.png" "$RES_DIR/mipmap-xxhdpi/ic_launcher_foreground.png"
cp "$TEMP_DIR/ic_launcher_foreground_xxxhdpi.png" "$RES_DIR/mipmap-xxxhdpi/ic_launcher_foreground.png"

echo "✅ Файлы скопированы"
echo ""

# Обновляем foreground drawable
echo "📝 Обновление ic_launcher_foreground.xml..."
FOREGROUND_XML="app/src/main/res/drawable/ic_launcher_foreground.xml"
cat > "$FOREGROUND_XML" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@mipmap/ic_launcher_foreground" />
EOF

echo "✅ XML обновлен"
echo ""

# Очищаем временные файлы
rm -rf "$TEMP_DIR"

echo "🎉 Готово! Иконки сгенерированы и размещены."
echo ""
echo "📱 Следующие шаги:"
echo "   1. Пересоберите проект: ./gradlew clean assembleDebug"
echo "   2. Установите на устройство и проверьте иконку"
echo ""


