import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import HapticFeedback from 'react-native-haptic-feedback';
import { scanQrCode } from '../frameProcessors/scanQrCode';

interface UseQrScannerOptions {
  onCodeDetected: (code: string) => void;
  enabled?: boolean;
}

interface UseQrScannerReturn {
  device: ReturnType<typeof useCameraDevice>;
  isActive: boolean;
  torchEnabled: boolean;
  canUseTorch: boolean;
  statusMessage: string;
  error: string | null;
  toggleTorch: () => void;
  requestCameraPermission: () => Promise<boolean>;
  frameProcessor: ReturnType<typeof useFrameProcessor>;
}

const DEBOUNCE_MS = 200; // Задержка между распознаваниями

export const useQrScanner = ({
  onCodeDetected,
  enabled = true,
}: UseQrScannerOptions): UseQrScannerReturn => {
  const [isActive, setIsActive] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [canUseTorch, setCanUseTorch] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Наведите камеру на QR-код');
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const device = useCameraDevice('back');
  const lastDetectedCodeRef = useRef<string | null>(null);
  const lastDetectionTimeRef = useRef<number>(0);

  // Запрос разрешения на камеру
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const permission = await Camera.requestCameraPermission();
      const hasPermission = permission === 'granted';
      setHasPermission(hasPermission);
      
      if (!hasPermission) {
        setError('Необходимо разрешение на использование камеры');
        setStatusMessage('Разрешите доступ к камере в настройках');
      } else {
        setError(null);
        setStatusMessage('Наведите камеру на QR-код');
      }
      
      return hasPermission;
    } catch (err) {
      console.error('[QR Scanner] Ошибка запроса разрешения:', err);
      setError('Не удалось запросить разрешение на камеру');
      return false;
    }
  }, []);

  // Обработка обнаруженного кода
  const handleCodeDetected = useCallback(
    (code: string) => {
      const now = Date.now();

      // Debounce: игнорируем повторные срабатывания
      if (
        lastDetectedCodeRef.current === code &&
        now - lastDetectionTimeRef.current < DEBOUNCE_MS
      ) {
        return;
      }

      lastDetectedCodeRef.current = code;
      lastDetectionTimeRef.current = now;

      // Вибрация
      try {
        HapticFeedback.trigger('impactMedium');
      } catch (err) {
        console.warn('[QR Scanner] Ошибка вибрации:', err);
      }

      // Обновление статуса
      setStatusMessage('Код считан');
      setIsActive(false);

      // Вызов callback
      onCodeDetected(code);
    },
    [onCodeDetected]
  );

  // Создаем worklet-функцию для вызова из frame processor
  // Второй аргумент — зависимости, как у useCallback (требуется типами)
  const runOnJSHandleCodeDetected = useRunOnJS(handleCodeDetected, [handleCodeDetected]);

  // Логируем создание frame processor и зависимости (только в JS, не в worklet)
  useEffect(() => {
    console.log('[QR Scanner] Frame processor зависимости:', {
      enabled,
      hasRunOnJSHandleCodeDetected: !!runOnJSHandleCodeDetected,
      runOnJSHandleCodeDetectedType: typeof runOnJSHandleCodeDetected,
    });
  }, [enabled, runOnJSHandleCodeDetected]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      // Проверяем, включен ли сканер
      if (!enabled) {
        return;
      }

      // Вызываем нативный плагин через JS-обёртку
      const code = scanQrCode(frame as any);

      if (code && code.length > 0) {
        // Передаём результат в JS-поток
        runOnJSHandleCodeDetected(code);
      }
    },
    [enabled, runOnJSHandleCodeDetected]
  );

  // Проверка текущего статуса разрешения при монтировании
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const permission = await Camera.getCameraPermissionStatus();
        const hasPermission = permission === 'granted';
        setHasPermission(hasPermission);
        
        if (!hasPermission && enabled) {
          // Если разрешения нет, запрашиваем его
          await requestCameraPermission();
        } else if (hasPermission) {
          setError(null);
          setStatusMessage('Наведите камеру на QR-код');
        }
      } catch (err) {
        console.error('[QR Scanner] Ошибка проверки разрешения:', err);
      }
    };
    
    if (enabled) {
      checkPermission();
    }
  }, [enabled, requestCameraPermission]);

  // Активация камеры при наличии разрешения
  useEffect(() => {
    console.log('[QR Scanner] Активация камеры:', {
      hasPermission,
      enabled,
      willActivate: hasPermission === true && enabled,
    });
    
    if (hasPermission === true && enabled) {
      setIsActive(true);
      setStatusMessage('Наведите камеру на QR-код');
      console.log('[QR Scanner] Камера активирована');
    } else {
      setIsActive(false);
      console.log('[QR Scanner] Камера деактивирована');
    }
  }, [hasPermission, enabled]);

  // Переключение фонарика
  const toggleTorch = useCallback(() => {
    if (!canUseTorch) {
      return;
    }
    setTorchEnabled((prev) => !prev);
  }, [canUseTorch]);

  // Проверка поддержки фонарика
  useEffect(() => {
    if (device?.hasTorch) {
      setCanUseTorch(true);
    } else {
      setCanUseTorch(false);
      setTorchEnabled(false);
    }
  }, [device]);

  return {
    device,
    isActive: isActive && hasPermission === true,
    torchEnabled,
    canUseTorch,
    statusMessage,
    error,
    toggleTorch,
    requestCameraPermission,
    frameProcessor,
  };
};
