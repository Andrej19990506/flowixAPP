import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Alert,
  NativeModules,
  NativeEventEmitter,
  AppState,
} from 'react-native';
// Используем View с градиентным фоном через стили
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAppDispatch } from '../../../store/hooks';
import { saveItemNotes, fetchItemHistory } from '../../../store/slices/inventorySlice';
import NotesModal from './NotesModal';
import ItemHistoryModal from './ItemHistoryModal';
import SuccessNotification from './SuccessNotification';
import { parseCode, parseQrCode } from '../../../utils/qrParser';

interface InventoryItem {
  name?: string;
  unit?: string;
  qrData?: string; // Полный QR код
  gtin?: string; // GTIN (14 цифр после "01")
  barcode?: string; // Штрих-код (EAN-13, EAN-8, UPC-A, UPC-E и т.д.)
  barcodeFormat?: string; // Формат штрих-кода
  raw?: {
    quantity: number;
    isOutOfStock?: boolean;
    notes?: string;
  };
  semifinished?: {
    quantity: number;
    notes?: string;
  };
}

interface ItemEditPanelProps {
  visible: boolean;
  category: string;
  itemId: string;
  item: InventoryItem;
  onClose: () => void;
  onUpdate: (
    category: string,
    itemId: string,
    item: InventoryItem,
    historyData?: {
      action: string;
      itemType: 'raw' | 'semifinished';
      oldQuantity: number;
      newQuantity: number;
    }
  ) => void;
  chatId?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;
const isMediumScreen = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
const isLargeScreen = SCREEN_WIDTH >= 414;

// Адаптивные размеры
const getResponsiveSize = (small: number, medium: number, large: number) => {
  if (isSmallScreen) return small;
  if (isMediumScreen) return medium;
  return large;
};

const ItemEditPanel: React.FC<ItemEditPanelProps> = ({
  visible,
  category,
  itemId,
  item,
  onClose,
  onUpdate,
  chatId,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';
  const styles = createStyles(isDark, insets);

  const [currentItem, setCurrentItem] = useState<InventoryItem>(item);
  const [rawActiveInput, setRawActiveInput] = useState<'add' | 'subtract' | null>(null);
  const [semifinishedActiveInput, setSemifinishedActiveInput] = useState<'add' | 'subtract' | null>(null);
  const [rawInputValue, setRawInputValue] = useState('');
  const [semifinishedInputValue, setSemifinishedInputValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOutOfStock, setIsOutOfStock] = useState(item.raw?.isOutOfStock || false);
  const [rawInputFocused, setRawInputFocused] = useState(false);
  const [semifinishedInputFocused, setSemifinishedInputFocused] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [notes, setNotes] = useState(item.raw?.notes || item.semifinished?.notes || '');
  const [isAddSemifinishedPressed, setIsAddSemifinishedPressed] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [successNotification, setSuccessNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    gtin?: string;
    codeType?: 'qr' | 'barcode';
  }>({
    visible: false,
    title: '',
    message: '',
  });
  
  const dispatch = useAppDispatch();
  
  const slideAnim = useRef(new Animated.Value(1)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const rawInputRef = useRef<TextInput>(null);
  const semifinishedInputRef = useRef<TextInput>(null);
  const rawInputScale = useRef(new Animated.Value(0.96)).current;
  const semifinishedInputScale = useRef(new Animated.Value(0.96)).current;
  const rawInputOpacity = useRef(new Animated.Value(0)).current;
  const semifinishedInputOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setCurrentItem(item);
    setIsOutOfStock(item.raw?.isOutOfStock || false);
    setNotes(item.raw?.notes || item.semifinished?.notes || '');
  }, [item]);

  // Отслеживаем состояние приложения для определения, когда камера закрывается
  const appState = useRef(AppState.currentState);
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

    // Слушаем события сканирования QR кода
    const eventEmitter = new NativeEventEmitter(NativeModules.QrScannerNativeModule);
    const subscription = eventEmitter.addListener('onQrCodeScanned', async (event: { code: string; isDuplicate: boolean; format?: string }) => {
      console.log('[ItemEditPanel] Получено событие сканирования:', event);
      
      // Убираем подписку сразу, чтобы не обрабатывать повторные события
      if (qrScanSubscriptionRef.current) {
        qrScanSubscriptionRef.current.remove();
        qrScanSubscriptionRef.current = null;
      }
      
      if (event.isDuplicate) {
        setIsQrScannerOpen(false);
        Alert.alert(
          'Повторный QR‑код',
          'Этот QR‑код уже был отсканирован.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      const scannedCode = event.code;
      const format = event.format;
      console.log('[ItemEditPanel] Отсканирован код:', { code: scannedCode, format });
      
      // Парсим код (QR или штрих-код)
      const parsed = parseCode(scannedCode, format);
      if (parsed && parsed.gtin) {
        // Обновляем товар с данными кода
        const updatedItem = {
          ...currentItem,
          // Сохраняем QR код, если это QR
          ...(parsed.qrData && { qrData: parsed.qrData }),
          // Сохраняем штрих-код, если это штрих-код (как fallback, если QR кода нет)
          ...(parsed.barcode && { barcode: parsed.barcode, barcodeFormat: parsed.barcodeFormat }),
          gtin: parsed.gtin,
          lastUpdated: new Date().toISOString(),
        };
        
        setCurrentItem(updatedItem);
        setIsUpdating(true);
        
        try {
          await onUpdate(category, itemId, updatedItem);
          const codeType = parsed.codeType === 'qr' ? 'QR код' : 'штрих-код';
          console.log(`[ItemEditPanel] ${codeType} успешно привязан к товару:`, {
            ...(parsed.qrData && { qrData: parsed.qrData }),
            ...(parsed.barcode && { barcode: parsed.barcode, barcodeFormat: parsed.barcodeFormat }),
            gtin: parsed.gtin,
          });
          
          // Закрываем сканер программно
          try {
            await NativeModules.QrScannerNativeModule.closeQrScanner();
            console.log('[ItemEditPanel] Камера закрыта программно');
          } catch (error) {
            console.warn('[ItemEditPanel] Не удалось закрыть камеру программно:', error);
          }
          
          setIsQrScannerOpen(false);
          
          // Показываем красивое уведомление об успешной привязке
          const codeTypeName = parsed.codeType === 'qr' ? 'QR код' : 'штрих-код';
          setSuccessNotification({
            visible: true,
            title: `${codeTypeName} привязан`,
            message: `${codeTypeName === 'QR код' ? 'QR код' : 'Штрих-код'} успешно сохранен в товар.`,
            gtin: parsed.gtin || undefined,
            codeType: parsed.codeType,
          });
        } catch (error: any) {
          console.error('[ItemEditPanel] Ошибка при сохранении QR кода:', error);
          setCurrentItem(item);
          setIsQrScannerOpen(false);
          Alert.alert(
            'Ошибка',
            error.response?.data?.detail || error.message || 'Не удалось сохранить QR код'
          );
        } finally {
          setIsUpdating(false);
        }
      } else {
        console.warn('[ItemEditPanel] Не удалось распарсить код или GTIN не найден:', scannedCode);
        setIsQrScannerOpen(false);
        const codeType = parsed?.codeType === 'qr' ? 'QR код' : 'штрих-код';
        Alert.alert(
          'Ошибка',
          parsed?.codeType === 'qr'
            ? 'Не удалось распознать QR код. Убедитесь, что код начинается с "01" и содержит GTIN (14 цифр).'
            : 'Не удалось распознать штрих-код. Убедитесь, что код валиден.',
          [{ text: 'OK', style: 'default' }]
        );
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
        console.log('[ItemEditPanel] Приложение вернулось в foreground, камера закрыта');
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
  }, [isQrScannerOpen, currentItem, category, itemId, onUpdate, item]);


  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
          overshootClamping: false,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Анимация появления инпута для сырья
  useEffect(() => {
    if (rawActiveInput) {
      Animated.parallel([
        Animated.spring(rawInputScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
          overshootClamping: false,
        }),
        Animated.timing(rawInputOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => rawInputRef.current?.focus(), 220);
    } else {
      Animated.parallel([
        Animated.timing(rawInputScale, {
          toValue: 0.96,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(rawInputOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [rawActiveInput]);

  // Анимация появления инпута для полуфабриката
  useEffect(() => {
    if (semifinishedActiveInput) {
      Animated.parallel([
        Animated.spring(semifinishedInputScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
          overshootClamping: false,
        }),
        Animated.timing(semifinishedInputOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => semifinishedInputRef.current?.focus(), 220);
    } else {
      Animated.parallel([
        Animated.timing(semifinishedInputScale, {
          toValue: 0.96,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(semifinishedInputOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [semifinishedActiveInput]);

  // Обработка сырья: открытие инпута
  const handleRawPlusClick = () => {
    setRawActiveInput('add');
    setRawInputValue('');
  };

  const handleRawMinusClick = () => {
    setRawActiveInput('subtract');
    setRawInputValue('');
  };

  // Сохранение изменения для сырья
  const handleRawSubmit = useCallback(async () => {
    const value = parseInt(rawInputValue, 10);
    if (isNaN(value) || value < 0 || !rawActiveInput) {
      setRawInputValue('');
      setRawActiveInput(null);
      rawInputRef.current?.blur();
      return;
    }

    const currentQuantity = currentItem.raw?.quantity || 0;
    const newQuantity = rawActiveInput === 'add' 
      ? currentQuantity + value 
      : Math.max(0, currentQuantity - value);

    const updatedItem = {
      ...currentItem,
      // Сохраняем существующие QR данные, если они есть
      qrData: currentItem.qrData,
      gtin: currentItem.gtin,
      raw: {
        ...currentItem.raw,
        quantity: newQuantity,
        filled: newQuantity > 0,
        isOutOfStock: false,
      },
    };

    setCurrentItem(updatedItem);
    setRawInputValue('');
    setRawActiveInput(null);
    setRawInputFocused(false);
    rawInputRef.current?.blur();

    setIsUpdating(true);
    try {
      // Формируем данные для истории
      // Используем 'set' для прямого ввода значения через input
      const historyData = {
        action: 'set',
        itemType: 'raw' as const,
        oldQuantity: currentQuantity,
        newQuantity: newQuantity,
      };
      
      await onUpdate(category, itemId, updatedItem, historyData);
      
      // Загружаем историю после успешного обновления
      if (chatId) {
        dispatch(
          fetchItemHistory({
            chatId,
            itemId,
            category,
            itemName: currentItem.name || itemId,
            background: true,
          })
        );
      }
    } catch (error) {
      setCurrentItem(item);
      console.error('[ItemEditPanel] Ошибка обновления сырья:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [rawInputValue, rawActiveInput, currentItem, category, itemId, onUpdate, item, chatId, dispatch]);

  // Отмена редактирования сырья
  const handleRawCancel = () => {
    setRawInputValue('');
    setRawActiveInput(null);
    setRawInputFocused(false);
    rawInputRef.current?.blur();
  };

  // Обработка полуфабриката: открытие инпута
  const handleSemifinishedPlusClick = () => {
    setSemifinishedActiveInput('add');
    setSemifinishedInputValue('');
  };

  const handleSemifinishedMinusClick = () => {
    setSemifinishedActiveInput('subtract');
    setSemifinishedInputValue('');
  };

  // Сохранение изменения для полуфабриката
  const handleSemifinishedSubmit = useCallback(async () => {
    const value = parseInt(semifinishedInputValue, 10);
    if (isNaN(value) || value < 0 || !semifinishedActiveInput) {
      setSemifinishedInputValue('');
      setSemifinishedActiveInput(null);
      semifinishedInputRef.current?.blur();
      return;
    }

    const currentQuantity = currentItem.semifinished?.quantity || 0;
    const newQuantity = semifinishedActiveInput === 'add' 
      ? currentQuantity + value 
      : Math.max(0, currentQuantity - value);

    const updatedItem = {
      ...currentItem,
      semifinished: {
        ...currentItem.semifinished,
        quantity: newQuantity,
        filled: newQuantity > 0,
      },
    };

    setCurrentItem(updatedItem);
    setSemifinishedInputValue('');
    setSemifinishedActiveInput(null);
    setSemifinishedInputFocused(false);
    semifinishedInputRef.current?.blur();

    setIsUpdating(true);
    try {
      // Формируем данные для истории
      // Используем 'set' для прямого ввода значения через input
      const historyData = {
        action: 'set',
        itemType: 'semifinished' as const,
        oldQuantity: currentQuantity,
        newQuantity: newQuantity,
      };
      
      await onUpdate(category, itemId, updatedItem, historyData);
      
      // Загружаем историю после успешного обновления
      if (chatId) {
        dispatch(
          fetchItemHistory({
            chatId,
            itemId,
            category,
            itemName: currentItem.name || itemId,
            background: true,
          })
        );
      }
    } catch (error) {
      setCurrentItem(item);
      console.error('[ItemEditPanel] Ошибка обновления полуфабриката:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [semifinishedInputValue, semifinishedActiveInput, currentItem, category, itemId, onUpdate, item, chatId, dispatch]);

  // Отмена редактирования полуфабриката
  const handleSemifinishedCancel = () => {
    setSemifinishedInputValue('');
    setSemifinishedActiveInput(null);
    setSemifinishedInputFocused(false);
    semifinishedInputRef.current?.blur();
  };

  // Обработчик "Нет в наличии" для сырья
  const handleOutOfStockToggle = useCallback(async () => {
    const newOutOfStock = !isOutOfStock;
    setIsOutOfStock(newOutOfStock);

    const updatedItem = {
      ...currentItem,
      raw: {
        ...currentItem.raw,
        isOutOfStock: newOutOfStock,
        quantity: newOutOfStock ? 0 : (currentItem.raw?.quantity || 0),
        filled: !newOutOfStock && (currentItem.raw?.quantity || 0) > 0,
      },
    };

    setCurrentItem(updatedItem);
    
    setIsUpdating(true);
    try {
      // Формируем данные для истории при изменении статуса "нет в наличии"
      const oldQuantity = currentItem.raw?.quantity || 0;
      const newQuantity = newOutOfStock ? 0 : oldQuantity;
      const historyData = {
        action: 'set',
        itemType: 'raw' as const,
        oldQuantity: oldQuantity,
        newQuantity: newQuantity,
      };
      
      await onUpdate(category, itemId, updatedItem, historyData);
      
      // Загружаем историю после успешного обновления
      if (chatId) {
        dispatch(
          fetchItemHistory({
            chatId,
            itemId,
            category,
            itemName: currentItem.name || itemId,
            background: true,
          })
        );
      }
    } catch (error) {
      setIsOutOfStock(!newOutOfStock);
      setCurrentItem(item);
      console.error('[ItemEditPanel] Ошибка обновления "нет в наличии":', error);
    } finally {
      setIsUpdating(false);
    }
  }, [isOutOfStock, currentItem, category, itemId, onUpdate, item, chatId, dispatch]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT],
  });

  // Обработчики для заметок
  const handleNotesSave = async (newNotes: string) => {
    if (!chatId) {
      console.warn('[ItemEditPanel] chatId не предоставлен, невозможно сохранить заметки');
      return;
    }

    setNotes(newNotes);
    
    try {
      const rawNotes = currentItem.raw ? newNotes : undefined;
      const semifinishedNotes = currentItem.semifinished ? newNotes : undefined;
      
      await dispatch(saveItemNotes({
        chatId,
        category,
        itemName: itemId,
        rawNotes,
        semifinishedNotes,
      })).unwrap();

      // Обновляем локальное состояние товара
      const updatedItem = {
        ...currentItem,
        lastUpdated: new Date().toISOString(),
      };
      
      if (updatedItem.raw) {
        updatedItem.raw = {
          ...updatedItem.raw,
          notes: newNotes,
        };
      }
      if (updatedItem.semifinished) {
        updatedItem.semifinished = {
          ...updatedItem.semifinished,
          notes: newNotes,
        };
      }

      setCurrentItem(updatedItem);
      onUpdate(category, itemId, updatedItem);
    } catch (error) {
      console.error('[ItemEditPanel] Ошибка при сохранении заметок:', error);
      setNotes(item.raw?.notes || item.semifinished?.notes || '');
    }
  };

  const handleNotesDelete = async () => {
    await handleNotesSave('');
  };

  // Обработчик добавления полуфабриката
  const handleAddSemifinished = useCallback(async () => {
    const newItem = {
      ...currentItem,
      semifinished: {
        quantity: 0,
        filled: false,
        notes: '',
      },
      lastUpdated: new Date().toISOString(),
    };

    setCurrentItem(newItem);
    
    setIsUpdating(true);
    try {
      await onUpdate(category, itemId, newItem);
      
      // Загружаем историю после успешного обновления
      if (chatId) {
        dispatch(
          fetchItemHistory({
            chatId,
            itemId,
            category,
            itemName: currentItem.name || itemId,
            background: true,
          })
        );
      }
    } catch (error) {
      setCurrentItem(item);
      console.error('[ItemEditPanel] Ошибка добавления полуфабриката:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [currentItem, category, itemId, onUpdate, item, chatId, dispatch]);

  // Обработчик удаления полуфабриката
  const handleRemoveSemifinished = useCallback(async () => {
    const newItem = {
      ...currentItem,
      semifinished: undefined,
      lastUpdated: new Date().toISOString(),
    };

    setCurrentItem(newItem);
    
    setIsUpdating(true);
    try {
      await onUpdate(category, itemId, newItem);
      
      // Загружаем историю после успешного обновления
      if (chatId) {
        dispatch(
          fetchItemHistory({
            chatId,
            itemId,
            category,
            itemName: currentItem.name || itemId,
            background: true,
          })
        );
      }
    } catch (error) {
      setCurrentItem(item);
      console.error('[ItemEditPanel] Ошибка удаления полуфабриката:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [currentItem, category, itemId, onUpdate, item, chatId, dispatch]);

  // Обработчик привязки QR кода
  const handleBindQrCode = useCallback(async () => {
    try {
      setIsQrScannerOpen(true);
      
      // Открываем QR сканер
      // Promise резолвится сразу после открытия Activity, результаты приходят через события
      const { openNativeQrScanner } = await import('./QrScanner/native/openNativeQrScanner');
      await openNativeQrScanner();
      
      console.log('[ItemEditPanel] QR сканер открыт, ожидаем события сканирования');
      // События обрабатываются в useEffect выше
    } catch (error: any) {
      console.error('[ItemEditPanel] Ошибка при сканировании QR кода:', error);
      setIsQrScannerOpen(false);
      Alert.alert(
        'Ошибка',
        error.message || 'Не удалось открыть сканер QR кода'
      );
    }
  }, []);

  const renderValueDisplay = (value: number, unit?: string) => (
    <View style={styles.valueCard}>
      <View style={styles.valueContent}>
        <Text style={styles.valueText}>{value}</Text>
        {value > 0 && (
          <View style={styles.valueIndicator}>
            <Icon 
              name="check" 
              size={getResponsiveSize(10, 12, 14)} 
              color="#FFFFFF" 
            />
          </View>
        )}
      </View>
      {unit && (
        <Text style={styles.valueUnit} numberOfLines={1}>
          {unit}
        </Text>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.panel,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.itemName} numberOfLines={2}>
                {currentItem.name || itemId}
              </Text>
              {currentItem.unit && (
                <Text style={styles.itemUnit} numberOfLines={1}>
                  {currentItem.unit}
                </Text>
              )}
            </View>
            <Pressable 
              onPress={onClose} 
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon 
                name="close" 
                size={getResponsiveSize(20, 22, 24)} 
                color={isDark ? '#FFFFFF' : '#1A1A1A'} 
              />
            </Pressable>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
          >
            {/* Секция заметок и истории */}
            <View style={styles.notesAndHistorySection}>
              {/* Заметки */}
              <View style={styles.notesSection}>
                <Pressable
                  onPress={() => setIsNotesModalOpen(true)}
                  style={({ pressed }) => [
                    styles.notesCard,
                    pressed && styles.notesCardPressed,
                  ]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.notesIconContainer}>
                    <Icon name="note" size={getResponsiveSize(20, 22, 24)} color="#FF6B35" />
                  </View>
                  <View style={styles.notesContentContainer}>
                    <Text style={styles.notesTitle}>Заметки</Text>
                    {notes ? (
                      <Text style={styles.notesPreview} numberOfLines={1}>
                        {notes}
                      </Text>
                    ) : (
                      <Text style={styles.notesPlaceholder} numberOfLines={1}>
                        Добавить заметки
                      </Text>
                    )}
                  </View>
                  <View style={styles.notesArrowContainer}>
                    <Icon 
                      name="chevron-right" 
                      size={getResponsiveSize(18, 20, 22)} 
                      color={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'} 
                    />
                  </View>
                </Pressable>
              </View>

              {/* История */}
              <View style={styles.historySection}>
                <Pressable
                  onPress={() => setIsHistoryModalOpen(true)}
                  style={({ pressed }) => [
                    styles.historyCard,
                    pressed && styles.historyCardPressed,
                  ]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.historyIconContainer}>
                    <Icon name="history" size={getResponsiveSize(20, 22, 24)} color="#FF6B35" />
                  </View>
                  <View style={styles.historyContentContainer}>
                    <Text style={styles.historyTitle}>История</Text>
                    <Text style={styles.historyPreview} numberOfLines={1}>
                      Изменения
                    </Text>
                  </View>
                  <View style={styles.historyArrowContainer}>
                    <Icon 
                      name="chevron-right" 
                      size={getResponsiveSize(18, 20, 22)} 
                      color={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'} 
                    />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Секция QR кода */}
            <View style={styles.qrSection}>
              {currentItem.qrData || currentItem.barcode || currentItem.gtin ? (
                <View style={styles.qrCodeLabel}>
                  <View style={styles.qrCodeLabelIcon}>
                    <Icon 
                      name={currentItem.qrData ? "qr-code-2" : "barcode-reader"} 
                      size={getResponsiveSize(18, 20, 22)} 
                      color="#FF6B35" 
                    />
                  </View>
                  <View style={styles.qrCodeLabelContent}>
                    <Text style={styles.qrCodeLabelText}>
                      {currentItem.qrData ? 'QR код привязан' : currentItem.barcode ? 'Штрих-код привязан' : 'Код привязан'}
                    </Text>
                    {currentItem.gtin && (
                      <Text style={styles.qrCodeLabelGtin}>GTIN: {currentItem.gtin}</Text>
                    )}
                    {currentItem.barcode && currentItem.barcodeFormat && (
                      <Text style={styles.qrCodeLabelGtin}>
                        {currentItem.barcodeFormat}: {currentItem.barcode}
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handleBindQrCode}
                  style={({ pressed }) => [
                    styles.bindQrButton,
                    pressed && styles.bindQrButtonPressed,
                  ]}
                  disabled={isUpdating}
                >
                  <View style={styles.bindQrButtonIcon}>
                    <Icon 
                      name="qr-code-scanner" 
                      size={getResponsiveSize(20, 22, 24)} 
                      color="#FF6B35" 
                    />
                  </View>
                  <Text style={styles.bindQrButtonText}>Привязать QR код / штрих-код</Text>
                </Pressable>
              )}
            </View>

            {/* Сырье */}
            {currentItem.raw !== undefined && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleContainer}>
                    <View style={styles.sectionTitleIndicator} />
                    <Text style={styles.sectionTitle}>Сырье</Text>
                  </View>
                  {isUpdating && (
                    <ActivityIndicator size="small" color="#FF6B35" />
                  )}
                </View>
                
                {isOutOfStock ? (
                  <View style={styles.outOfStockCard}>
                    <View style={styles.outOfStockContent}>
                      <View style={styles.outOfStockIconContainer}>
                        <Icon 
                          name="cancel" 
                          size={getResponsiveSize(20, 22, 24)} 
                          color="#FF6B35" 
                        />
                      </View>
                      <Text style={styles.outOfStockText}>Нет в наличии</Text>
                    </View>
                    <Pressable
                      onPress={handleOutOfStockToggle}
                      style={({ pressed }) => [
                        styles.restoreButton,
                        pressed && styles.buttonPressed,
                      ]}
                      disabled={isUpdating}
                    >
                      <View style={styles.restoreButtonContent}>
                        <Icon 
                          name="restore" 
                          size={getResponsiveSize(18, 20, 22)} 
                          color="#FFFFFF" 
                        />
                        <Text style={styles.restoreButtonText}>Восстановить</Text>
                      </View>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.contentColumn}>
                    <View style={styles.contentRow}>
                      {rawActiveInput ? (
                        <Animated.View 
                          style={[
                            styles.inputGroup,
                            {
                              transform: [{ scale: rawInputScale }],
                              opacity: rawInputOpacity,
                            },
                          ]}
                        >
                          <View style={styles.inputHeader}>
                            <View style={[
                              styles.inputHeaderBadge,
                              rawActiveInput === 'add' ? styles.inputHeaderBadgeAdd : styles.inputHeaderBadgeSubtract
                            ]}>
                              <Icon 
                                name={rawActiveInput === 'add' ? 'add' : 'remove'} 
                                size={getResponsiveSize(16, 18, 20)} 
                                color="#FF6B35" 
                              />
                              <Text style={styles.inputHeaderText}>
                                {rawActiveInput === 'add' ? 'Добавление' : 'Вычитание'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.inputWrapper}>
                            <TextInput
                              ref={rawInputRef}
                              style={[
                                styles.input,
                                rawInputFocused && styles.inputFocused
                              ]}
                              value={rawInputValue}
                              onChangeText={(text) => {
                                if (/^\d*$/.test(text)) {
                                  setRawInputValue(text);
                                }
                              }}
                              onFocus={() => setRawInputFocused(true)}
                              onBlur={() => setRawInputFocused(false)}
                              keyboardType="numeric"
                              placeholder="Введите количество"
                              placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
                              onSubmitEditing={handleRawSubmit}
                              editable={!isUpdating}
                              returnKeyType="done"
                              autoFocus={false}
                              selectionColor={isDark ? '#FF6B35' : '#FF6B35'}
                            />
                          </View>
                          <View style={styles.inputActions}>
                            <Pressable
                              onPress={handleRawCancel}
                              style={({ pressed }) => [
                                styles.actionButtonFull,
                                styles.cancelButtonFull,
                                pressed && styles.actionButtonPressed,
                              ]}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Text style={styles.cancelButtonText}>Отмена</Text>
                            </Pressable>
                            <Pressable
                              onPress={handleRawSubmit}
                              style={({ pressed }) => [
                                styles.actionButtonFull,
                                styles.submitButtonFull,
                                pressed && styles.actionButtonPressed,
                              ]}
                              disabled={isUpdating || !rawInputValue || parseInt(rawInputValue, 10) <= 0}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              {isUpdating ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.submitButtonText}>Готово</Text>
                              )}
                            </Pressable>
                          </View>
                        </Animated.View>
                      ) : (
                        <>
                          {renderValueDisplay(currentItem.raw?.quantity || 0, currentItem.unit)}
                          <View style={styles.buttonsRow}>
                            <Pressable
                              onPress={handleRawPlusClick}
                              style={({ pressed }) => [
                                styles.operationButton,
                                styles.plusButton,
                                pressed && styles.buttonPressed,
                              ]}
                              disabled={isUpdating}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Icon 
                                name="add" 
                                size={getResponsiveSize(24, 26, 28)} 
                                color="#FF6B35" 
                              />
                            </Pressable>
                            <Pressable
                              onPress={handleRawMinusClick}
                              style={({ pressed }) => [
                                styles.operationButton,
                                styles.minusButton,
                                pressed && styles.buttonPressed,
                              ]}
                              disabled={isUpdating || (currentItem.raw?.quantity || 0) === 0}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Icon 
                                name="remove" 
                                size={getResponsiveSize(24, 26, 28)} 
                                color={
                                  isUpdating || (currentItem.raw?.quantity || 0) === 0
                                    ? (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)')
                                    : '#FF6B35'
                                } 
                              />
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                    {!rawActiveInput && (
                      <Pressable
                        onPress={handleOutOfStockToggle}
                        style={({ pressed }) => [
                          styles.outOfStockButtonRow,
                          pressed && styles.buttonPressed,
                        ]}
                        disabled={isUpdating}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon 
                          name="cancel" 
                          size={getResponsiveSize(18, 20, 22)} 
                          color="#FF6B35" 
                        />
                        <Text style={styles.outOfStockButtonText}>
                          Нет в наличии
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Кнопка добавления полуфабриката */}
            {!currentItem.semifinished && (
              <View style={styles.addSemifinishedSection}>
                <Pressable
                  onPress={handleAddSemifinished}
                  onPressIn={() => setIsAddSemifinishedPressed(true)}
                  onPressOut={() => setIsAddSemifinishedPressed(false)}
                  style={({ pressed }) => [
                    styles.addSemifinishedButton,
                    pressed && styles.addSemifinishedButtonPressed,
                  ]}
                  disabled={isUpdating}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.addSemifinishedIconContainer}>
                    <Icon name="add" size={getResponsiveSize(24, 26, 28)} color="#FFFFFF" />
                  </View>
                  <Text 
                    style={[
                      styles.addSemifinishedButtonText,
                      isAddSemifinishedPressed && styles.addSemifinishedButtonTextPressed,
                      isUpdating && { opacity: 0.5 },
                    ]}
                  >
                    Добавить полуфабрикат
                  </Text>
                  {isUpdating && (
                    <ActivityIndicator 
                      size="small" 
                      color="#FF6B35" 
                      style={{ marginLeft: getResponsiveSize(8, 10, 12) }}
                    />
                  )}
                </Pressable>
              </View>
            )}

            {/* Полуфабрикат */}
            {currentItem.semifinished !== undefined && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleContainer}>
                    <View style={styles.sectionTitleIndicator} />
                    <Text style={styles.sectionTitle}>Полуфабрикат</Text>
                  </View>
                  <View style={styles.sectionHeaderRight}>
                    {isUpdating && (
                      <ActivityIndicator size="small" color="#FF6B35" />
                    )}
                    <Pressable
                      onPress={handleRemoveSemifinished}
                      style={({ pressed }) => [
                        styles.deleteSemifinishedButton,
                        pressed && styles.buttonPressed,
                      ]}
                      disabled={isUpdating}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon 
                        name="delete" 
                        size={getResponsiveSize(18, 20, 22)} 
                        color="#DC3545" 
                      />
                    </Pressable>
                  </View>
                </View>
                
                <View style={styles.contentRow}>
                  {semifinishedActiveInput ? (
                    <Animated.View 
                      style={[
                        styles.inputGroup,
                        {
                          transform: [{ scale: semifinishedInputScale }],
                          opacity: semifinishedInputOpacity,
                        },
                      ]}
                    >
                      <View style={styles.inputHeader}>
                        <View style={[
                          styles.inputHeaderBadge,
                          semifinishedActiveInput === 'add' ? styles.inputHeaderBadgeAdd : styles.inputHeaderBadgeSubtract
                        ]}>
                          <Icon 
                            name={semifinishedActiveInput === 'add' ? 'add' : 'remove'} 
                            size={getResponsiveSize(16, 18, 20)} 
                            color="#FF6B35" 
                          />
                          <Text style={styles.inputHeaderText}>
                            {semifinishedActiveInput === 'add' ? 'Добавление' : 'Вычитание'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          ref={semifinishedInputRef}
                          style={[
                            styles.input,
                            semifinishedInputFocused && styles.inputFocused
                          ]}
                          value={semifinishedInputValue}
                          onChangeText={(text) => {
                            if (/^\d*$/.test(text)) {
                              setSemifinishedInputValue(text);
                            }
                          }}
                          onFocus={() => setSemifinishedInputFocused(true)}
                          onBlur={() => setSemifinishedInputFocused(false)}
                          keyboardType="numeric"
                          placeholder="Введите количество"
                          placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
                          onSubmitEditing={handleSemifinishedSubmit}
                          editable={!isUpdating}
                          returnKeyType="done"
                          autoFocus={false}
                          selectionColor={isDark ? '#FF6B35' : '#FF6B35'}
                        />
                      </View>
                      <View style={styles.inputActions}>
                        <Pressable
                          onPress={handleSemifinishedCancel}
                          style={({ pressed }) => [
                            styles.actionButtonFull,
                            styles.cancelButtonFull,
                            pressed && styles.actionButtonPressed,
                          ]}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.cancelButtonText}>Отмена</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleSemifinishedSubmit}
                          style={({ pressed }) => [
                            styles.actionButtonFull,
                            styles.submitButtonFull,
                            pressed && styles.actionButtonPressed,
                          ]}
                          disabled={isUpdating || !semifinishedInputValue || parseInt(semifinishedInputValue, 10) <= 0}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          {isUpdating ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.submitButtonText}>Готово</Text>
                          )}
                        </Pressable>
                      </View>
                    </Animated.View>
                  ) : (
                    <>
                      {renderValueDisplay(currentItem.semifinished?.quantity || 0, currentItem.unit)}
                      <View style={styles.buttonsRow}>
                        <Pressable
                          onPress={handleSemifinishedPlusClick}
                          style={({ pressed }) => [
                            styles.operationButton,
                            styles.plusButton,
                            pressed && styles.buttonPressed,
                          ]}
                          disabled={isUpdating}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Icon 
                            name="add" 
                            size={getResponsiveSize(24, 26, 28)} 
                            color="#FF6B35" 
                          />
                        </Pressable>
                        <Pressable
                          onPress={handleSemifinishedMinusClick}
                          style={({ pressed }) => [
                            styles.operationButton,
                            styles.minusButton,
                            pressed && styles.buttonPressed,
                          ]}
                          disabled={isUpdating || (currentItem.semifinished?.quantity || 0) === 0}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Icon 
                            name="remove" 
                            size={getResponsiveSize(24, 26, 28)} 
                            color={
                              isUpdating || (currentItem.semifinished?.quantity || 0) === 0
                                ? (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)')
                                : '#FF6B35'
                            } 
                          />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>

        <NotesModal
          isOpen={isNotesModalOpen}
          onClose={() => setIsNotesModalOpen(false)}
          notes={notes}
          onSave={handleNotesSave}
          onDelete={handleNotesDelete}
          itemName={itemId}
        />

        <ItemHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          itemId={itemId}
          itemName={currentItem.name || itemId}
          category={category}
          chatId={chatId || ''}
        />
      </KeyboardAvoidingView>

      {/* Уведомление об успешной привязке кода */}
      <SuccessNotification
        visible={successNotification.visible}
        title={successNotification.title}
        message={successNotification.message}
        gtin={successNotification.gtin}
        codeType={successNotification.codeType}
        onHide={() => setSuccessNotification({ ...successNotification, visible: false })}
      />
    </Modal>
  );
};

const createStyles = (isDark: boolean, insets: any) => {
  // Адаптивные размеры
  const horizontalPadding = getResponsiveSize(20, 24, 28);
  const buttonSize = getResponsiveSize(48, 52, 56);
  const valueCardPadding = getResponsiveSize(18, 20, 22);
  const panelBorderRadius = getResponsiveSize(28, 32, 36);
  const handleWidth = getResponsiveSize(40, 48, 56);
  const handleHeight = getResponsiveSize(4, 5, 6);
  
  // Цветовая палитра
  const colors = {
    primary: '#FF6B35',
    primaryLight: isDark ? 'rgba(255, 107, 53, 0.12)' : 'rgba(255, 107, 53, 0.08)',
    primaryBorder: isDark ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.15)',
    primaryAdd: isDark ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.15)',
    background: isDark ? '#0F0F0F' : '#FAFAFA',
    surface: isDark ? '#1A1A1A' : '#FFFFFF',
    surfaceElevated: isDark ? '#242424' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    textSecondary: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
    textTertiary: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    backdrop: 'rgba(0, 0, 0, 0.7)',
  };

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    panel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: panelBorderRadius,
      borderTopRightRadius: panelBorderRadius,
      maxHeight: SCREEN_HEIGHT * 0.95,
      paddingBottom: Math.max(insets.bottom, getResponsiveSize(20, 24, 28)),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -12 },
      shadowOpacity: 0.4,
      shadowRadius: 32,
      elevation: 40,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    handle: {
      width: handleWidth,
      height: handleHeight,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      borderRadius: handleHeight / 2,
      alignSelf: 'center',
      marginTop: getResponsiveSize(12, 16, 20),
      marginBottom: getResponsiveSize(20, 24, 28),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: horizontalPadding,
      paddingBottom: getResponsiveSize(20, 24, 28),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: getResponsiveSize(4, 8, 12),
    },
    headerContent: {
      flex: 1,
      marginRight: getResponsiveSize(12, 16, 20),
    },
    itemName: {
      fontSize: getResponsiveSize(22, 26, 28),
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      lineHeight: getResponsiveSize(30, 36, 38),
    },
    itemUnit: {
      fontSize: getResponsiveSize(14, 15, 16),
      color: colors.textSecondary,
      marginTop: getResponsiveSize(6, 8, 10),
      lineHeight: getResponsiveSize(20, 22, 24),
      fontWeight: '500',
    },
    closeButton: {
      width: getResponsiveSize(40, 44, 48),
      height: getResponsiveSize(40, 44, 48),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: getResponsiveSize(20, 22, 24),
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    },
    closeButtonPressed: {
      opacity: 0.6,
      transform: [{ scale: 0.92 }],
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: horizontalPadding,
      paddingTop: getResponsiveSize(8, 12, 16),
      paddingBottom: getResponsiveSize(24, 28, 32),
    },
    section: {
      marginTop: getResponsiveSize(28, 32, 36),
      marginBottom: getResponsiveSize(4, 8, 12),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: getResponsiveSize(18, 20, 24),
    },
    sectionHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(8, 10, 12),
    },
    deleteSemifinishedButton: {
      width: getResponsiveSize(36, 40, 44),
      height: getResponsiveSize(36, 40, 44),
      borderRadius: getResponsiveSize(18, 20, 22),
      backgroundColor: isDark ? 'rgba(220, 53, 69, 0.15)' : 'rgba(220, 53, 69, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(10, 12, 14),
    },
    sectionTitleIndicator: {
      width: getResponsiveSize(3, 4, 5),
      height: getResponsiveSize(18, 20, 22),
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    sectionTitle: {
      fontSize: getResponsiveSize(17, 18, 19),
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    contentColumn: {
      gap: getResponsiveSize(10, 12, 14),
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: getResponsiveSize(10, 12, 14),
      minHeight: getResponsiveSize(68, 72, 76),
    },
    valueCard: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(10, 12, 14),
      paddingVertical: valueCardPadding,
      paddingHorizontal: getResponsiveSize(18, 20, 22),
      backgroundColor: colors.surfaceElevated,
      borderRadius: getResponsiveSize(16, 18, 20),
      borderWidth: 1.5,
      borderColor: colors.border,
      flex: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    valueContent: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    valueText: {
      fontSize: getResponsiveSize(26, 28, 30),
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      minWidth: getResponsiveSize(40, 44, 48),
      letterSpacing: 0.3,
    },
    valueIndicator: {
      position: 'absolute',
      top: -8,
      right: -8,
      width: getResponsiveSize(20, 22, 24),
      height: getResponsiveSize(20, 22, 24),
      borderRadius: getResponsiveSize(10, 11, 12),
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.surface,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
      elevation: 8,
    },
    valueUnit: {
      fontSize: getResponsiveSize(13, 14, 15),
      color: colors.textTertiary,
      fontWeight: '500',
      maxWidth: getResponsiveSize(56, 60, 64),
    },
    buttonsRow: {
      flexDirection: 'row',
      gap: getResponsiveSize(8, 10, 12),
      alignItems: 'center',
      flexShrink: 0,
    },
    outOfStockButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: getResponsiveSize(6, 8, 10),
      paddingVertical: getResponsiveSize(12, 14, 16),
      paddingHorizontal: getResponsiveSize(14, 16, 18),
      borderRadius: getResponsiveSize(12, 14, 16),
      backgroundColor: colors.primaryLight,
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
      marginTop: getResponsiveSize(6, 8, 10),
    },
    operationButton: {
      width: buttonSize,
      height: buttonSize,
      borderRadius: getResponsiveSize(14, 16, 18),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      backgroundColor: colors.surfaceElevated,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    plusButton: {
      borderColor: colors.primary,
    },
    minusButton: {
      borderColor: colors.border,
    },
    buttonPressed: {
      opacity: 0.6,
      transform: [{ scale: 0.9 }],
    },
    inputGroup: {
      flex: 1,
      gap: getResponsiveSize(12, 14, 16),
    },
    inputHeader: {
      marginBottom: getResponsiveSize(10, 12, 14),
    },
    inputHeaderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: getResponsiveSize(6, 8, 10),
      paddingVertical: getResponsiveSize(5, 6, 7),
      paddingHorizontal: getResponsiveSize(10, 12, 14),
      borderRadius: getResponsiveSize(10, 12, 14),
    },
    inputHeaderBadgeAdd: {
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 107, 53, 0.3)',
    },
    inputHeaderBadgeSubtract: {
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 107, 53, 0.3)',
    },
    inputHeaderText: {
      fontSize: getResponsiveSize(12, 13, 14),
      fontWeight: '600',
      color: colors.text,
      letterSpacing: 0.1,
    },
    inputWrapper: {
      marginBottom: getResponsiveSize(10, 12, 14),
    },
    input: {
      width: '100%',
      height: getResponsiveSize(58, 62, 66),
      borderWidth: 2,
      borderRadius: getResponsiveSize(14, 16, 18),
      
      fontSize: getResponsiveSize(22, 24, 26),
      fontWeight: '700',
      color: colors.text,
      backgroundColor: 'transparent',
      textAlign: 'center',
      letterSpacing: 0.3,
    },
    inputFocused: {
      borderColor: colors.primary,
    },
    inputActions: {
      flexDirection: 'row',
      gap: getResponsiveSize(10, 12, 14),
      justifyContent: 'space-between',
    },
    actionButton: {
      width: buttonSize,
      height: buttonSize,
      borderRadius: getResponsiveSize(14, 16, 18),
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonFull: {
      flex: 1,
      height: getResponsiveSize(50, 54, 58),
      borderRadius: getResponsiveSize(14, 16, 18),
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    cancelButtonFull: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
    },
    submitButton: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 10,
    },
    submitButtonFull: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 6,
    },
    actionButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.96 }],
    },
    cancelButtonText: {
      color: colors.text,
      fontSize: getResponsiveSize(15, 16, 17),
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: getResponsiveSize(15, 16, 17),
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    okButtonText: {
      color: '#FFFFFF',
      fontSize: getResponsiveSize(15, 16, 17),
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    outOfStockCard: {
      padding: getResponsiveSize(20, 24, 28),
      borderRadius: getResponsiveSize(16, 18, 20),
      backgroundColor: colors.primaryLight,
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
      gap: getResponsiveSize(16, 18, 20),
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 4,
    },
    outOfStockContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: getResponsiveSize(12, 14, 16),
    },
    outOfStockIconContainer: {
      width: getResponsiveSize(30, 32, 34),
      height: getResponsiveSize(30, 32, 34),
      borderRadius: getResponsiveSize(15, 16, 17),
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outOfStockText: {
      fontSize: getResponsiveSize(17, 18, 19),
      fontWeight: '600',
      color: colors.primary,
      letterSpacing: -0.2,
    },
    outOfStockButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
      maxWidth: 140,
    },
    outOfStockButtonText: {
      fontSize: getResponsiveSize(12, 13, 14),
      color: colors.primary,
      fontWeight: '600',
      letterSpacing: 0,
    },
    restoreButton: {
      borderRadius: getResponsiveSize(14, 16, 18),
      alignSelf: 'center',
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 10,
    },
    restoreButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(8, 10, 12),
      paddingVertical: getResponsiveSize(14, 16, 18),
      paddingHorizontal: getResponsiveSize(20, 24, 28),
    },
    restoreButtonText: {
      fontSize: getResponsiveSize(15, 16, 17),
      color: '#FFFFFF',
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    notesAndHistorySection: {
      flexDirection: 'row',
      gap: getResponsiveSize(10, 12, 14),
      marginTop: getResponsiveSize(20, 24, 28),
      marginBottom: getResponsiveSize(8, 12, 16),
    },
    notesSection: {
      flex: 1,
    },
    notesCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: getResponsiveSize(12, 14, 16),
      backgroundColor: colors.surfaceElevated,
      borderRadius: getResponsiveSize(14, 16, 18),
      borderWidth: 1.5,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    notesCardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    notesIconContainer: {
      width: getResponsiveSize(36, 40, 44),
      height: getResponsiveSize(36, 40, 44),
      borderRadius: getResponsiveSize(12, 14, 16),
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: getResponsiveSize(8, 10, 12),
    },
    notesContentContainer: {
      flex: 1,
      gap: getResponsiveSize(4, 6, 8),
    },
    notesTitle: {
      fontSize: getResponsiveSize(14, 15, 16),
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    notesPreview: {
      fontSize: getResponsiveSize(12, 13, 14),
      color: colors.textSecondary,
      lineHeight: getResponsiveSize(16, 18, 20),
    },
    notesPlaceholder: {
      fontSize: getResponsiveSize(12, 13, 14),
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    notesArrowContainer: {
      marginLeft: getResponsiveSize(6, 8, 10),
    },
    historySection: {
      flex: 1,
    },
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: getResponsiveSize(12, 14, 16),
      backgroundColor: colors.surfaceElevated,
      borderRadius: getResponsiveSize(14, 16, 18),
      borderWidth: 1.5,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    historyCardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    historyIconContainer: {
      width: getResponsiveSize(36, 40, 44),
      height: getResponsiveSize(36, 40, 44),
      borderRadius: getResponsiveSize(12, 14, 16),
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: getResponsiveSize(8, 10, 12),
    },
    historyContentContainer: {
      flex: 1,
      gap: getResponsiveSize(2, 4, 6),
    },
    historyTitle: {
      fontSize: getResponsiveSize(14, 15, 16),
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    historyPreview: {
      fontSize: getResponsiveSize(12, 13, 14),
      color: colors.textSecondary,
      lineHeight: getResponsiveSize(16, 18, 20),
    },
    historyArrowContainer: {
      marginLeft: getResponsiveSize(6, 8, 10),
    },
    qrSection: {
      marginBottom: getResponsiveSize(20, 24, 28),
    },
    qrCodeLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(12, 14, 16),
      paddingVertical: getResponsiveSize(14, 16, 18),
      paddingHorizontal: getResponsiveSize(16, 18, 20),
      backgroundColor: colors.primaryLight,
      borderRadius: getResponsiveSize(12, 14, 16),
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
    },
    qrCodeLabelIcon: {
      width: getResponsiveSize(36, 40, 44),
      height: getResponsiveSize(36, 40, 44),
      borderRadius: getResponsiveSize(18, 20, 22),
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrCodeLabelContent: {
      flex: 1,
      gap: getResponsiveSize(4, 6, 8),
    },
    qrCodeLabelText: {
      fontSize: getResponsiveSize(15, 16, 17),
      fontWeight: '600',
      color: colors.primary,
    },
    qrCodeLabelGtin: {
      fontSize: getResponsiveSize(12, 13, 14),
      color: colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    bindQrButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: getResponsiveSize(10, 12, 14),
      paddingVertical: getResponsiveSize(14, 16, 18),
      paddingHorizontal: getResponsiveSize(18, 20, 22),
      backgroundColor: colors.surfaceElevated,
      borderRadius: getResponsiveSize(12, 14, 16),
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    bindQrButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    bindQrButtonIcon: {
      width: getResponsiveSize(32, 36, 40),
      height: getResponsiveSize(32, 36, 40),
      borderRadius: getResponsiveSize(16, 18, 20),
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bindQrButtonText: {
      fontSize: getResponsiveSize(15, 16, 17),
      fontWeight: '600',
      color: colors.text,
    },
    addSemifinishedSection: {
      marginTop: getResponsiveSize(24, 28, 32),
      marginBottom: getResponsiveSize(8, 12, 16),
    },
    addSemifinishedButton: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: getResponsiveSize(10, 12, 14),
      paddingVertical: getResponsiveSize(18, 20, 22),
      paddingHorizontal: getResponsiveSize(20, 24, 28),
      backgroundColor: colors.surfaceElevated,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      borderRadius: getResponsiveSize(16, 18, 20),
    },
    addSemifinishedButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.97 }],
      backgroundColor: colors.primary,
    },
    addSemifinishedIconContainer: {
      width: getResponsiveSize(36, 40, 44),
      height: getResponsiveSize(36, 40, 44),
      borderRadius: getResponsiveSize(18, 20, 22),
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addSemifinishedButtonText: {
      fontSize: getResponsiveSize(15, 16, 17),
      fontWeight: '600',
      color: colors.primary,
      letterSpacing: 0.2,
    },
    addSemifinishedButtonTextPressed: {
      color: '#FFFFFF',
    },
  });
};

export default ItemEditPanel;
