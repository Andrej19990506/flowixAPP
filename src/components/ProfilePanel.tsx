import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  switchAccountThunk,
  logoutThunk,
  type Account,
} from '../store/slices/authSlice';
import type { Role, UserGroup } from '../types/user';
import { Alert } from 'react-native';

// Компонент кнопки назад с отслеживанием состояния нажатия
const BackButton: React.FC<{ onClose: () => void; theme: 'light' | 'dark'; insets: any }> = ({ onClose, theme, insets }) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <Pressable
      onPressIn={(e) => {
        e.stopPropagation();
        setIsPressed(true);
        console.log('🔴 [ProfilePanel] Стрелка назад нажата, закрываем панель');
        onClose();
      }}
      onPressOut={() => setIsPressed(false)}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} // Максимальная область клика
      style={({ pressed }) => [
        {
          position: 'absolute',
          top: Platform.OS === 'android' 
            ? (StatusBar.currentHeight || 0) + 40 
            : insets.top + 40,
          left: 24,
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 24,
          backgroundColor: pressed || isPressed 
            ? (theme === 'dark' ? 'rgba(255, 107, 53, 0.3)' : 'rgba(255, 107, 53, 0.2)')
            : 'transparent',
          zIndex: 1005, // Выше панели (1004)
          elevation: 1005, // Для Android
        },
      ]}
    >
      <Icon name="arrow-back" size={28} color={isPressed ? '#FF6B35' : (theme === 'dark' ? '#FFFFFF' : '#000000')} />
    </Pressable>
  );
};

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeRole: Role;
  activeGroup: string | null; // ID выбранной группы
  onGroupSelect: (groupId: string, role: Role) => void;
  // Управление жестом из родителя (если передано — внутренние анимации отключаются)
  controlledSlideX?: Animated.Value;
  controlledOverlayOpacity?: Animated.Value;
  controlledShouldRender?: boolean;
  // Панорамный жест для drag-to-close/open поверх панели
  dragPanHandlers?: any;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({ isOpen, onClose, activeRole, activeGroup, onGroupSelect, controlledSlideX, controlledOverlayOpacity, controlledShouldRender, dragPanHandlers }) => {
  console.log('🔵 [ProfilePanel] Компонент рендерится, isOpen:', isOpen, 'controlledShouldRender:', controlledShouldRender, 'controlledSlideX:', !!controlledSlideX);
  
  const windowDimensions = useWindowDimensions();
  const menuWidth = windowDimensions.width; // На всю ширину экрана
  const slideX = useRef(new Animated.Value(-windowDimensions.width)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const accountsOpacity = useRef(new Animated.Value(1)).current;
  const SWIPE_DISTANCE_THRESHOLD = 40;
  const SWIPE_VELOCITY_THRESHOLD = 0.2;
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [photoErrors, setPhotoErrors] = useState<Record<string, boolean>>({}); // Отслеживаем ошибки загрузки фото
  const [isAccountsExpanded, setIsAccountsExpanded] = useState<boolean>(true); // Состояние сворачивания/разворачивания аккаунтов
  const [localShouldRender, setLocalShouldRender] = useState(false); // Контролируем рендеринг панели
  const isControlled = !!controlledSlideX || !!controlledOverlayOpacity;
  const shouldRender = controlledShouldRender ?? localShouldRender;
  const { user, accounts, currentAccountId } = useAppSelector((state: any) => state.auth);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // Сбрасываем ошибки фото при смене пользователя
  useEffect(() => {
    if (user?.id) {
      // Сбрасываем ошибку для текущего пользователя, чтобы попробовать загрузить фото снова
      setPhotoErrors(prev => {
        const newState = { ...prev };
        delete newState[user.id];
        return newState;
      });
    }
  }, [user?.id]);
  
  // Получаем полную высоту экрана
  const screenDimensions = Dimensions.get('screen');
  const fullScreenHeight = screenDimensions.height;

  // Делаем status bar прозрачным, когда панель открыта
  useEffect(() => {
    if (isOpen && Platform.OS === 'android') {
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor('transparent', true);
      
      return () => {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent', true);
      };
    }
  }, [isOpen]);

  // Отслеживаем изменения controlledSlideX для отладки
  useEffect(() => {
    if (controlledSlideX) {
      const listener = controlledSlideX.addListener(({ value }) => {
        // Логируем только значимые изменения (каждые 20px)
        if (Math.floor(Math.abs(value)) % 20 === 0 || Math.abs(value) < 5) {
          console.log(`🔵 [ProfilePanel] controlledSlideX изменился: ${value.toFixed(1)}`);
        }
      });
      return () => {
        controlledSlideX.removeListener(listener);
      };
    }
  }, [controlledSlideX]);

  // Анимация выезжания панели с плавными параметрами
  useEffect(() => {
    if (isControlled) {
      console.log('🔄 [ProfilePanel] isControlled=true, пропускаем внутренние анимации');
      return; // управление из родителя
    }
    console.log('🔄 [ProfilePanel] isOpen changed:', isOpen, 'menuWidth:', menuWidth);
    if (isOpen) {
      setLocalShouldRender(true); // Показываем панель перед анимацией
      console.log('➡️ [ProfilePanel] Открываем панель, анимация slideX: 0');
      // Плавное выезжание панели
      // Останавливаем возможные предыдущие анимации, чтобы исключить наложение и фризы
      slideX.stopAnimation();
      overlayOpacity.stopAnimation();
      Animated.parallel([
        Animated.spring(slideX, {
          toValue: 0,
          friction: 9,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (shouldRender) {
      console.log('⬅️ [ProfilePanel] Закрываем панель, анимация slideX:', -menuWidth);
      // Плавное задвижение панели
      // Останавливаем возможные предыдущие анимации
      slideX.stopAnimation();
      overlayOpacity.stopAnimation();
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: -menuWidth,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // После завершения анимации скрываем панель
        if (finished) {
          setLocalShouldRender(false);
        }
      });
    }
  }, [isOpen, menuWidth, isControlled, shouldRender]);

  // Обновляем позицию при изменении ширины экрана
  useEffect(() => {
    if (isControlled) return;
    // Не сбрасываем мгновенно, пока идёт закрывающая анимация (shouldRender === true)
    if (!isOpen && !shouldRender) {
      slideX.setValue(-menuWidth);
      overlayOpacity.setValue(0);
    }
  }, [menuWidth, isOpen, shouldRender, isControlled]);

  // Анимация сворачивания/разворачивания аккаунтов (упрощенная версия без scaleY)
  useEffect(() => {
    if (isAccountsExpanded) {
      Animated.timing(accountsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(accountsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isAccountsExpanded]);

  // Внутренний PanResponder: свайп внутри левой панели ВПРАВО — закрыть
  const internalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        isOpen && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) + 2,
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        isOpen && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) + 2,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        setIsDragging(true);
      },
      onPanResponderMove: (_e, g) => {
        if (!isOpen) return;
        if (isControlled) {
          // В контролируемом режиме не двигаем сами значения — решаем на release
          return;
        }
        // База 0; жест ВЛЕВО закрывает — двигаем панель влево (translateX отрицательно) с "резиной"
        const dx = Math.min(0, g.dx); // только влево (dx<=0)
        let translate = dx; // 0 .. -menuWidth
        if (translate < -menuWidth) {
          const over = -menuWidth - translate;
          translate = -menuWidth - over / 3; // сопротивление за пределами
        }
        translate = Math.max(-menuWidth, Math.min(0, translate));
        slideX.setValue(translate);
        const progress = Math.min(1, Math.max(0, (translate + menuWidth) / menuWidth));
        overlayOpacity.setValue(progress);
      },
      onPanResponderRelease: (_e, g) => {
        if (!isOpen) return;
        const shouldClose = -g.dx > SWIPE_DISTANCE_THRESHOLD || -g.vx > SWIPE_VELOCITY_THRESHOLD;
        if (isControlled) {
          if (shouldClose) {
            onClose();
          }
          isDraggingRef.current = false;
          setIsDragging(false);
          return;
        }
        Animated.parallel([
          Animated.timing(slideX, {
            toValue: shouldClose ? -menuWidth : 0,
            duration: 230,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(overlayOpacity, {
            toValue: shouldClose ? 0 : 1,
            duration: 230,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          isDraggingRef.current = false;
          setIsDragging(false);
          if (shouldClose) {
            setLocalShouldRender(false);
            onClose();
          }
        });
      },
    })
  ).current;

  // Группируем группы по типу
  // Определяем тип группы на основе company_role.role_code или group_type
  const allGroups = user?.groups || [];
  const chefGroups = allGroups.filter((g: UserGroup) => {
    // Если есть company_role, используем role_code для определения типа
    if (g.company_role?.role_code) {
      return g.company_role.role_code.includes('chef') || g.company_role.role_code.includes('cook');
    }
    // Иначе используем group_type
    return g.group_type === 'chef';
  });
  const courierGroups = allGroups.filter((g: UserGroup) => {
    // Если есть company_role, используем role_code для определения типа
    if (g.company_role?.role_code) {
      return g.company_role.role_code.includes('courier') || g.company_role.role_code.includes('courer') || g.company_role.role_code.includes('delivery');
    }
    // Иначе используем group_type
    return g.group_type === 'courier';
  });
  // Остальные группы (без явного типа или с другими типами)
  const otherGroups = allGroups.filter((g: UserGroup) => {
    return !chefGroups.includes(g) && !courierGroups.includes(g);
  });

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'chef':
        return 'restaurant';
      case 'courier':
        return 'delivery-dining';
      default:
        return 'person';
    }
  };

  const getRoleName = (role: Role) => {
    switch (role) {
      case 'chef':
        return 'Повар';
      case 'courier':
        return 'Курьер';
      default:
        return 'Нет роли';
    }
  };


  // Не рендерим панель, если она не нужна
  if (!shouldRender) {
    console.log('🔵 [ProfilePanel] shouldRender=false, не рендерим');
    return null;
  }
  console.log('🔵 [ProfilePanel] shouldRender=true, рендерим панель');

  return (
    <>
      {/* Overlay с плавной анимацией */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1003, // Выше хедера (1002)
          elevation: 1003, // Для Android
          opacity: controlledOverlayOpacity ?? overlayOpacity,
        }}
        pointerEvents={shouldRender ? 'auto' : 'none'}
      >
        <Pressable
          style={{
            flex: 1,
          }}
          onPressIn={onClose}
        />
      </Animated.View>

      {/* Profile Panel */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: -insets.top,
          height: fullScreenHeight + insets.top,
          width: menuWidth,
          zIndex: 1004, // Выше хедера (1002) и оверлея (1003)
          elevation: 1004, // Для Android
          transform: [{ translateX: controlledSlideX ?? slideX }],
        }}
        pointerEvents={shouldRender ? 'auto' : 'none'}
        {...internalPanResponder.panHandlers}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme === 'dark' ? '#1A1A1A' : '#FFFFFF',
            borderTopRightRadius: 0,
            borderBottomRightRadius: 20,
            shadowColor: '#000',
            shadowOffset: { width: 5, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 15,
            elevation: 10,
          }}
          pointerEvents={isDragging ? 'none' : 'auto'}
        >
          <View style={{ flex: 1 }}>
            {/* Back Button - вынесен из ScrollView для лучшей кликабельности */}
            <BackButton 
              onClose={onClose}
              theme={theme}
              insets={insets}
            />
            
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Profile Header */}
              <View
                style={{
                  paddingHorizontal: 24,
                  paddingTop: Platform.OS === 'android' 
                    ? (StatusBar.currentHeight || 0) + 32 // Увеличили отступ от status bar
                    : insets.top + 32, // Увеличили отступ от status bar
                  paddingBottom: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >

                {/* User Avatar */}
                <View style={{ alignItems: 'center', marginTop: 8 }}>
                  {user?.photoUrl && !photoErrors[user.id] ? (
                    <Image
                      source={{ uri: user.photoUrl }}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        borderWidth: 3,
                        borderColor: '#FF6B35',
                      }}
                      resizeMode="cover"
                      onError={() => {
                        setPhotoErrors(prev => ({ ...prev, [user.id]: true }));
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: theme === 'dark' 
                          ? 'rgba(255, 255, 255, 0.1)' 
                          : '#E0E0E0',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: '#FF6B35',
                      }}
                    >
                      <Icon 
                        name="account-circle" 
                        size={48} 
                        color={theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : '#666666'} 
                      />
                    </View>
                  )}
                  
                  {/* User Name */}
                  <Text
                    style={{
                      marginTop: 16,
                      fontSize: 20,
                      fontWeight: '600',
                      color: theme === 'dark' ? '#FFFFFF' : '#000000',
                    }}
                  >
                    {user?.firstName} {user?.lastName}
                  </Text>
                  
                  {user?.username && (
                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 14,
                        color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                      }}
                    >
                      @{user.username}
                    </Text>
                  )}
                </View>

                {/* Accounts Section */}
                <View style={{ marginTop: 24 }}>
                  {/* Accounts Header with Collapse Button */}
                  {(() => {
                    const accountsCount = accounts ? Object.keys(accounts).length : 0;
                    const headerColor = isAccountsExpanded 
                      ? (theme === 'dark' ? '#FFFFFF' : '#000000')
                      : '#FF6B35';
                    
                    return (
                      <Pressable
                        onPress={() => setIsAccountsExpanded(!isAccountsExpanded)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 12,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '600',
                              color: headerColor,
                            }}
                          >
                            Аккаунты
                          </Text>
                          <Text
                            style={{
                              marginLeft: 8,
                              fontSize: 16,
                              fontWeight: '600',
                              color: headerColor,
                            }}
                          >
                            {accountsCount}
                          </Text>
                        </View>
                        <Icon
                          name={isAccountsExpanded ? 'expand-less' : 'expand-more'}
                          size={24}
                          color={headerColor}
                        />
                      </Pressable>
                    );
                  })()}

                  {/* Все аккаунты - анимированное сворачивание/разворачивание */}
                  <Animated.View
                    style={{
                      overflow: 'hidden',
                      opacity: accountsOpacity,
                    }}
                  >
                    {/* Active Account */}
                    {user && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            borderRadius: 12,
                            backgroundColor: theme === 'dark' ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 107, 53, 0.1)',
                            marginBottom: 8,
                            borderWidth: 2,
                            borderColor: '#FF6B35',
                          }}
                        >
                          {user.photoUrl && !photoErrors[user.id] ? (
                            <Image
                              source={{ uri: user.photoUrl }}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginRight: 12,
                              }}
                              onError={() => {
                                setPhotoErrors(prev => ({ ...prev, [user.id]: true }));
                              }}
                            />
                          ) : (
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#E0E0E0',
                                marginRight: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icon name="account-circle" size={24} color={theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : '#666666'} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: theme === 'dark' ? '#FFFFFF' : '#000000',
                              }}
                            >
                              {user.firstName} {user.lastName}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                              }}
                            >
                              Активен
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Other Accounts */}
                      {accounts && Object.keys(accounts).length > 0 && (Object.values(accounts) as Account[]).map((account) => {
                        if (account.userId === currentAccountId) {
                          return null; // Пропускаем активный аккаунт
                        }
                        const accountUser = account.user;
                        const fullName = `${accountUser.firstName} ${accountUser.lastName}`.trim() || accountUser.username || `User ${account.userId}`;
                        
                        return (
                          <Pressable
                            key={account.userId}
                            onPress={async () => {
                              try {
                                await dispatch(switchAccountThunk(account.userId)).unwrap();
                                onClose(); // Закрываем панель после переключения
                              } catch (error: any) {
                                Alert.alert('Ошибка', error || 'Не удалось переключить аккаунт');
                              }
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: 12,
                              borderRadius: 12,
                              backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                              marginBottom: 8,
                            }}
                          >
                            {accountUser.photoUrl && !photoErrors[account.userId] ? (
                              <Image
                                source={{ uri: accountUser.photoUrl }}
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 20,
                                  marginRight: 12,
                                }}
                                onError={() => {
                                  setPhotoErrors(prev => ({ ...prev, [account.userId]: true }));
                                }}
                              />
                            ) : (
                              <View
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 20,
                                  backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#E0E0E0',
                                  marginRight: 12,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Icon name="account-circle" size={24} color={theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : '#666666'} />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: '500',
                                  color: theme === 'dark' ? '#FFFFFF' : '#000000',
                                }}
                              >
                                {fullName}
                              </Text>
                              {accountUser.username && (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                                  }}
                                >
                                  @{accountUser.username}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                        );
                      })}

                    {/* Add Account Button */}
                    <Pressable
                      onPress={() => {
                        onClose();
                        // Перенаправляем на экран авторизации
                        navigation.navigate('Auth');
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: theme === 'dark' ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.1)',
                        borderWidth: 1,
                        borderColor: '#FF6B35',
                        borderStyle: 'dashed',
                        marginTop: 8,
                      }}
                    >
                      <Icon name="add-circle-outline" size={20} color="#FF6B35" />
                      <Text
                        style={{
                          marginLeft: 8,
                          fontSize: 14,
                          fontWeight: '500',
                          color: '#FF6B35',
                        }}
                      >
                        Добавить аккаунт
                      </Text>
                    </Pressable>
                  </Animated.View>
                </View>
              </View>

              {/* Groups Section */}
              <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: theme === 'dark' ? '#FFFFFF' : '#000000',
                    marginBottom: 16,
                  }}
                >
                  Ваши группы
                </Text>

                {/* Chef Groups */}
                {chefGroups.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <Icon name="restaurant" size={20} color="#FF6B35" />
                      <Text
                        style={{
                          marginLeft: 8,
                          fontSize: 16,
                          fontWeight: '500',
                          color: theme === 'dark' ? '#FFFFFF' : '#000000',
                        }}
                      >
                        Повар ({chefGroups.length})
                      </Text>
                    </View>
                    
                    {chefGroups.map((group: UserGroup) => {
                      const isActive = activeGroup === group.id;
                      return (
                        <Pressable
                          key={group.id}
                          onPress={() => onGroupSelect(group.id, 'chef')}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 16,
                            borderRadius: 12,
                            marginBottom: 8,
                            backgroundColor: isActive
                              ? 'rgba(255, 107, 53, 0.15)' 
                              : theme === 'dark' 
                                ? 'rgba(255, 255, 255, 0.08)' 
                                : 'rgba(0, 0, 0, 0.05)',
                            borderWidth: isActive ? 2 : 1,
                            borderColor: isActive
                              ? '#FF6B35' 
                              : theme === 'dark' 
                                ? 'rgba(255, 255, 255, 0.15)' 
                                : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: '#FF6B35',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 12,
                            }}
                          >
                            <Icon name="restaurant" size={20} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: '500',
                                color: theme === 'dark' ? '#FFFFFF' : '#000000',
                              }}
                            >
                              {group.name}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                                marginTop: 2,
                              }}
                            >
                              {getRoleName('chef')}
                            </Text>
                          </View>
                          {isActive && (
                            <Icon name="check-circle" size={24} color="#FF6B35" />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Courier Groups */}
                {courierGroups.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <Icon name="delivery-dining" size={20} color="#FF6B35" />
                      <Text
                        style={{
                          marginLeft: 8,
                          fontSize: 16,
                          fontWeight: '500',
                          color: theme === 'dark' ? '#FFFFFF' : '#000000',
                        }}
                      >
                        Курьер ({courierGroups.length})
                      </Text>
                    </View>
                    
                    {courierGroups.map((group: UserGroup) => {
                      const isActive = activeGroup === group.id;
                      return (
                        <Pressable
                          key={group.id}
                          onPress={() => onGroupSelect(group.id, 'courier')}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 16,
                            borderRadius: 12,
                            marginBottom: 8,
                            backgroundColor: isActive
                              ? 'rgba(255, 107, 53, 0.15)' 
                              : theme === 'dark' 
                                ? 'rgba(255, 255, 255, 0.08)' 
                                : 'rgba(0, 0, 0, 0.05)',
                            borderWidth: isActive ? 2 : 1,
                            borderColor: isActive
                              ? '#FF6B35' 
                              : theme === 'dark' 
                                ? 'rgba(255, 255, 255, 0.15)' 
                                : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: '#FF6B35',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 12,
                            }}
                          >
                            <Icon name="delivery-dining" size={20} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: '500',
                                color: theme === 'dark' ? '#FFFFFF' : '#000000',
                              }}
                            >
                              {group.name}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                                marginTop: 2,
                              }}
                            >
                              {getRoleName('courier')}
                            </Text>
                          </View>
                          {isActive && (
                            <Icon name="check-circle" size={24} color="#FF6B35" />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Other Groups (без явного типа) */}
                {otherGroups.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <Icon name="groups" size={20} color="#FF6B35" />
                      <Text
                        style={{
                          marginLeft: 8,
                          fontSize: 16,
                          fontWeight: '500',
                          color: theme === 'dark' ? '#FFFFFF' : '#000000',
                        }}
                      >
                        Группы ({otherGroups.length})
                      </Text>
                    </View>
                    
                    {otherGroups.map((group: UserGroup) => {
                      const isActive = activeGroup === group.id;
                      const roleName = group.company_role?.role_name || getRoleName(group.group_type || 'none');
                      return (
                        <Pressable
                          key={group.id}
                          onPress={() => onGroupSelect(group.id, group.group_type || 'none')}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 16,
                            borderRadius: 12,
                            marginBottom: 8,
                            backgroundColor: isActive
                              ? 'rgba(255, 107, 53, 0.15)' 
                              : theme === 'dark' 
                                ? 'rgba(255, 255, 255, 0.08)' 
                                : 'rgba(0, 0, 0, 0.05)',
                            borderWidth: isActive ? 2 : 1,
                            borderColor: isActive
                              ? '#FF6B35' 
                              : theme === 'dark' 
                                ? 'rgba(255, 255, 255, 0.15)' 
                                : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: group.company_role?.color || '#FF6B35',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 12,
                            }}
                          >
                            {group.company_role?.icon && /[\u{1F300}-\u{1F9FF}]/u.test(group.company_role.icon) ? (
                              <Text style={{ fontSize: 20 }}>{group.company_role.icon}</Text>
                            ) : (
                              <Icon name={group.company_role?.icon || "groups"} size={20} color="#FFFFFF" />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: '500',
                                color: theme === 'dark' ? '#FFFFFF' : '#000000',
                              }}
                            >
                              {group.name}
                            </Text>
                            {group.company?.company_name && (
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                                  marginTop: 2,
                                }}
                              >
                                {group.company.company_name}
                              </Text>
                            )}
                            <Text
                              style={{
                                fontSize: 12,
                                color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                                marginTop: 2,
                              }}
                            >
                              {roleName}
                            </Text>
                          </View>
                          {isActive && (
                            <Icon name="check-circle" size={24} color="#FF6B35" />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* No Groups */}
                {(!chefGroups.length && !courierGroups.length && !otherGroups.length) && (
                  <View
                    style={{
                      padding: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="info-outline" size={48} color={theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'} />
                    <Text
                      style={{
                        marginTop: 16,
                        fontSize: 16,
                        color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                        textAlign: 'center',
                      }}
                    >
                      Вы не состоите ни в одной группе
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer - Logout Button */}
            <View
              style={{
                padding: 20,
                paddingBottom: Math.max(insets.bottom + 20, 20),
                borderTopWidth: 1,
                borderTopColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                backgroundColor: 'transparent',
              }}
            >
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Выход',
                    'Вы уверены, что хотите выйти?',
                    [
                      {
                        text: 'Отмена',
                        style: 'cancel',
                      },
                      {
                        text: 'Выйти',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await dispatch(logoutThunk()).unwrap();
                            onClose(); // Закрываем панель
                            console.log('✅ [ProfilePanel] Выход выполнен успешно');
                          } catch (error) {
                            console.error('❌ [ProfilePanel] Ошибка при выходе:', error);
                            Alert.alert('Ошибка', 'Не удалось выйти из аккаунта');
                          }
                        },
                      },
                    ],
                    { cancelable: true }
                  );
                }}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: theme === 'dark' ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.1)',
                    borderWidth: 1,
                    borderColor: '#FF6B35',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Icon name="exit-to-app" size={24} color="#FF6B35" />
                <Text
                  style={{
                    marginLeft: 12,
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#FF6B35',
                  }}
                >
                  Выйти
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
    </>
  );
};

export default ProfilePanel;

