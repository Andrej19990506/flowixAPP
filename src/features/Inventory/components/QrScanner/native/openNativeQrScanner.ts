import { NativeModules, Platform } from 'react-native';

type QrScannerNativeModuleType = {
  // Может вернуть массив кодов, один код, null или объект дубликата
  openQrScanner(existingCodes?: string[]): Promise<string[] | string | null | { type: 'duplicate'; code: string }>;
  closeQrScanner(): Promise<boolean>;
};

const { QrScannerNativeModule } = NativeModules as {
  QrScannerNativeModule?: QrScannerNativeModuleType;
};

export type QrScanResult = {
  type: 'success';
  codes: string[];
} | {
  type: 'duplicate';
  code: string;
} | {
  type: 'cancelled';
};

export async function openNativeQrScanner(existingCodes?: string[]): Promise<QrScanResult> {
  console.log('[openNativeQrScanner] Вызов с existingCodes:', existingCodes);
  console.log('[openNativeQrScanner] Платформа:', Platform.OS);
  
  // Проверяем наличие модуля
  if (!QrScannerNativeModule) {
    const errorMessage = `QR Scanner не поддерживается на ${Platform.OS}. Нативный модуль не найден.`;
    console.error('[openNativeQrScanner]', errorMessage);
    
    // На iOS показываем более понятное сообщение
    if (Platform.OS === 'ios') {
      throw new Error('QR Scanner для iOS пока не настроен. Для сборки iOS нужен Mac с Xcode. Android версия работает.');
    }
    
    throw new Error(errorMessage);
  }
  
  // На iOS модуль открывает модальный экран, Promise резолвится сразу
  // Результаты приходят через события, как и на Android
  const result = await QrScannerNativeModule.openQrScanner(existingCodes);
  console.log('[openNativeQrScanner] Получен raw result:', result);
  console.log('[openNativeQrScanner] Тип result:', typeof result);
  console.log('[openNativeQrScanner] Array.isArray(result):', Array.isArray(result));

  // На iOS результат будет null, так как события приходят через EventEmitter
  // На Android тоже может быть null
  if (result === null || result === undefined) {
    console.log('[openNativeQrScanner] Результат null/undefined - ожидаем события через EventEmitter');
    // Возвращаем cancelled, но это не значит что сканер не работает
    // Результаты будут приходить через события onQrCodeScanned
    return { type: 'cancelled' };
  }

  // Проверяем, это дубликат?
  if (typeof result === 'object' && !Array.isArray(result) && 'type' in result && result.type === 'duplicate') {
    console.log('[openNativeQrScanner] Обнаружен дубликат:', result.code);
    return {
      type: 'duplicate',
      code: result.code || '',
    };
  }

  // Обычный результат
  if (Array.isArray(result)) {
    console.log('[openNativeQrScanner] Массив кодов:', result);
    return { type: 'success', codes: result };
  }

  console.log('[openNativeQrScanner] Одиночный код:', result);
  return { type: 'success', codes: [String(result)] };
}


