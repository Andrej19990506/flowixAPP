/**
 * Утилиты для парсинга QR кодов в формате GS1 DataMatrix
 * 
 * Формат: AI (Application Identifier) + данные
 * Пример: "0104600721015725215.)"5N*93MKhL"
 * - "01" - AI для GTIN
 * - "04600721015725" - GTIN (14 цифр)
 * - "215.)"5N*93MKhL" - остальные данные
 */

/**
 * Извлекает GTIN (Global Trade Item Number) из QR кода
 * GTIN находится после AI "01" и состоит из 14 цифр
 * 
 * QR код может содержать символы GS (Group Separator, \u001d) перед "01"
 * Примеры:
 * - "0104600721015725215.)"5N*93MKhL"
 * - "\u001d0104600721015725215.)"5N*\u001d93MKhL"
 * 
 * @param qrCode - Полный QR код
 * @returns GTIN (14 цифр) или null, если не найден
 */
export function parseGtinFromQrCode(qrCode: string): string | null {
  if (!qrCode || typeof qrCode !== 'string') {
    return null;
  }

  // Удаляем символы GS (Group Separator, \u001d) в начале строки
  // GS используется в GS1 DataMatrix для разделения полей
  let cleanedCode = qrCode.replace(/^\u001d+/, ''); // Удаляем все GS в начале
  
  // Также удаляем GS из середины строки для поиска "01"
  // Но сохраняем оригинальный код для возврата
  const codeForSearch = cleanedCode.replace(/\u001d/g, '');
  
  // Ищем AI "01" в строке (может быть в начале или после GS)
  const ai01Index = codeForSearch.indexOf('01');
  
  if (ai01Index === -1) {
    console.log('[qrParser] AI "01" не найден в QR коде:', qrCode);
    return null;
  }

  // Извлекаем часть после "01" (первые 14 цифр - это GTIN)
  const after01 = codeForSearch.substring(ai01Index + 2);
  
  // Извлекаем первые 14 цифр
  const gtinMatch = after01.match(/^(\d{14})/);
  
  if (gtinMatch && gtinMatch[1]) {
    const gtin = gtinMatch[1];
    console.log('[qrParser] GTIN извлечен:', { 
      originalQrCode: qrCode, 
      cleanedCode: codeForSearch,
      gtin 
    });
    return gtin;
  }

  console.log('[qrParser] Не удалось извлечь GTIN из QR кода:', qrCode);
  return null;
}

/**
 * Валидирует GTIN (проверка контрольной суммы)
 * 
 * @param gtin - GTIN для валидации (14 цифр)
 * @returns true, если GTIN валиден
 */
export function validateGtin(gtin: string): boolean {
  if (!gtin || gtin.length !== 14 || !/^\d{14}$/.test(gtin)) {
    return false;
  }

  // Проверка контрольной суммы по алгоритму EAN-14
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(gtin[i], 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  const lastDigit = parseInt(gtin[13], 10);
  
  return checkDigit === lastDigit;
}

/**
 * Определяет тип кода (QR/DataMatrix или штрих-код) по формату
 * 
 * @param format - Формат кода из нативного сканера
 * @returns 'qr' для QR/DataMatrix, 'barcode' для штрих-кодов, null если неизвестно
 */
export function getCodeType(format: string | number): 'qr' | 'barcode' | null {
  if (typeof format === 'string') {
    const formatUpper = format.toUpperCase();
    if (formatUpper.includes('QR') || formatUpper.includes('DATA_MATRIX')) {
      return 'qr';
    }
    if (
      formatUpper.includes('EAN') ||
      formatUpper.includes('UPC') ||
      formatUpper.includes('CODE_128') ||
      formatUpper.includes('CODE_39') ||
      formatUpper.includes('CODE_93') ||
      formatUpper.includes('ITF') ||
      formatUpper.includes('CODABAR')
    ) {
      return 'barcode';
    }
  }
  
  // Числовые константы из ML Kit
  if (typeof format === 'number') {
    // QR_CODE = 256, DATA_MATRIX = 16
    if (format === 256 || format === 16) {
      return 'qr';
    }
    // EAN_13 = 32, EAN_8 = 64, UPC_A = 1, UPC_E = 2, CODE_128 = 4, CODE_39 = 8, CODE_93 = 2048, ITF = 128, CODABAR = 1024
    if ([32, 64, 1, 2, 4, 8, 2048, 128, 1024].includes(format)) {
      return 'barcode';
    }
  }
  
  return null;
}

/**
 * Извлекает GTIN из штрих-кода (EAN-13, EAN-8, UPC-A, UPC-E)
 * 
 * @param barcode - Штрих-код
 * @returns GTIN (14 цифр) или null, если не удалось извлечь
 */
export function parseGtinFromBarcode(barcode: string): string | null {
  if (!barcode || typeof barcode !== 'string') {
    return null;
  }

  // Удаляем все нецифровые символы
  const digitsOnly = barcode.replace(/\D/g, '');
  
  if (digitsOnly.length === 0) {
    return null;
  }

  // EAN-13: 13 цифр, преобразуем в GTIN-14 (добавляем 0 в начало)
  if (digitsOnly.length === 13) {
    const gtin = '0' + digitsOnly;
    console.log('[qrParser] GTIN извлечен из EAN-13:', { barcode, gtin });
    return gtin;
  }

  // EAN-8: 8 цифр, преобразуем в GTIN-14 (добавляем 000000 в начало)
  if (digitsOnly.length === 8) {
    const gtin = '000000' + digitsOnly;
    console.log('[qrParser] GTIN извлечен из EAN-8:', { barcode, gtin });
    return gtin;
  }

  // UPC-A: 12 цифр, преобразуем в GTIN-14 (добавляем 00 в начало)
  if (digitsOnly.length === 12) {
    const gtin = '00' + digitsOnly;
    console.log('[qrParser] GTIN извлечен из UPC-A:', { barcode, gtin });
    return gtin;
  }

  // UPC-E: 6-8 цифр, преобразуем в GTIN-14 (расширяем до UPC-A, затем добавляем 00)
  if (digitsOnly.length >= 6 && digitsOnly.length <= 8) {
    // Для UPC-E нужна более сложная логика расширения, но для простоты добавим нули
    const gtin = '00' + digitsOnly.padStart(12, '0');
    console.log('[qrParser] GTIN извлечен из UPC-E:', { barcode, gtin });
    return gtin;
  }

  // Если уже 14 цифр - возвращаем как есть
  if (digitsOnly.length === 14) {
    console.log('[qrParser] GTIN уже в формате 14 цифр:', { barcode, gtin: digitsOnly });
    return digitsOnly;
  }

  console.log('[qrParser] Не удалось извлечь GTIN из штрих-кода:', { barcode, length: digitsOnly.length });
  return null;
}

/**
 * Парсит код (QR или штрих-код) и возвращает структурированные данные
 * 
 * @param code - Полный код (QR или штрих-код)
 * @param format - Формат кода (опционально, для определения типа)
 * @returns Объект с данными кода, или null если парсинг не удался
 */
export function parseCode(
  code: string,
  format?: string | number
): {
  qrData?: string;
  barcode?: string;
  barcodeFormat?: string;
  gtin: string | null;
  codeType: 'qr' | 'barcode';
} | null {
  if (!code || typeof code !== 'string') {
    return null;
  }

  // Определяем тип кода
  const codeType = format ? getCodeType(format) : null;
  
  // Если тип не определен, пытаемся определить по содержимому
  const detectedType: 'qr' | 'barcode' = codeType || 
    (code.includes('01') && code.length > 20 ? 'qr' : 'barcode');

  if (detectedType === 'qr') {
    // Обрабатываем как QR код
    const gtin = parseGtinFromQrCode(code);
    return {
      qrData: code,
      gtin: gtin,
      codeType: 'qr',
    };
  } else {
    // Обрабатываем как штрих-код
    const gtin = parseGtinFromBarcode(code);
    const formatString = format ? String(format) : undefined;
    return {
      barcode: code,
      barcodeFormat: formatString,
      gtin: gtin,
      codeType: 'barcode',
    };
  }
}

/**
 * Парсит QR код и возвращает структурированные данные (для обратной совместимости)
 * 
 * @param qrCode - Полный QR код
 * @returns Объект с qrData и gtin, или null если парсинг не удался
 */
export function parseQrCode(qrCode: string): { qrData: string; gtin: string | null } | null {
  if (!qrCode || typeof qrCode !== 'string') {
    return null;
  }

  const gtin = parseGtinFromQrCode(qrCode);
  
  return {
    qrData: qrCode,
    gtin: gtin,
  };
}

