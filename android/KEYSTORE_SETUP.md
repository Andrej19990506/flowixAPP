# Настройка Keystore для подписи Release APK/AAB

## Шаг 1: Создание Keystore

Выполните команду в терминале (в папке `FlowixApp/android/app`):

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore flowix-release.keystore -alias flowix-app-key -keyalg RSA -keysize 2048 -validity 10000
```

Вам будет предложено ввести:
- **Keystore password** - пароль для keystore (запомните его!)
- **Key password** - пароль для ключа (можно использовать тот же)
- **Имя и фамилию** - ваше имя
- **Название организации** - название вашей организации
- **Город** - ваш город
- **Область/Регион** - ваш регион
- **Код страны** - например, RU

## Шаг 2: Настройка keystore.properties

Откройте файл `FlowixApp/android/keystore.properties` и заполните его:

```properties
storePassword=ВАШ_ПАРОЛЬ_KEYSTORE
keyPassword=ВАШ_ПАРОЛЬ_КЛЮЧА
keyAlias=flowix-app-key
storeFile=../app/flowix-release.keystore
```

**ВАЖНО:** 
- Замените `ВАШ_ПАРОЛЬ_KEYSTORE` и `ВАШ_ПАРОЛЬ_КЛЮЧА` на реальные пароли
- Этот файл уже добавлен в `.gitignore` и не будет закоммичен в Git
- Сохраните пароли в безопасном месте!

## Шаг 3: Сборка Release APK/AAB

После настройки вы можете собрать подписанный APK или AAB:

### Через Android Studio:
1. Build → Generate Signed Bundle / APK
2. Выберите "Android App Bundle" или "APK"
3. Укажите путь к `flowix-release.keystore`
4. Введите пароли
5. Выберите release build variant

### Через командную строку:
```bash
cd FlowixApp/android
./gradlew bundleRelease  # для AAB
# или
./gradlew assembleRelease  # для APK
```

Готовые файлы будут в:
- AAB: `FlowixApp/android/app/build/outputs/bundle/release/app-release.aab`
- APK: `FlowixApp/android/app/build/outputs/apk/release/app-release.apk`

## Безопасность

⚠️ **НИКОГДА не коммитьте:**
- `keystore.properties` (уже в .gitignore)
- `*.keystore` файлы (уже в .gitignore)
- Пароли от keystore

💾 **Сохраните в безопасном месте:**
- Keystore файл (`flowix-release.keystore`)
- Пароли от keystore
- Информацию о keystore (alias, срок действия)

Если потеряете keystore или пароли, вы **НЕ СМОЖЕТЕ** обновить приложение в Google Play Store!

