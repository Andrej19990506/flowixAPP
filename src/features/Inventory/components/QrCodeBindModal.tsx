import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Alert,
  Platform,
  TextInput,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAppSelector } from '../../../store/hooks';
import SuccessNotification from './SuccessNotification';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;
const isMediumScreen = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
const isLargeScreen = SCREEN_WIDTH >= 414;

const getResponsiveSize = (small: number, medium: number, large: number) => {
  if (isSmallScreen) return small;
  if (isMediumScreen) return medium;
  return large;
};

interface QrCodeBindModalProps {
  visible: boolean;
  onClose: () => void;
  qrCode: string;
  gtin: string;
  barcode?: string;
  barcodeFormat?: string;
  onBind: (category: string, itemId: string, qrData: string, gtin: string, barcode?: string, barcodeFormat?: string) => Promise<void>;
}

const QrCodeBindModal: React.FC<QrCodeBindModalProps> = ({
  visible,
  onClose,
  qrCode,
  gtin,
  barcode,
  barcodeFormat,
  onBind,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  const { currentInventory } = useAppSelector((state) => state.inventory);
  
  // Логируем каждый раз, когда currentInventory изменяется
  useEffect(() => {
    console.log('[QrCodeBindModal] 🔄 currentInventory изменился:', {
      hasInventory: !!currentInventory?.inventory,
      categoriesCount: currentInventory?.inventory ? Object.keys(currentInventory.inventory).length : 0,
      inventoryRef: currentInventory?.inventory ? 'существует' : 'null',
    });
  }, [currentInventory?.inventory]);
  const [selectedItem, setSelectedItem] = useState<{ category: string; itemId: string; item: any } | null>(null);
  const [isBinding, setIsBinding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shouldRenderContent, setShouldRenderContent] = useState(false);
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

  // Анимации
  const slideAnim = useRef(new Animated.Value(1)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  
  // Мемоизируем стили, чтобы не пересчитывать при каждом рендере
  const styles = useMemo(() => createStyles(isDark, insets), [isDark, insets]);

  useEffect(() => {
    if (visible) {
      console.log('[QrCodeBindModal] 🚀 Модальное окно открывается');
      console.log('[QrCodeBindModal] 📊 Состояние инвентаря при открытии:', {
        hasCurrentInventory: !!currentInventory,
        hasInventory: !!currentInventory?.inventory,
        categoriesCount: currentInventory?.inventory ? Object.keys(currentInventory.inventory).length : 0,
        cacheExists: !!allItemsCacheRef.current,
        cacheItemsCount: allItemsCacheRef.current?.items.length || 0,
        cacheInventoryRef: allItemsCacheRef.current?.inventory ? 'существует' : 'null',
        currentInventoryRef: currentInventory?.inventory ? 'существует' : 'null',
      });

      // Сбрасываем состояние сразу, до анимации
      setSelectedItem(null);
      setSearchQuery('');
      setShouldRenderContent(false);
      
      // Запускаем анимацию сразу
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
      ]).start(() => {
        // Рендерим контент только после завершения анимации
        console.log('[QrCodeBindModal] ✅ Анимация завершена, рендерим контент');
        setShouldRenderContent(true);
      });
    } else {
      console.log('[QrCodeBindModal] 🚪 Модальное окно закрывается');
      setShouldRenderContent(false);
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
  }, [visible, currentInventory]);

  // Кэшируем список товаров, чтобы не пересчитывать при каждом рендере
  const allItemsCacheRef = useRef<{
    inventory: any;
    items: Array<{ category: string; itemId: string; item: any }>;
  } | null>(null);

  // Получаем все товары из инвентаря (пересчитываем только если инвентарь действительно изменился)
  const allItems = useMemo(() => {
    console.log('[QrCodeBindModal] 🔍 [useMemo] Проверяем источник данных для списка товаров');
    console.log('[QrCodeBindModal] 📦 [useMemo] currentInventory:', {
      hasInventory: !!currentInventory?.inventory,
      inventoryRef: currentInventory?.inventory ? 'существует' : 'null',
      categoriesCount: currentInventory?.inventory ? Object.keys(currentInventory.inventory).length : 0,
      cacheExists: !!allItemsCacheRef.current,
      cacheInventoryRef: allItemsCacheRef.current?.inventory ? 'существует' : 'null',
      sameReference: allItemsCacheRef.current?.inventory === currentInventory?.inventory,
    });

    if (!currentInventory?.inventory) {
      console.log('[QrCodeBindModal] ❌ Инвентарь отсутствует, очищаем кэш');
      allItemsCacheRef.current = null;
      return [];
    }

    // Проверяем, изменился ли инвентарь (сравниваем по ссылке)
    if (
      allItemsCacheRef.current &&
      allItemsCacheRef.current.inventory === currentInventory.inventory
    ) {
      console.log('[QrCodeBindModal] ✅ Используем КЭШИРОВАННЫЙ список товаров:', {
        itemsCount: allItemsCacheRef.current.items.length,
        source: 'cache',
        inventoryRef: 'та же ссылка',
      });
      return allItemsCacheRef.current.items;
    }

    console.log('[QrCodeBindModal] 🔄 ПЕРЕСЧИТЫВАЕМ список товаров (инвентарь изменился):', {
      source: 'recalculation',
      hadCache: !!allItemsCacheRef.current,
      inventoryRef: 'новая ссылка',
    });

    // Пересчитываем только если инвентарь изменился
    const items: Array<{
      category: string;
      itemId: string;
      item: any;
    }> = [];

    const inventory = currentInventory.inventory;
    const categories = Object.keys(inventory);
    console.log('[QrCodeBindModal] 📋 Категории в инвентаре:', categories.length, categories);

    for (const category in inventory) {
      if (inventory.hasOwnProperty(category)) {
        const categoryItems = inventory[category];
        const itemIds = Object.keys(categoryItems);
        console.log(`[QrCodeBindModal] 📦 Категория "${category}": ${itemIds.length} товаров`);
        
        for (const itemId in categoryItems) {
          if (categoryItems.hasOwnProperty(itemId)) {
            items.push({
              category,
              itemId,
              item: categoryItems[itemId],
            });
          }
        }
      }
    }

    console.log('[QrCodeBindModal] ✅ Список пересчитан:', {
      totalItems: items.length,
      categories: categories.length,
    });

    // Сохраняем в кэш
    allItemsCacheRef.current = {
      inventory: currentInventory.inventory,
      items,
    };

    console.log('[QrCodeBindModal] 💾 Список сохранен в кэш');

    return items;
  }, [currentInventory?.inventory]);

  // Фильтруем товары по поисковому запросу (по названию и категории)
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      console.log('[QrCodeBindModal] 🔍 Поиск не активен, показываем все товары:', allItems.length);
      return allItems;
    }

    const query = searchQuery.toLowerCase().trim();
    console.log('[QrCodeBindModal] 🔍 Фильтруем товары по запросу:', {
      query,
      totalItems: allItems.length,
    });
    
    const filtered = allItems.filter(({ item, itemId, category }) => {
      const name = (item.name || itemId || '').toLowerCase();
      const categoryLower = category.toLowerCase();
      return name.includes(query) || categoryLower.includes(query);
    });

    console.log('[QrCodeBindModal] ✅ Отфильтровано товаров:', {
      found: filtered.length,
      from: allItems.length,
    });

    return filtered;
  }, [allItems, searchQuery]);

  const handleBind = async () => {
    if (!selectedItem) return;

    setIsBinding(true);
    try {
      await onBind(selectedItem.category, selectedItem.itemId, qrCode, gtin, barcode, barcodeFormat);
      const itemName = selectedItem.item?.name || selectedItem.itemId;
      const codeType = barcode ? 'штрих-код' : 'QR код';
      
      // Показываем красивое уведомление
      setSuccessNotification({
        visible: true,
        title: `${codeType} привязан`,
        message: `${codeType === 'штрих-код' ? 'Штрих-код' : 'QR код'} успешно привязан к товару "${itemName}".`,
        gtin: gtin,
        codeType: barcode ? 'barcode' : 'qr',
      });
      
      // Закрываем модальное окно после небольшой задержки
      setTimeout(() => {
        setSelectedItem(null);
        setSearchQuery('');
        onClose();
      }, 500);
    } catch (error: any) {
      console.error('[QrCodeBindModal] Ошибка при привязке QR кода:', error);
      Alert.alert(
        'Ошибка',
        error.response?.data?.detail || error.message || 'Не удалось привязать QR код'
      );
    } finally {
      setIsBinding(false);
    }
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
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

        {/* Информационная карточка */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Icon name="info" size={getResponsiveSize(24, 26, 28)} color="#FF6B35" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>QR код не найден</Text>
            <Text style={styles.infoText}>
              Товар с GTIN {gtin} не найден в инвентаре. Выберите товар для привязки QR кода.
            </Text>
          </View>
        </View>

        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIconContainer}>
              <Icon name="qr-code-2" size={getResponsiveSize(24, 26, 28)} color="#FF6B35" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Привязать QR код</Text>
              <Text style={styles.headerSubtitle}>GTIN: {gtin}</Text>
            </View>
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

        {shouldRenderContent ? (
          <>
            {(() => {
              console.log('[QrCodeBindModal] 📋 Рендерим контент со списком товаров:', {
                allItemsCount: allItems.length,
                filteredItemsCount: filteredItems.length,
                searchQuery: searchQuery || '(пусто)',
                cacheUsed: allItemsCacheRef.current?.inventory === currentInventory?.inventory,
              });
              return null;
            })()}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Icon
                  name="search"
                  size={getResponsiveSize(20, 22, 24)}
                  color={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Поиск товара по названию или категории..."
                  placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    style={styles.clearSearchButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon
                      name="close"
                      size={getResponsiveSize(18, 20, 22)}
                      color={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
                    />
                  </Pressable>
                )}
              </View>
            </View>

            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon
                  name={searchQuery ? "search-off" : "inventory-2"}
                  size={getResponsiveSize(64, 72, 80)}
                  color={isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}
                />
                <Text style={styles.emptyStateTitle}>
                  {searchQuery ? 'Товары не найдены' : 'Нет товаров в инвентаре'}
                </Text>
                {searchQuery && (
                  <Text style={styles.emptyStateSubtitle}>
                    Попробуйте изменить поисковый запрос
                  </Text>
                )}
              </View>
            ) : (
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => `${item.category}-${item.itemId}`}
                style={styles.itemsList}
                contentContainerStyle={styles.itemsListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={10}
                removeClippedSubviews={true}
                ListHeaderComponent={
                  <Text style={styles.itemsCount}>
                    Найдено товаров: {filteredItems.length}
                  </Text>
                }
                renderItem={({ item: { category, itemId, item } }) => {
                  const isSelected =
                    selectedItem?.category === category && selectedItem?.itemId === itemId;
                  return (
                    <Pressable
                      onPress={() => setSelectedItem({ category, itemId, item })}
                      style={({ pressed }) => [
                        styles.itemCard,
                        isSelected && styles.itemCardSelected,
                        pressed && styles.itemCardPressed,
                      ]}
                    >
                      <View style={styles.itemContent}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.name || itemId}
                          </Text>
                          <View style={styles.itemMeta}>
                            <View style={styles.itemCategoryBadge}>
                              <Icon
                                name="category"
                                size={getResponsiveSize(14, 15, 16)}
                                color={isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                              />
                              <Text style={styles.itemCategory} numberOfLines={1}>
                                {category}
                              </Text>
                            </View>
                            {item.unit && (
                              <Text style={styles.itemUnit} numberOfLines={1}>
                                {item.unit}
                              </Text>
                            )}
                          </View>
                        </View>
                        {isSelected ? (
                          <View style={styles.selectedIndicator}>
                            <Icon
                              name="check-circle"
                              size={getResponsiveSize(28, 30, 32)}
                              color="#FF6B35"
                            />
                          </View>
                        ) : (
                          <View style={styles.unselectedIndicator}>
                            <Icon
                              name="radio-button-unchecked"
                              size={getResponsiveSize(24, 26, 28)}
                              color={isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}
                            />
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.buttonPressed,
            ]}
            disabled={isBinding}
          >
            <Text style={styles.cancelButtonText}>Отмена</Text>
          </Pressable>
          <Pressable
            onPress={handleBind}
            style={({ pressed }) => [
              styles.bindButton,
              !selectedItem && styles.bindButtonDisabled,
              pressed && styles.buttonPressed,
            ]}
            disabled={!selectedItem || isBinding}
          >
            {isBinding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon
                  name="link"
                  size={getResponsiveSize(18, 20, 22)}
                  color="#FFFFFF"
                  style={{ marginRight: getResponsiveSize(6, 8, 10) }}
                />
                <Text style={styles.bindButtonText}>Привязать</Text>
              </>
            )}
          </Pressable>
        </View>
      </Animated.View>
      </View>

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
  const colors = {
    primary: '#FF6B35',
    primaryLight: isDark ? 'rgba(255, 107, 53, 0.12)' : 'rgba(255, 107, 53, 0.08)',
    primaryBorder: isDark ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.15)',
    background: isDark ? '#0F0F0F' : '#FAFAFA',
    surface: isDark ? '#1A1A1A' : '#FFFFFF',
    surfaceElevated: isDark ? '#242424' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    textSecondary: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
    textTertiary: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    backdrop: 'rgba(0, 0, 0, 0.7)',
  };

  const handleWidth = getResponsiveSize(40, 48, 56);
  const handleHeight = getResponsiveSize(4, 5, 6);
  const panelBorderRadius = getResponsiveSize(28, 32, 36);

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
      overflow: 'hidden',
    },
    handle: {
      width: handleWidth,
      height: handleHeight,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      borderRadius: handleHeight / 2,
      alignSelf: 'center',
      marginTop: getResponsiveSize(12, 16, 20),
      marginBottom: getResponsiveSize(16, 20, 24),
    },
    infoCard: {
      flexDirection: 'row',
      marginHorizontal: getResponsiveSize(20, 24, 28),
      marginBottom: getResponsiveSize(16, 20, 24),
      padding: getResponsiveSize(16, 18, 20),
      backgroundColor: colors.primaryLight,
      borderRadius: getResponsiveSize(14, 16, 18),
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
    },
    infoIconContainer: {
      width: getResponsiveSize(40, 44, 48),
      height: getResponsiveSize(40, 44, 48),
      borderRadius: getResponsiveSize(12, 14, 16),
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: getResponsiveSize(12, 14, 16),
    },
    infoContent: {
      flex: 1,
    },
    infoTitle: {
      fontSize: getResponsiveSize(16, 17, 18),
      fontWeight: '700',
      color: colors.primary,
      marginBottom: getResponsiveSize(4, 6, 8),
    },
    infoText: {
      fontSize: getResponsiveSize(13, 14, 15),
      color: colors.textSecondary,
      lineHeight: getResponsiveSize(18, 20, 22),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: getResponsiveSize(20, 24, 28),
      paddingBottom: getResponsiveSize(16, 20, 24),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: getResponsiveSize(12, 16, 20),
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: getResponsiveSize(12, 16, 20),
    },
    headerIconContainer: {
      width: getResponsiveSize(44, 48, 52),
      height: getResponsiveSize(44, 48, 52),
      borderRadius: getResponsiveSize(12, 14, 16),
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: getResponsiveSize(12, 14, 16),
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: getResponsiveSize(20, 22, 24),
      fontWeight: '700',
      color: colors.text,
      marginBottom: getResponsiveSize(4, 6, 8),
    },
    headerSubtitle: {
      fontSize: getResponsiveSize(13, 14, 15),
      color: colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    searchContainer: {
      paddingHorizontal: getResponsiveSize(20, 24, 28),
      marginBottom: getResponsiveSize(12, 16, 20),
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: getResponsiveSize(12, 14, 16),
      paddingHorizontal: getResponsiveSize(14, 16, 18),
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: getResponsiveSize(12, 14, 16),
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: getResponsiveSize(10, 12, 14),
    },
    searchInput: {
      flex: 1,
      fontSize: getResponsiveSize(15, 16, 17),
      color: colors.text,
      padding: 0,
    },
    clearSearchButton: {
      padding: getResponsiveSize(4, 6, 8),
      marginLeft: getResponsiveSize(8, 10, 12),
    },
    itemsList: {
      flex: 1,
    },
    itemsListContent: {
      paddingHorizontal: getResponsiveSize(20, 24, 28),
      paddingTop: getResponsiveSize(12, 16, 20),
      paddingBottom: getResponsiveSize(12, 16, 20),
      gap: getResponsiveSize(8, 10, 12),
    },
    itemsCount: {
      fontSize: getResponsiveSize(13, 14, 15),
      color: colors.textTertiary,
      marginBottom: getResponsiveSize(8, 10, 12),
      fontWeight: '500',
    },
    itemCard: {
      padding: getResponsiveSize(16, 18, 20),
      backgroundColor: colors.surfaceElevated,
      borderRadius: getResponsiveSize(14, 16, 18),
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    itemCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    itemCardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    itemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    itemInfo: {
      flex: 1,
      marginRight: getResponsiveSize(12, 14, 16),
    },
    itemName: {
      fontSize: getResponsiveSize(16, 17, 18),
      fontWeight: '600',
      color: colors.text,
      marginBottom: getResponsiveSize(8, 10, 12),
    },
    itemMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(8, 10, 12),
      flexWrap: 'wrap',
    },
    itemCategoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(4, 6, 8),
      paddingVertical: getResponsiveSize(4, 5, 6),
      paddingHorizontal: getResponsiveSize(8, 10, 12),
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: getResponsiveSize(8, 10, 12),
    },
    itemCategory: {
      fontSize: getResponsiveSize(12, 13, 14),
      color: colors.textSecondary,
    },
    itemUnit: {
      fontSize: getResponsiveSize(12, 13, 14),
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    selectedIndicator: {
      width: getResponsiveSize(36, 40, 44),
      height: getResponsiveSize(36, 40, 44),
      alignItems: 'center',
      justifyContent: 'center',
    },
    unselectedIndicator: {
      width: getResponsiveSize(32, 36, 40),
      height: getResponsiveSize(32, 36, 40),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: getResponsiveSize(60, 80, 100),
    },
    emptyStateTitle: {
      fontSize: getResponsiveSize(17, 18, 19),
      fontWeight: '600',
      color: colors.text,
      marginTop: getResponsiveSize(16, 20, 24),
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      fontSize: getResponsiveSize(14, 15, 16),
      color: colors.textSecondary,
      marginTop: getResponsiveSize(8, 10, 12),
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: getResponsiveSize(60, 80, 100),
    },
    footer: {
      flexDirection: 'row',
      gap: getResponsiveSize(10, 12, 14),
      paddingHorizontal: getResponsiveSize(20, 24, 28),
      paddingTop: getResponsiveSize(16, 20, 24),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cancelButton: {
      flex: 1,
      height: getResponsiveSize(50, 54, 58),
      borderRadius: getResponsiveSize(14, 16, 18),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
    },
    bindButton: {
      flex: 1,
      height: getResponsiveSize(50, 54, 58),
      borderRadius: getResponsiveSize(14, 16, 18),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 6,
      flexDirection: 'row',
    },
    bindButtonDisabled: {
      opacity: 0.5,
    },
    buttonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.96 }],
    },
    cancelButtonText: {
      fontSize: getResponsiveSize(15, 16, 17),
      fontWeight: '600',
      color: colors.text,
    },
    bindButtonText: {
      fontSize: getResponsiveSize(15, 16, 17),
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
};

export default QrCodeBindModal;
