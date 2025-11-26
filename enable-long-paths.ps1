# Скрипт для включения длинных путей в Windows
# ТРЕБУЕТСЯ ЗАПУСК ОТ ИМЕНИ АДМИНИСТРАТОРА

Write-Host "Проверка прав администратора..." -ForegroundColor Yellow

# Проверка прав администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ОШИБКА: Этот скрипт требует прав администратора!" -ForegroundColor Red
    Write-Host "Запустите PowerShell от имени администратора и выполните:" -ForegroundColor Yellow
    Write-Host "  .\enable-long-paths.ps1" -ForegroundColor Cyan
    exit 1
}

Write-Host "Включение длинных путей в Windows..." -ForegroundColor Green

try {
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem"
    $value = Get-ItemProperty -Path $regPath -Name "LongPathsEnabled" -ErrorAction SilentlyContinue
    
    if ($null -eq $value -or $value.LongPathsEnabled -eq 0) {
        Write-Host "Установка LongPathsEnabled = 1..." -ForegroundColor Yellow
        New-ItemProperty -Path $regPath -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force | Out-Null
        Write-Host "✓ Длинные пути включены!" -ForegroundColor Green
        Write-Host "" -ForegroundColor Yellow
        Write-Host "ВАЖНО: Необходима перезагрузка компьютера для применения изменений!" -ForegroundColor Red
        Write-Host "После перезагрузки проблема с длинными путями будет решена." -ForegroundColor Yellow
    } else {
        Write-Host "✓ Длинные пути уже включены (значение: $($value.LongPathsEnabled))" -ForegroundColor Green
        Write-Host "Если проблема сохраняется, попробуйте перезагрузить компьютер." -ForegroundColor Yellow
    }
} catch {
    Write-Host "ОШИБКА при изменении реестра: $_" -ForegroundColor Red
    exit 1
}

