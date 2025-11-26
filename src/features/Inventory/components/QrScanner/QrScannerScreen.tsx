import React from 'react';
import { StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { useTheme } from '@contexts/ThemeContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { openNativeQrScanner } from './native/openNativeQrScanner';

type QrScannerNavigationProp = NativeStackNavigationProp<RootStackParamList, 'QrScanner'>;
type QrScannerRouteProp = NativeStackScreenProps<RootStackParamList, 'QrScanner'>['route'];

const QrScannerScreen: React.FC = () => {
  const navigation = useNavigation<QrScannerNavigationProp>();
  const route = useRoute<QrScannerRouteProp>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  React.useEffect(() => {
    let isActive = true;
    let cameraOpened = false;

    const run = async () => {
      try {
        // Получаем список уже сканированных кодов из route params
        const existingCodes = (route.params as any)?.existingCodes as string[] | undefined;
        console.log('[QR Scanner Screen] Открываем нативный сканер с existingCodes:', existingCodes);
        
        // Открываем сканер - Promise резолвится сразу после открытия Activity
        await openNativeQrScanner(existingCodes);
        cameraOpened = true;
        console.log('[QR Scanner Screen] Нативный сканер открыт');
        
        // Убираем этот экран из стека навигации, чтобы при закрытии камеры сразу вернуться на Inventory
        // Используем setTimeout, чтобы дать время камере открыться
        setTimeout(() => {
          if (isActive) {
            navigation.goBack();
          }
        }, 100);
      } catch (err) {
        console.error('[QR Scanner] Ошибка при открытии нативного сканера:', err);
        if (isActive) {
          navigation.goBack();
        }
      }
    };

    run();

    // Слушаем события сканирования
    // Проверяем наличие модуля перед подпиской
    if (!NativeModules.QrScannerNativeModule) {
      console.warn('[QR Scanner Screen] QrScannerNativeModule не найден, пропускаем подписку на события');
      return;
    }
    
    const eventEmitter = new NativeEventEmitter(NativeModules.QrScannerNativeModule);
    const subscription = eventEmitter.addListener('onQrCodeScanned', (event: { code: string; isDuplicate: boolean }) => {
      if (!isActive) return;
      
      console.log('[QR Scanner Screen] Получено событие сканирования:', event);
      
      if (event.isDuplicate) {
        navigation.setParams({ 
          scanResult: 'duplicate', 
          duplicateCode: event.code 
        } as any);
      } else {
        navigation.setParams({ 
          qrCodes: [event.code], 
          scanResult: 'success' 
        } as any);
      }
    });

    // Слушаем когда экран получает фокус (когда камера закрыта и мы возвращаемся)
    // Это может произойти только если экран все еще в стеке (что не должно быть, но на всякий случай)
    const unsubscribeFocus = navigation.addListener('focus', () => {
      // Если камера была открыта и мы возвращаемся на экран, значит камера закрыта
      // Сразу возвращаемся на Inventory
      if (isActive && cameraOpened) {
        console.log('[QR Scanner Screen] Камера закрыта, возвращаемся на Inventory');
        cameraOpened = false;
        navigation.goBack();
      }
    });

    return () => {
      isActive = false;
      subscription.remove();
      unsubscribeFocus();
    };
  }, [navigation, route.params]);

  const styles = createStyles(isDark);

  // Экран прозрачный - камера работает поверх него
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#000000' : '#FFFFFF'}
        translucent
      />
      {/* Пустой экран - камера работает поверх */}
    </SafeAreaView>
  );
};

const createStyles = (isDark: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent', // Прозрачный фон
    },
  });
};

export default QrScannerScreen;

