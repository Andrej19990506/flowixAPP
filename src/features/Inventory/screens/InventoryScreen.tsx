import React, { useState, useEffect, useRef, useMemo, useTransition, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  Pressable,
  Alert,
  AppState,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  FlatList,
  Image,
  PermissionsAndroid,
  InteractionManager,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { NativeEventEmitter, NativeModules } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { Footer } from '../../../shared/components';
import EmptyInventoryState from '../components/EmptyInventoryState';
import { ItemEditPanel } from '../components';
import QrCodeBindModal from '../components/QrCodeBindModal';
import { useInventoryFooter } from '../hooks/useInventoryFooter';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { fetchInventoryChats, fetchChatInventory, selectChat } from '../../../store/slices/inventorySlice';
import { updateInventoryItem as updateInventoryItemApi } from '../../../services/inventoryApi';
import { parseCode, parseGtinFromQrCode } from '../../../utils/qrParser';

type InventoryScreenProps = NativeStackScreenProps<RootStackParamList, 'Inventory'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Компонент анимированной карточки товара
const AnimatedItemCard: React.FC<{
  itemName: string;
  item: any;
  index: number;
  isExpanded: boolean;
  onPress: () => void;
  onPhotoPress: () => void;
  isDark: boolean;
  styles: any;
}> = ({ itemName, item, index, isExpanded, onPress, onPhotoPress, isDark, styles }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current; // Уменьшено для более плавного эффекта
  const scaleAnim = useRef(new Animated.Value(0.96)).current; // Ближе к 1 для более плавного эффекта

  useEffect(() => {
    if (isExpanded) {
      // Плавная staggered animation - начинаем сразу без задержек
      const delay = index * 25; // Минимальная задержка для плавности
      
      // Запускаем анимацию сразу, без requestAnimationFrame
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280, // Оптимальная длительность
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          delay,
          tension: 100, // Быстрее для мгновенного отклика
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Быстрое скрытие при сворачивании
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 15,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isExpanded, index]);

  // Рендерим всегда, но контролируем видимость через анимацию

  return (
    <Animated.View
      style={[
        styles.animatedItemWrapper,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.itemCard,
          pressed && styles.itemCardPressed,
        ]}
      >
        {/* Иконка/Фото товара */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onPhotoPress();
          }}
          style={styles.itemIconContainer}
        >
          {item.photoUrl ? (
            <>
              <Image
                source={{ 
                  uri: item.photoUrl.startsWith('http') 
                    ? item.photoUrl 
                    : `https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net/api/v1/inventory/photos/${item.photoUrl.replace('/inventory_photos/', '')}`
                }}
                style={styles.itemPhoto}
                resizeMode="cover"
              />
              {/* Иконка камеры в углу */}
              <View style={styles.cameraIconOverlay}>
                <Icon name="camera-alt" size={16} color="#FFFFFF" />
              </View>
            </>
          ) : (
            <Icon
              name="camera-alt"
              size={32}
              color="#FF6B35"
            />
          )}
        </Pressable>

        <View style={styles.itemContent}>
          {/* Название товара */}
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name || itemName}
            </Text>
            {item.unit && (
              <View style={styles.itemUnitBadge}>
                <Text style={styles.itemUnit}>{item.unit}</Text>
              </View>
            )}
          </View>

          {/* Индикаторы кодов */}
          {(item.qrData || item.barcode || item.gtin) && (
            <View style={styles.itemCodeIndicators}>
              {item.qrData && (
                <View style={styles.codeIndicator}>
                  <Icon name="qr-code-2" size={12} color="#FF6B35" />
                  <Text style={styles.codeIndicatorText}>QR</Text>
                </View>
              )}
              {item.barcode && (
                <View style={styles.codeIndicator}>
                  <Icon name="barcode-reader" size={12} color="#FF6B35" />
                  <Text style={styles.codeIndicatorText}>Штрих</Text>
                </View>
              )}
            </View>
          )}

          {/* Информация о количестве */}
          <View style={styles.itemInfo}>
            {item.raw && (
              <View style={styles.itemInfoRow}>
                <Text style={styles.itemInfoLabel}>Сырье</Text>
                {item.raw.isOutOfStock ? (
                  <View style={styles.outOfStockBadge}>
                    <Text style={styles.outOfStockLabel}>Нет в наличии</Text>
                  </View>
                ) : (
                  <Text style={styles.itemInfoValue}>
                    {item.raw.quantity} {item.unit || 'шт'}
                  </Text>
                )}
              </View>
            )}
            {item.semifinished && (
              <View style={styles.itemInfoRow}>
                <Text style={styles.itemInfoLabel}>Полуфабрикат</Text>
                <Text style={styles.itemInfoValue}>
                  {item.semifinished.quantity} {item.unit || 'шт'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Стрелка для навигации */}
        <View style={styles.itemArrow}>
          <Icon
            name="chevron-right"
            size={20}
            color={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
};

// Компонент категории с анимацией (мемоизирован для оптимизации)
const CategoryItem: React.FC<{
  category: string;
  items: any;
  isExpanded: boolean;
  onToggle: () => void;
  onItemPress: (itemId: string, item: any) => void;
  onPhotoPress: (itemId: string, item: any) => void;
  isDark: boolean;
  styles: any;
}> = React.memo(({ category, items, isExpanded, onToggle, onItemPress, onPhotoPress, isDark, styles }) => {
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      // Откладываем рендеринг до завершения текущих взаимодействий
      const handle = InteractionManager.runAfterInteractions(() => {
        setShouldRender(true);
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
      return () => handle.cancel();
    } else {
      // Быстро скрываем при сворачивании
      Animated.timing(animatedOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [isExpanded, animatedOpacity]);

  const itemsCount = Object.keys(items).length;
  // Считаем количество заполненных товаров (у которых есть raw данные)
  const filledItemsCount = useMemo(() => {
    return Object.values(items).filter((item: any) => item?.raw != null).length;
  }, [items]);

  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryContainer}>
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [
            styles.categoryHeader,
            pressed && styles.categoryHeaderPressed,
          ]}
        >
          <View style={styles.categoryHeaderContent}>
            <View style={styles.categoryIconContainer}>
              <Icon
                name={isExpanded ? 'keyboard-arrow-down' : 'keyboard-arrow-right'}
                size={20}
                color="#FF6B35"
              />
            </View>
            <View style={styles.categoryTitleContainer}>
              <Text style={styles.categoryTitle}>{category}</Text>
              <View style={styles.categoryCountBadge}>
                <Text style={styles.categoryCount}>
                  {filledItemsCount} из {itemsCount}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        {shouldRender && (
          <Animated.View
            style={[
              styles.categoryItemsContainer,
              {
                opacity: animatedOpacity,
              },
            ]}
          >
            <FlatList
              data={Object.entries(items)}
              keyExtractor={([itemName]) => `${category}-${itemName}`}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={5}
              renderItem={({ item: [itemName, item], index: itemIndex }) => {
                const itemData = item as any;
                return (
                  <AnimatedItemCard
                    itemName={itemName}
                    item={itemData}
                    index={itemIndex}
                    isExpanded={isExpanded}
                    onPress={() => onItemPress(itemName, itemData)}
                    onPhotoPress={() => onPhotoPress(itemName, itemData)}
                    isDark={isDark}
                    styles={styles}
                  />
                );
              }}
              scrollEnabled={false}
              style={styles.categoryItems}
              contentContainerStyle={styles.categoryItemsContent}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Кастомная функция сравнения для мемоизации
  return (
    prevProps.category === nextProps.category &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isDark === nextProps.isDark &&
    Object.keys(prevProps.items).length === Object.keys(nextProps.items).length
  );
});

const InventoryScreen: React.FC<InventoryScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<InventoryScreenProps['route']>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);
  const isDark = theme === 'dark';
  const dispatch = useAppDispatch();

  // Redux state
  const { user } = useAppSelector((state) => state.auth);
  const { items, currentInventory, isLoading, error, selectedChatId, selectedChat } = useAppSelector(
    (state) => state.inventory
  );

  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  // Состояние для отслеживания свернутых/развернутых категорий (по умолчанию все свернуты)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const toggleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Состояние для выбранного товара для редактирования
  const [selectedItem, setSelectedItem] = useState<{
    category: string;
    itemId: string;
    item: any;
  } | null>(null);
  const [qrBindModal, setQrBindModal] = useState<{
    visible: boolean;
    qrCode: string;
    gtin: string;
    barcode?: string;
    barcodeFormat?: string;
  }>({
    visible: false,
    qrCode: '',
    gtin: '',
    barcode: undefined,
    barcodeFormat: undefined,
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Получаем chatId из параметров навигации или используем выбранный чат из Redux
  const chatIdFromParams = route.params?.chatId;
  const activeChatId = chatIdFromParams || selectedChatId;
  
  // Логируем все источники chatId при монтировании и изменении
  useEffect(() => {
    console.log('[Inventory] 📊 Состояние выбора чата:', {
      chatIdFromParams,
      selectedChatId,
      activeChatId,
      itemsCount: items.length,
      selectedChat: selectedChat ? { chat_id: selectedChat.chat_id, title: selectedChat.title } : null,
      routeParams: route.params,
      routeName: route.name,
      routeKey: route.key,
      fullRoute: JSON.stringify(route, null, 2),
    });
  }, [chatIdFromParams, selectedChatId, activeChatId, items.length, selectedChat, route.params, route.name, route.key]);
  
  const isEmpty = !currentInventory?.inventory || Object.keys(currentInventory.inventory).length === 0;

  // Загружаем список чатов только если его нет в Redux и нет chatId в параметрах
  useEffect(() => {
    // Если chatId передан в параметрах, не загружаем список чатов
    if (chatIdFromParams) {
      console.log('[Inventory] ChatId передан в параметрах, пропускаем загрузку списка чатов');
      return;
    }
    
    if (user?.id && items.length === 0) {
      console.log('[Inventory] Список чатов пуст, загружаем для userId:', user.id);
      // Не фильтруем по типу, чтобы получить все чаты пользователя
      dispatch(fetchInventoryChats({ userId: user.id, role: undefined }))
        .then((result) => {
          if (fetchInventoryChats.fulfilled.match(result)) {
            console.log('[Inventory] ✅ Список чатов загружен:', result.payload.length, 'чатов');
            // Если есть чаты и нет выбранного, выбираем первый
            if (result.payload.length > 0 && !selectedChatId) {
              const firstChatId = result.payload[0].chat_id;
              console.log('[Inventory] Автоматически выбираем первый чат:', firstChatId);
              dispatch(selectChat(firstChatId));
            }
          } else {
            console.error('[Inventory] ❌ Ошибка загрузки списка чатов:', result.payload);
          }
        })
        .catch((error) => {
          console.error('[Inventory] ❌ Исключение при загрузке списка чатов:', error);
        });
    } else if (items.length > 0 && !selectedChatId) {
      // Если чаты есть, но нет выбранного, выбираем первый
      const firstChatId = items[0].chat_id;
      console.log('[Inventory] Выбираем первый чат из списка:', firstChatId);
      dispatch(selectChat(firstChatId));
    }
  }, [user?.id, items.length, selectedChatId, chatIdFromParams, dispatch]);

  // Загружаем инвентарь выбранного чата
  useEffect(() => {
    if (activeChatId) {
      console.log('[Inventory] Загружаем инвентарь для chatId:', activeChatId);
      // Убеждаемся, что чат выбран в Redux
      if (selectedChatId !== activeChatId) {
        dispatch(selectChat(activeChatId));
      }
      dispatch(fetchChatInventory(activeChatId))
        .then((result) => {
          if (fetchChatInventory.fulfilled.match(result)) {
            console.log('[Inventory] ✅ Инвентарь загружен для chatId:', activeChatId);
            console.log('[Inventory] 📦 Категорий:', Object.keys(result.payload.inventory || {}).length);
            console.log('[Inventory] 📊 Прогресс:', result.payload.metadata?.progress || 0);
          } else {
            console.error('[Inventory] ❌ Ошибка загрузки инвентаря:', result.payload);
          }
        })
        .catch((error) => {
          console.error('[Inventory] ❌ Исключение при загрузке инвентаря:', error);
        });
    } else {
      console.warn('[Inventory] ⚠️ activeChatId не найден, пропускаем загрузку инвентаря');
    }
  }, [activeChatId, dispatch]);

  // Слушаем события сканирования в реальном времени
  useEffect(() => {
    // Проверяем, что модуль существует перед созданием NativeEventEmitter
    if (!NativeModules.QrScannerNativeModule) {
      console.warn('[Inventory] QrScannerNativeModule не найден, пропускаем подписку на события');
      return;
    }

    // Используем null вместо модуля, если он не поддерживает addListener
    const module = NativeModules.QrScannerNativeModule;
    if (typeof module.addListener !== 'function') {
      console.warn('[Inventory] QrScannerNativeModule не поддерживает addListener, пропускаем подписку на события');
      return;
    }

    const eventEmitter = new NativeEventEmitter(module);
    const subscription = eventEmitter.addListener('onQrCodeScanned', (event: { code: string; isDuplicate: boolean }) => {
      console.log('[Inventory] Получено событие сканирования в реальном времени:', event);
      
      if (event.isDuplicate) {
        console.log('[Inventory] Дубликат обнаружен:', event.code);
        Alert.alert(
          '⚠️ Код уже сканирован',
          `Код "${event.code}" уже есть в инвентаре.`,
          [{ text: 'OK', style: 'cancel' }]
        );
      } else {
        console.log('[Inventory] Новый код сканирован:', event.code);
        // Добавляем код в список
        setScannedCodes((prev) => {
          if (prev.includes(event.code)) {
            console.log('[Inventory] Код уже в списке (защита от дубликатов)');
            return prev;
          }
          console.log('[Inventory] Добавляем код в список');
          return [...prev, event.code];
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Обработка результата сканирования QR-кодов (одна сессия может вернуть несколько кодов)
  const handleQrCodesDetected = React.useCallback(
    (codes: string[]) => {
      console.log('[Inventory] handleQrCodesDetected вызван с кодами:', codes);
      if (!codes || codes.length === 0) {
        console.log('[Inventory] Пустой массив кодов, игнорируем');
        return;
      }

      let duplicateFound = false;

      setScannedCodes((prev) => {
        console.log('[Inventory] Текущие коды:', prev);
        const updated = [...prev];

        codes.forEach((code) => {
          if (updated.includes(code)) {
            console.log('[Inventory] Дубликат найден:', code);
            duplicateFound = true;
          } else {
            console.log('[Inventory] Добавляем новый код:', code);
            updated.push(code);
          }
        });

        console.log('[Inventory] Обновленный список кодов:', updated);
        return updated;
      });

      if (duplicateFound) {
        console.log('[Inventory] Показываем alert о дубликате');
        Alert.alert(
          'Повторный QR‑код',
          'Вы сканировали тот же QR‑код.',
          [
            {
              text: 'Отмена сканирования',
              style: 'cancel',
            },
            {
              text: 'Продолжить сканировать',
              onPress: () => {
                setIsQrScannerOpen(true);
                navigation.navigate('QrScanner');
              },
            },
          ],
          { cancelable: true }
        );
      }
    },
    [navigation]
  );

  // Обработка результата сканирования при возврате из сканера
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[Inventory] Экран получил фокус');
      setIsQrScannerOpen(false);
      // Проверяем, есть ли результат сканирования в navigation state
      const state = navigation.getState();
      console.log('[Inventory] Navigation state routes:', state.routes.map(r => r.name));
      const qrScannerRoute = state.routes.find((r) => r.name === 'QrScanner');
      
      if (qrScannerRoute?.params) {
        const params = qrScannerRoute.params as any;
        console.log('[Inventory] QR Scanner params:', JSON.stringify(params));
        
        // Проверяем тип результата
        if (params.scanResult === 'duplicate' && params.duplicateCode) {
          // ДУБЛИКАТ! Показываем уведомление
          console.log('[Inventory] Обрабатываем дубликат:', params.duplicateCode);
          Alert.alert(
            '⚠️ Код уже сканирован',
            `Код "${params.duplicateCode}" уже есть в инвентаре.`,
            [{ text: 'OK', style: 'cancel' }]
          );
        } else if (params.scanResult === 'success' && params.qrCodes) {
          // Успешное сканирование новых кодов
          const codes = params.qrCodes as string[] | undefined;
          console.log('[Inventory] Успешное сканирование, codes:', codes);
          if (codes && codes.length > 0) {
            handleQrCodesDetected(codes);
          }
        } else if ('qrCodes' in params) {
          // Обратная совместимость со старым форматом
          const codes = params.qrCodes as string[] | undefined;
          console.log('[Inventory] Обратная совместимость, codes:', codes);
          if (codes && codes.length > 0) {
            handleQrCodesDetected(codes);
          }
        } else {
          console.log('[Inventory] Нет результата сканирования в params');
        }
      } else {
        console.log('[Inventory] QR Scanner route не найден или нет params');
      }
    });

    return unsubscribe;
  }, [navigation, handleQrCodesDetected]);

  // Обработчики для футера
  const handleSearchPress = () => {
    console.log('Search pressed');
    // TODO: Открыть поиск
  };

  // Функция поиска товара по GTIN или штрих-коду
  const findItemByGtin = React.useCallback((gtin: string, barcode?: string): { category: string; itemId: string; item: any } | null => {
    if (!currentInventory?.inventory || !gtin) {
      return null;
    }

    // Проходим по всем категориям
    for (const [category, items] of Object.entries(currentInventory.inventory)) {
      // Проходим по всем товарам в категории
      for (const [itemId, item] of Object.entries(items as Record<string, any>)) {
        // Проверяем, совпадает ли GTIN
        if (item.gtin === gtin) {
          console.log('[Inventory] Товар найден по GTIN:', { gtin, category, itemId, itemName: item.name });
          return {
            category,
            itemId,
            item,
          };
        }
        // Также проверяем штрих-код, если он передан
        if (barcode && item.barcode === barcode) {
          console.log('[Inventory] Товар найден по штрих-коду:', { barcode, category, itemId, itemName: item.name });
          return {
            category,
            itemId,
            item,
          };
        }
      }
    }

    console.log('[Inventory] Товар с GTIN не найден:', gtin);
    return null;
  }, [currentInventory]);

  const handleQrScanPress = async () => {
    if (isQrScannerOpen) {
      // Камера уже открыта - ничего не делаем (пользователь может закрыть кнопкой "Назад")
      return;
    }
    // Открываем камеру напрямую, минуя QrScannerScreen
    try {
      setIsQrScannerOpen(true);
      const { openNativeQrScanner } = await import('../components/QrScanner/native/openNativeQrScanner');
      await openNativeQrScanner(scannedCodes);
    } catch (err) {
      console.error('[Inventory] Ошибка при открытии сканера:', err);
      setIsQrScannerOpen(false);
    }
  };
  
  // Отслеживаем состояние приложения для определения, когда камера закрывается
  const appState = useRef(AppState.currentState);
  
  // Обработка событий сканирования QR кода из футера (поиск товара по GTIN)
  const qrScanSubscriptionRef = useRef<any>(null);
  useEffect(() => {
    if (!isQrScannerOpen) {
      // Убираем подписку, если камера закрыта
      if (qrScanSubscriptionRef.current) {
        qrScanSubscriptionRef.current.remove();
        qrScanSubscriptionRef.current = null;
      }
      return;
    }

    // Слушаем события сканирования QR кода или штрих-кода из футера
    const eventEmitter = new NativeEventEmitter(NativeModules.QrScannerNativeModule);
    const subscription = eventEmitter.addListener('onQrCodeScanned', async (event: { code: string; isDuplicate: boolean; format?: string }) => {
      console.log('[Inventory] Получено событие сканирования из футера:', event);
      
      // Убираем подписку сразу, чтобы не обрабатывать повторные события
      if (qrScanSubscriptionRef.current) {
        qrScanSubscriptionRef.current.remove();
        qrScanSubscriptionRef.current = null;
      }
      
      if (event.isDuplicate) {
        setIsQrScannerOpen(false);
        Alert.alert(
          'Повторный код',
          'Этот код уже был отсканирован.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      const scannedCode = event.code;
      const format = event.format;
      console.log('[Inventory] Отсканирован код из футера:', { code: scannedCode, format });
      
      // Парсим код (QR или штрих-код)
      const parsedCode = parseCode(scannedCode, format);
      if (!parsedCode || !parsedCode.gtin) {
        console.warn('[Inventory] Не удалось извлечь GTIN из кода:', { code: scannedCode, format });
        setIsQrScannerOpen(false);
        Alert.alert(
          'Ошибка',
          parsedCode?.codeType === 'qr' 
            ? 'Не удалось распознать QR код. Убедитесь, что код содержит GTIN (14 цифр после "01").'
            : 'Не удалось распознать штрих-код. Убедитесь, что код валиден.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Закрываем сканер программно
      try {
        await NativeModules.QrScannerNativeModule.closeQrScanner();
        console.log('[Inventory] Камера закрыта программно после сканирования из футера');
      } catch (error) {
        console.warn('[Inventory] Не удалось закрыть камеру программно:', error);
      }
      
      setIsQrScannerOpen(false);
      
      // Ищем товар по GTIN или штрих-коду
      const foundItem = findItemByGtin(parsedCode.gtin, parsedCode.barcode);
      
      if (foundItem) {
        // Товар найден - открываем панель редактирования
        console.log('[Inventory] Открываем панель редактирования для найденного товара:', foundItem);
        setSelectedItem(foundItem);
      } else {
        // Товар не найден - показываем модальное окно для выбора товара и привязки кода
        console.log('[Inventory] Товар не найден, открываем модальное окно для привязки кода');
        setQrBindModal({
          visible: true,
          qrCode: scannedCode,
          gtin: parsedCode.gtin,
          barcode: parsedCode.barcode,
          barcodeFormat: parsedCode.barcodeFormat,
        });
      }
    });
    
    qrScanSubscriptionRef.current = subscription;

    // Отслеживаем закрытие камеры через AppState
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isQrScannerOpen
      ) {
        console.log('[Inventory] Приложение вернулось в foreground, камера закрыта');
        setIsQrScannerOpen(false);
      }
      appState.current = nextAppState;
    });

    return () => {
      if (qrScanSubscriptionRef.current) {
        qrScanSubscriptionRef.current.remove();
        qrScanSubscriptionRef.current = null;
      }
      appStateSubscription.remove();
    };
  }, [isQrScannerOpen, findItemByGtin]);

  // Хук для футера инвентаризации
  const { buttons: footerButtons } = useInventoryFooter({
    onSearchPress: handleSearchPress,
    onQrScanPress: handleQrScanPress,
    isSearchActive: false,
    isQrScannerOpen: isQrScannerOpen,
  });

  // Обработчик обновления товара
  const handleItemUpdate = async (
    category: string,
    itemId: string,
    updatedItem: any,
    historyData?: {
      action: string;
      itemType: 'raw' | 'semifinished';
      oldQuantity: number;
      newQuantity: number;
    }
  ) => {
    if (!activeChatId) return;
    
    try {
      console.log('[Inventory] Обновляем товар:', { category, itemId, updatedItem, historyData, userId: user?.id, userIdType: typeof user?.id });
      
      // Формируем данные истории с автором
      // authorMemberId должен быть числом (Telegram user_id)
      const authorMemberId = user?.id ? (typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10)) : undefined;
      console.log('[Inventory] authorMemberId:', { authorMemberId, originalId: user?.id, type: typeof user?.id });
      
      const historyPayload = historyData
        ? {
            ...historyData,
            authorMemberId: isNaN(authorMemberId as number) ? undefined : authorMemberId,
          }
        : undefined;
      
      // Обновляем через API (точечное обновление одного товара)
      await updateInventoryItemApi(activeChatId, category, itemId, updatedItem, historyPayload);
      
      // Перезагружаем инвентарь для синхронизации
      await dispatch(fetchChatInventory(activeChatId));
      
      // Обновляем выбранный товар в панели
      if (selectedItem && selectedItem.category === category && selectedItem.itemId === itemId) {
        setSelectedItem({
          ...selectedItem,
          item: updatedItem,
        });
      }
    } catch (error: any) {
      console.error('[Inventory] Ошибка при обновлении товара:', error);
      Alert.alert('Ошибка', error.response?.data?.detail || error.message || 'Не удалось обновить товар');
    }
  };

  // Обработчик фотографирования товара
  const handleItemPhotoPress = async (category: string, itemId: string, item: any) => {
    if (!activeChatId) {
      Alert.alert('Ошибка', 'ChatId не найден');
      return;
    }

    try {
      Alert.alert(
        'Фото товара',
        'Выберите источник фото',
        [
          {
            text: 'Камера',
            onPress: () => {
              launchCamera(
                {
                  mediaType: 'photo',
                  quality: 0.8,
                  maxWidth: 1920,
                  maxHeight: 1920,
                  saveToPhotos: false,
                },
                async (response: any) => {
                  if (response.didCancel) {
                    console.log('[Inventory] Пользователь отменил фотографирование');
                    return;
                  }
                  
                  if (response.errorMessage) {
                    console.error('[Inventory] Ошибка камеры:', response.errorMessage);
                    Alert.alert('Ошибка', 'Не удалось сделать фото: ' + response.errorMessage);
                    return;
                  }

                  if (response.assets && response.assets[0]) {
                    const photoUri = response.assets[0].uri;
                    if (!photoUri) {
                      Alert.alert('Ошибка', 'Не удалось получить фото');
                      return;
                    }

                    // Загружаем фото на сервер
                    await uploadItemPhoto(activeChatId, category, itemId, photoUri, item);
                  }
                }
              );
            },
          },
          {
            text: 'Галерея',
            onPress: () => {
              launchImageLibrary(
                {
                  mediaType: 'photo',
                  quality: 0.8,
                  maxWidth: 1920,
                  maxHeight: 1920,
                },
                async (response: any) => {
                  if (response.didCancel) {
                    console.log('[Inventory] Пользователь отменил выбор фото');
                    return;
                  }
                  
                  if (response.errorMessage) {
                    console.error('[Inventory] Ошибка выбора фото:', response.errorMessage);
                    Alert.alert('Ошибка', 'Не удалось выбрать фото: ' + response.errorMessage);
                    return;
                  }

                  if (response.assets && response.assets[0]) {
                    const photoUri = response.assets[0].uri;
                    if (!photoUri) {
                      Alert.alert('Ошибка', 'Не удалось получить фото');
                      return;
                    }

                    // Загружаем фото на сервер
                    await uploadItemPhoto(activeChatId, category, itemId, photoUri, item);
                  }
                }
              );
            },
          },
          {
            text: 'Отмена',
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      console.error('[Inventory] Ошибка при открытии камеры/галереи:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось открыть камеру. Убедитесь, что установлена библиотека react-native-image-picker.\n\nУстановите: npm install react-native-image-picker'
      );
    }
  };

  // Функция загрузки фото товара
  const uploadItemPhoto = async (
    chatId: string,
    category: string,
    itemId: string,
    photoUri: string,
    currentItem: any
  ) => {
    if (uploadingPhoto) {
      console.log('[Inventory] Загрузка фото уже выполняется, пропускаем');
      return;
    }

    setUploadingPhoto(true);
    try {
      console.log('[Inventory] Загружаем фото товара:', { chatId, category, itemId, photoUri });

      // Импортируем axiosInstance для загрузки с автоматическим добавлением токена
      const { axiosInstance } = await import('../../../services/api');

      // Создаем FormData для загрузки файла
      const formData = new FormData();
      formData.append('photo', {
        uri: photoUri,
        type: 'image/jpeg',
        name: `item_${itemId}_${Date.now()}.jpg`,
      } as any);

      // Загружаем фото на сервер через axiosInstance (токен добавится автоматически)
      const uploadResponse = await axiosInstance.post<{ photoUrl?: string; photo_url?: string }>(
        `/v1/inventory/${chatId}/items/${encodeURIComponent(category)}/${encodeURIComponent(itemId)}/photo`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const photoUrl = uploadResponse.data.photoUrl || uploadResponse.data.photo_url;

      if (!photoUrl) {
        throw new Error('Сервер не вернул URL фото');
      }

      console.log('[Inventory] Фото успешно загружено:', photoUrl);

      // Обновляем товар с URL фото
      const updatedItem = {
        ...currentItem,
        photoUrl,
        lastUpdated: new Date().toISOString(),
      };

      await handleItemUpdate(category, itemId, updatedItem);

      Alert.alert('Успешно', 'Фото товара сохранено');
    } catch (error: any) {
      console.error('[Inventory] Ошибка при загрузке фото:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Не удалось загрузить фото';
      Alert.alert('Ошибка', errorMessage);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Обработчик привязки QR кода или штрих-кода к товару
  const handleQrCodeBind = async (
    category: string,
    itemId: string,
    qrData: string,
    gtin: string,
    barcode?: string,
    barcodeFormat?: string
  ) => {
    if (!activeChatId) {
      throw new Error('ChatId не предоставлен');
    }

    // Получаем текущий товар
    const currentItem = currentInventory?.inventory?.[category]?.[itemId];
    if (!currentItem) {
      throw new Error('Товар не найден');
    }

    // Обновляем товар с данными кода (QR или штрих-код)
    const updatedItem = {
      ...currentItem,
      qrData: qrData || currentItem.qrData, // Сохраняем QR код, если он есть
      gtin,
      // Если передан штрих-код, сохраняем его (как fallback, если QR кода нет)
      ...(barcode && { barcode, barcodeFormat }),
      lastUpdated: new Date().toISOString(),
    };

    // Обновляем через API
    await updateInventoryItemApi(activeChatId, category, itemId, updatedItem);

    // Перезагружаем инвентарь для синхронизации
    await dispatch(fetchChatInventory(activeChatId));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#1A1A1A' : '#FFFFFF'}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon 
            name="arrow-back" 
            size={24} 
            color={isDark ? '#FFFFFF' : '#000000'} 
          />
        </Pressable>
        
        <View style={styles.headerTitleContainer}>
          <Icon 
            name="inventory-2" 
            size={24} 
            color="#FF6B35" 
            style={styles.headerIcon}
          />
          <Text style={styles.headerTitle}>Инвентарь</Text>
        </View>
        
        <View style={styles.headerRight}>
          {/* Placeholder for future actions */}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading && !currentInventory ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Загрузка инвентаря...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Icon name="error-outline" size={48} color="#FF6B35" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                if (activeChatId) {
                  dispatch(fetchChatInventory(activeChatId));
                }
              }}
            >
              <Text style={styles.retryButtonText}>Повторить</Text>
            </Pressable>
          </View>
        ) : isEmpty ? (
          <EmptyInventoryState
            title="Инвентарь пуст"
            description="Начните добавлять товары в инвентарь для отслеживания остатков"
            icon="inventory-2"
            onAction={() => {
              // TODO: Navigate to add item screen
              console.log('Add item action');
            }}
            actionLabel="Добавить товар"
          />
        ) : (
          <ScrollView 
            style={styles.inventoryContent} 
            contentContainerStyle={styles.inventoryContentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Заголовок с информацией о чате */}
            {currentInventory && (
              <View style={styles.chatInfoContainer}>
                <Text style={styles.chatTitle}>{currentInventory.chat_title}</Text>
                {currentInventory.metadata && (
                  <Text style={styles.progressText}>
                    Прогресс: {currentInventory.metadata.progress}%
                  </Text>
                )}
              </View>
            )}

            {/* Отображаем категории и товары */}
            {currentInventory?.inventory && (
              <View style={styles.categoriesContainer}>
                {Object.entries(currentInventory.inventory).map(([category, items]) => {
                  const isExpanded = expandedCategories.has(category);
                  
                  // Функция для переключения категории (без useCallback, т.к. внутри map)
                  const handleToggleCategory = () => {
                    // Очищаем предыдущий таймер
                    if (toggleTimeoutRef.current) {
                      clearTimeout(toggleTimeoutRef.current);
                    }
                    
                    // Откладываем обновление состояния для предотвращения фризов при множественных раскрытиях
                    toggleTimeoutRef.current = setTimeout(() => {
                      setExpandedCategories((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(category)) {
                          newSet.delete(category);
                        } else {
                          newSet.add(category);
                        }
                        return newSet;
                      });
                    }, 50); // Небольшая задержка для батчинга обновлений
                  };
                  
                  return (
                    <CategoryItem
                      key={category}
                      category={category}
                      items={items}
                      isExpanded={isExpanded}
                      onToggle={handleToggleCategory}
                      onItemPress={(itemId, item) => {
                        setSelectedItem({
                          category,
                          itemId,
                          item,
                        });
                      }}
                      onPhotoPress={(itemId, item) => {
                        handleItemPhotoPress(category, itemId, item);
                      }}
                      isDark={isDark}
                      styles={styles}
                    />
                  );
                })}
              </View>
            )}

            {/* Отсканированные коды (временно, для тестирования) */}
            {scannedCodes.length > 0 && (
              <View style={styles.scannedSection}>
                <Text style={styles.scannedListTitle}>Отсканированные коды</Text>
                <View style={styles.scannedListContainer}>
                  {scannedCodes.map((code, index) => (
                    <View key={`${code}-${index}`} style={styles.scannedItem}>
                      <View style={styles.scannedItemIndex}>
                        <Text style={styles.scannedItemIndexText}>{index + 1}</Text>
                      </View>
                      <View style={styles.scannedItemContent}>
                        <Text numberOfLines={1} style={styles.scannedItemCode}>
                          {code}
                        </Text>
                        <Text style={styles.scannedItemMeta}>
                          Длина: {code.length} символов
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Footer */}
      <Footer buttons={footerButtons} variant="compact" />

      {/* Панель редактирования товара */}
      {selectedItem && (
        <ItemEditPanel
          visible={!!selectedItem}
          category={selectedItem.category}
          itemId={selectedItem.itemId}
          item={selectedItem.item}
          onClose={() => setSelectedItem(null)}
          onUpdate={handleItemUpdate}
          chatId={activeChatId || undefined}
        />
      )}

      {/* Модальное окно для привязки QR кода к товару */}
      <QrCodeBindModal
        visible={qrBindModal.visible}
        onClose={() => setQrBindModal({ visible: false, qrCode: '', gtin: '', barcode: undefined, barcodeFormat: undefined })}
        qrCode={qrBindModal.qrCode}
        gtin={qrBindModal.gtin}
        barcode={qrBindModal.barcode}
        barcodeFormat={qrBindModal.barcodeFormat}
        onBind={handleQrCodeBind}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: 'light' | 'dark', insets: any) => {
  const isDark = theme === 'dark';
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
    },
    
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 6,
      paddingTop: Platform.OS === 'android' 
        ? (StatusBar.currentHeight || 0) + 6 
        : insets.top + 6,
      backgroundColor: 'rgba(0, 0, 0, 0)',
      borderBottomWidth: 0,
    },
    
    backButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
    
    backButtonPressed: {
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.1)',
    },
    
    headerTitleContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 16,
    },
    
    headerIcon: {
      marginRight: 8,
    },
    
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#000000',
    },
    
    headerRight: {
      width: 40,
    },
    
    content: {
      flex: 1,
      // Убеждаемся, что контент не выходит за границы
      overflow: 'hidden',
    },
    
    inventoryContent: {
      flex: 1,
      padding: 16,
    },

    inventoryContentContainer: {
      paddingBottom: 20,
    },

    scannedListTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
      color: isDark ? '#FFFFFF' : '#000000',
    },

    scannedListContainer: {
      borderRadius: 12,
      padding: 12,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    },

    scannedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    },

    scannedItemIndex: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      backgroundColor: 'rgba(255, 95, 31, 0.12)',
    },

    scannedItemIndexText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FF5F1F',
    },

    scannedItemContent: {
      flex: 1,
    },

    scannedItemCode: {
      fontSize: 14,
      color: isDark ? '#FFFFFF' : '#111827',
    },

    scannedItemMeta: {
      marginTop: 2,
      fontSize: 12,
      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },

    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    },

    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },

    errorText: {
      marginTop: 16,
      marginBottom: 24,
      fontSize: 16,
      textAlign: 'center',
      color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    },

    retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: '#FF6B35',
    },

    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },

    chatInfoContainer: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      marginBottom: 16,
    },

    chatTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#000000',
      marginBottom: 8,
    },

    progressText: {
      fontSize: 14,
      color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    },

    categoriesContainer: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },

    categorySection: {
      marginBottom: 12,
    },

    categoryContainer: {
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      overflow: 'hidden',
    },

    categoryHeader: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: 'transparent',
    },

    categoryHeaderPressed: {
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.08)' : 'rgba(255, 107, 53, 0.06)',
    },

    categoryHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    categoryIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    categoryTitleContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    categoryTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#000000',
      flex: 1,
    },

    categoryCountBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.15)',
      minWidth: 32,
      alignItems: 'center',
    },

    categoryCount: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF6B35',
    },

    categoryItemsContainer: {
      paddingTop: 4,
      paddingBottom: 12,
      paddingHorizontal: 12,
      backgroundColor: 'transparent',
    },

    categoryItems: {
      flex: 1,
    },
    categoryItemsContent: {
      gap: 10,
      paddingBottom: 4,
    },

    animatedItemWrapper: {
      marginBottom: 10,
    },

    itemCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 8,
      elevation: 3,
      marginHorizontal: 2,
      marginVertical: 2,
    },

    itemCardPressed: {
      backgroundColor: isDark ? '#222222' : '#F5F5F5',
      borderColor: '#FF6B35',
      borderWidth: 1.5,
      transform: [{ scale: 0.995 }],
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: 10,
      elevation: 4,
    },

    itemIconContainer: {
      width: 72,
      height: 72,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.1)' : 'rgba(255, 107, 53, 0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
      position: 'relative',
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.15)',
      alignSelf: 'center',
    },
    itemPhoto: {
      width: '100%',
      height: '100%',
      borderRadius: 14.5,
    },
    cameraIconOverlay: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
    },

    itemContent: {
      flex: 1,
      justifyContent: 'space-between',
    },

    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
      gap: 10,
    },

    itemName: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1A1A1A',
      lineHeight: 22,
      letterSpacing: 0.1,
    },

    itemUnitBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 107, 53, 0.3)' : 'rgba(255, 107, 53, 0.2)',
    },

    itemUnit: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FF6B35',
      letterSpacing: 0.3,
    },

    itemCodeIndicators: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 12,
    },

    codeIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.12)' : 'rgba(255, 107, 53, 0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 107, 53, 0.25)' : 'rgba(255, 107, 53, 0.2)',
    },

    codeIndicatorText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#FF6B35',
      letterSpacing: 0.2,
    },

    itemInfo: {
      gap: 8,
    },

    itemInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    itemInfoLabel: {
      fontSize: 14,
      color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
      fontWeight: '500',
    },

    itemInfoValue: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1A1A1A',
      marginLeft: 'auto',
    },

    outOfStockBadge: {
      marginLeft: 'auto',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)',
    },

    outOfStockLabel: {
      fontSize: 12,
      color: '#FF6B35',
      fontWeight: '600',
    },

    itemArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
      alignSelf: 'center',
    },

    scannedSection: {
      marginTop: 24,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
  });
};

export default InventoryScreen;

