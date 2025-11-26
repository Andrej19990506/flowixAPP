import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { fetchItemHistory } from '../../../store/slices/inventorySlice';
import type { InventoryHistoryItem } from '../../../types/inventory';

// Базовый URL API (продакшен CDN Selectel)
const API_BASE_URL = 'https://c8e767f0-ac37-4f85-88bd-7ce8bceb888c.selcdn.net/api';

// Функция для преобразования относительного пути фото в полный URL через API эндпоинт
const getPhotoUrl = (photoUrl: string | null | undefined, userId?: number): string | null => {
  if (!photoUrl) return null;
  
  // Если уже полный URL (начинается с http:// или https://), возвращаем как есть
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    return photoUrl;
  }
  
  // Если есть userId, используем API эндпоинт для получения фото
  if (userId) {
    return `${API_BASE_URL}/v1/users/${userId}/photo`;
  }
  
  // Пытаемся извлечь user_id из пути типа /users-photo/user_1682142222.jpg
  const match = photoUrl.match(/user_(\d+)\.jpg/);
  if (match && match[1]) {
    const extractedUserId = parseInt(match[1], 10);
    return `${API_BASE_URL}/v1/users/${extractedUserId}/photo`;
  }
  
  // Если не удалось извлечь user_id, возвращаем null
  return null;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Адаптивные размеры
const getResponsiveSize = (small: number, medium: number, large: number) => {
  const { width } = Dimensions.get('window');
  if (width < 375) return small;
  if (width < 414) return medium;
  return large;
};

interface ItemHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  category: string;
  chatId: string;
}

const ItemHistoryModal: React.FC<ItemHistoryModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  category,
  chatId,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  
  // Получаем историю из Redux (используем itemName как ключ, так как в Redux история хранится по itemName)
  const history = useAppSelector(
    (state) => {
      const records = state.inventory.history.records[itemName] || [];
      if (records.length > 0) {
        console.log('[ItemHistoryModal] 📖 История из Redux:', {
          recordsCount: records.length,
          firstRecord: {
            id: records[0].id,
            hasAuthor: !!records[0].author,
            authorName: records[0].author?.first_name,
            authorPhoto: records[0].author?.photo_url,
            authorUserId: records[0].author?.user_id
          }
        });
      }
      return records;
    }
  ) as InventoryHistoryItem[];
  const historyError = useAppSelector((state) => state.inventory.history.error);
  const historyLoading = useAppSelector(
    (state) => state.inventory.history.isLoading
  );
  
  const [selectedDate, setSelectedDate] = useState<string>('all');

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.spring(slideAnim, {
        toValue: 1,
        damping: 25,
        stiffness: 300,
        useNativeDriver: true,
      }).start();
      // Загружаем историю через Redux
      if (chatId && category && itemName) {
        dispatch(
          fetchItemHistory({
            chatId,
            itemId: itemName, // Используем itemName как itemId для ключа в Redux
            category,
            itemName,
          })
        );
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen, chatId, category, itemName, itemId, dispatch]);

  const animatedStyle = {
    transform: [
      {
        translateY: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [SCREEN_HEIGHT, 0],
        }),
      },
    ],
    opacity: slideAnim,
  };

  const filteredHistory = history.filter((record) => {
    if (['add_option', 'remove_option'].includes(record.action)) {
      return false;
    }
    if (selectedDate === 'all') return true;
    const recordDate = new Date(record.timestamp);
    const formattedDate = recordDate.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return formattedDate === selectedDate;
  });

  const availableDates = useMemo(() => {
    const dates = history
      .map((record) => {
        const date = new Date(record.timestamp);
        return date.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      })
      .filter((date, index, self) => self.indexOf(date) === index);
    return ['all', ...dates];
  }, [history]);

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionText = (action: string, type: string): string => {
    const typeText = type === 'raw' ? 'сырья' : 'полуфабриката';
    switch (action) {
      case 'increment':
        return `Увеличено количество ${typeText}`;
      case 'decrement':
        return `Уменьшено количество ${typeText}`;
      case 'set':
        return `Установлено количество ${typeText}`;
      default:
        return `Изменено количество ${typeText}`;
    }
  };

  const colors = {
    background: isDark ? '#1A1A1A' : '#FFFFFF',
    surface: isDark ? '#242424' : '#F5F5F5',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    textSecondary: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    primary: '#FF6B35',
  };

  const styles = createStyles(isDark, insets, colors);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[styles.modalContent, animatedStyle]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>История изменений</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {itemName}
              </Text>
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
                size={getResponsiveSize(24, 26, 28)}
                color={colors.text}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {historyLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Загрузка истории...</Text>
              </View>
            ) : historyError ? (
              <View style={styles.errorContainer}>
                <Icon
                  name="error-outline"
                  size={getResponsiveSize(48, 52, 56)}
                  color={colors.textSecondary}
                />
                <Text style={styles.errorText}>{historyError}</Text>
              </View>
            ) : filteredHistory.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Icon
                      name="history"
                      size={getResponsiveSize(48, 56, 64)}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.emptyIconDot} />
                </View>
                <Text style={styles.emptyTitle}>История пуста</Text>
                <Text style={styles.emptyText}>
                  Здесь будут отображаться изменения количества сырья и
                  полуфабрикатов
                </Text>
                <View style={styles.emptyHintContainer}>
                  <Icon
                    name="info-outline"
                    size={getResponsiveSize(16, 18, 20)}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.emptyHintText}>
                    Изменения появятся после обновления количества
                  </Text>
                </View>
              </View>
            ) : (
              filteredHistory.map((record, index) => {
                console.log('[ItemHistoryModal] 📝 Рендерим запись:', {
                  id: record.id,
                  hasAuthor: !!record.author,
                  authorData: record.author,
                });
                return (
                  <View key={record.id} style={styles.historyItem}>
                    <View style={styles.historyItemTop}>
                      {record.author ? (
                        <View style={styles.authorContainer}>
                          {record.author.photo_url ? (
                            <Image
                              source={{ uri: getPhotoUrl(record.author.photo_url, record.author.user_id) || '' }}
                              style={styles.authorPhoto}
                              resizeMode="cover"
                              onError={(error) => {
                                console.log('❌ Ошибка загрузки фото автора:', {
                                  originalUrl: record.author?.photo_url,
                                  userId: record.author?.user_id,
                                  fullUrl: getPhotoUrl(record.author?.photo_url, record.author?.user_id),
                                  error: error.nativeEvent?.error,
                                });
                              }}
                              onLoad={() => {
                                console.log('✅ Фото автора загружено:', {
                                  originalUrl: record.author?.photo_url,
                                  userId: record.author?.user_id,
                                  fullUrl: getPhotoUrl(record.author?.photo_url, record.author?.user_id),
                                });
                              }}
                            />
                          ) : (
                            <View style={styles.authorPhotoPlaceholder}>
                              <Icon
                                name="account-circle"
                                size={getResponsiveSize(20, 22, 24)}
                                color={colors.textSecondary}
                              />
                            </View>
                          )}
                          <Text style={styles.authorName}>
                            {record.author.first_name || 'Пользователь'}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.authorContainer}>
                          <View style={styles.authorPhotoPlaceholder}>
                            <Icon
                              name="account-circle"
                              size={getResponsiveSize(20, 22, 24)}
                              color={colors.textSecondary}
                            />
                          </View>
                          <Text style={styles.authorName}>Система</Text>
                        </View>
                      )}
                      <Text style={styles.historyItemTime}>
                        {formatTime(record.timestamp)}
                      </Text>
                    </View>
                  <View style={styles.historyItemHeader}>
                    <Text style={styles.historyItemAction}>
                      {getActionText(record.action, record.type)}
                    </Text>
                  </View>
                  <View style={styles.historyItemContent}>
                    <View style={styles.quantityChange}>
                      <Text style={styles.quantityOld}>
                        {record.old_quantity ?? 0}
                      </Text>
                      <Icon
                        name="arrow-forward"
                        size={getResponsiveSize(16, 18, 20)}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.quantityNew}>
                        {record.new_quantity ?? 0}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyItemDate}>
                    {formatDate(record.timestamp)}
                  </Text>
                </View>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const createStyles = (
  isDark: boolean,
  insets: any,
  colors: any
) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: getResponsiveSize(24, 28, 32),
      borderTopRightRadius: getResponsiveSize(24, 28, 32),
      height: SCREEN_HEIGHT * 0.85,
      paddingBottom: Math.max(insets.bottom, getResponsiveSize(20, 24, 28)),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: getResponsiveSize(20, 24, 28),
      paddingTop: getResponsiveSize(20, 24, 28),
      paddingBottom: getResponsiveSize(16, 20, 24),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      flex: 1,
    },
    headerTitle: {
      fontSize: getResponsiveSize(20, 22, 24),
      fontWeight: '700',
      color: colors.text,
      marginBottom: getResponsiveSize(4, 6, 8),
    },
    headerSubtitle: {
      fontSize: getResponsiveSize(14, 15, 16),
      color: colors.textSecondary,
    },
    closeButton: {
      width: getResponsiveSize(40, 44, 48),
      height: getResponsiveSize(40, 44, 48),
      borderRadius: getResponsiveSize(20, 22, 24),
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonPressed: {
      opacity: 0.7,
    },
    content: {
      flex: 1,
      minHeight: 0,
    },
    contentContainer: {
      padding: getResponsiveSize(20, 24, 28),
      flexGrow: 1,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: getResponsiveSize(60, 80, 100),
    },
    loadingText: {
      marginTop: getResponsiveSize(16, 20, 24),
      fontSize: getResponsiveSize(14, 15, 16),
      color: colors.textSecondary,
    },
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: getResponsiveSize(60, 80, 100),
    },
    errorText: {
      marginTop: getResponsiveSize(16, 20, 24),
      fontSize: getResponsiveSize(14, 15, 16),
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: getResponsiveSize(80, 100, 120),
      paddingHorizontal: getResponsiveSize(24, 28, 32),
    },
    emptyIconContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: getResponsiveSize(24, 28, 32),
    },
    emptyIconCircle: {
      width: getResponsiveSize(120, 140, 160),
      height: getResponsiveSize(120, 140, 160),
      borderRadius: getResponsiveSize(60, 70, 80),
      backgroundColor: isDark
        ? 'rgba(255, 107, 53, 0.15)'
        : 'rgba(255, 107, 53, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: isDark
        ? 'rgba(255, 107, 53, 0.3)'
        : 'rgba(255, 107, 53, 0.2)',
    },
    emptyIconDot: {
      position: 'absolute',
      top: getResponsiveSize(20, 24, 28),
      right: getResponsiveSize(20, 24, 28),
      width: getResponsiveSize(16, 18, 20),
      height: getResponsiveSize(16, 18, 20),
      borderRadius: getResponsiveSize(8, 9, 10),
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.background,
    },
    emptyTitle: {
      fontSize: getResponsiveSize(22, 24, 26),
      fontWeight: '700',
      color: colors.text,
      marginBottom: getResponsiveSize(12, 14, 16),
      letterSpacing: -0.3,
    },
    emptyText: {
      fontSize: getResponsiveSize(15, 16, 17),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: getResponsiveSize(22, 24, 26),
      marginBottom: getResponsiveSize(24, 28, 32),
    },
    emptyHintContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(8, 10, 12),
      paddingVertical: getResponsiveSize(12, 14, 16),
      paddingHorizontal: getResponsiveSize(16, 18, 20),
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.03)',
      borderRadius: getResponsiveSize(12, 14, 16),
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyHintText: {
      fontSize: getResponsiveSize(13, 14, 15),
      color: colors.textSecondary,
      flex: 1,
    },
    historyItem: {
      padding: getResponsiveSize(16, 20, 24),
      backgroundColor: colors.surface,
      borderRadius: getResponsiveSize(12, 14, 16),
      marginBottom: getResponsiveSize(12, 14, 16),
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyItemTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: getResponsiveSize(12, 14, 16),
    },
    historyItemHeader: {
      marginBottom: getResponsiveSize(10, 12, 14),
    },
    historyItemAction: {
      fontSize: getResponsiveSize(15, 16, 17),
      fontWeight: '600',
      color: colors.text,
    },
    historyItemTime: {
      fontSize: getResponsiveSize(12, 13, 14),
      color: colors.textSecondary,
      fontWeight: '500',
    },
    historyItemContent: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginBottom: getResponsiveSize(8, 10, 12),
    },
    quantityChange: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(8, 10, 12),
    },
    quantityOld: {
      fontSize: getResponsiveSize(16, 17, 18),
      fontWeight: '600',
      color: colors.textSecondary,
    },
    quantityNew: {
      fontSize: getResponsiveSize(16, 17, 18),
      fontWeight: '600',
      color: colors.primary,
    },
    authorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(10, 12, 14),
      flex: 1,
    },
    authorPhoto: {
      width: getResponsiveSize(36, 40, 44),
      height: getResponsiveSize(36, 40, 44),
      borderRadius: getResponsiveSize(18, 20, 22),
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    authorPhotoPlaceholder: {
      width: getResponsiveSize(36, 40, 44),
      height: getResponsiveSize(36, 40, 44),
      borderRadius: getResponsiveSize(18, 20, 22),
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    authorName: {
      fontSize: getResponsiveSize(14, 15, 16),
      fontWeight: '600',
      color: colors.text,
    },
    historyItemDate: {
      fontSize: getResponsiveSize(12, 13, 14),
      color: colors.textSecondary,
    },
  });

export default ItemHistoryModal;

