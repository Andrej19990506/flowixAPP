# Решение проблемы "Filename longer than 260 characters" в Windows

## Проблема
Windows имеет ограничение на длину пути в 260 символов, что вызывает ошибки при сборке React Native проектов с глубокой структурой папок.

## Решение 1: Включить длинные пути в Windows (РЕКОМЕНДУЕТСЯ)

### Через редактор реестра:
1. Нажмите `Win + R`, введите `regedit` и нажмите Enter
2. Перейдите в: `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem`
3. Создайте новый параметр DWORD (32-bit):
   - Имя: `LongPathsEnabled`
   - Значение: `1`
4. Перезагрузите компьютер

### Через PowerShell (от имени администратора):
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```
Затем перезагрузите компьютер.

## Решение 2: Переместить проект в более короткий путь (БЫСТРОЕ РЕШЕНИЕ)

Переместите проект в более короткий путь, например:
- `C:\RN\AppNinjaBot` (вместо `C:\Users\malah\Desktop\Project\AppNinjaBot`)
- `C:\Projects\AppNinjaBot`
- `C:\Dev\AppNinjaBot`

**Инструкция:**
1. Закройте все программы, работающие с проектом (Android Studio, VS Code и т.д.)
2. Скопируйте папку `AppNinjaBot` в `C:\RN\`
3. Откройте проект из нового расположения
4. Попробуйте собрать снова

Это уменьшит общую длину путей и решит проблему без изменения настроек Windows.

## Решение 3: Использовать WSL2 или Linux

Сборка на Linux/WSL2 не имеет ограничений на длину путей и обычно работает быстрее.

