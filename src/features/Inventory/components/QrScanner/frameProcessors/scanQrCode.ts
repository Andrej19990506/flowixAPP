import { VisionCameraProxy, type Frame } from 'react-native-vision-camera';

// Инициализируем нативный Frame Processor Plugin по имени из QrScannerFrameProcessorPlugin.NAME
const qrPlugin = VisionCameraProxy.initFrameProcessorPlugin('scanQrCode', {});

/**
 * Worklet-обёртка над нативным QR-плагином.
 * Возвращает строку QR-кода или null, если ничего не найдено.
 */
export function scanQrCode(frame: Frame): string | null {
  'worklet';

  if (qrPlugin == null) {
    // Если плагин не инициализировался, просто ничего не делаем
    return null;
  }

  // Нативный плагин возвращает rawValue (string) или null
  const result = qrPlugin.call(frame) as string | null;
  return result;
}



