import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

// Базовые размеры для расчета ширины меню
const getInitialDimensions = () => {
  const window = Dimensions.get('window');
  return {
    width: window.width,
  };
};

const { width: INITIAL_WIDTH } = getInitialDimensions();
const MENU_WIDTH = INITIAL_WIDTH; // На всю ширину экрана

interface SideMenuPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Управление жестом из родителя (если передано — внутренние анимации отключаются)
  controlledSlideX?: Animated.Value;
  controlledOverlayOpacity?: Animated.Value;
  controlledShouldRender?: boolean;
  // Панорамный жест для drag-to-close/open поверх панели
  dragPanHandlers?: any;
}

const SideMenuPanel: React.FC<SideMenuPanelProps> = ({ isOpen, onClose, controlledSlideX, controlledOverlayOpacity, controlledShouldRender, dragPanHandlers }) => {
  console.log('🟠 [SideMenuPanel] Компонент рендерится, isOpen:', isOpen);
  
  const windowDimensions = useWindowDimensions();
  const menuWidth = windowDimensions.width; // На всю ширину экрана
  const slideX = useRef(new Animated.Value(windowDimensions.width)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [isWinterAnimationEnabled, setIsWinterAnimationEnabled] = useState<boolean>(true);
  const [localShouldRender, setLocalShouldRender] = useState(false); // Контролируем рендеринг панели
  const isControlled = !!controlledSlideX || !!controlledOverlayOpacity;
  const shouldRender = controlledShouldRender ?? localShouldRender;
  const SWIPE_DISTANCE_THRESHOLD = 40;
  const SWIPE_VELOCITY_THRESHOLD = 0.2;
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const { user, accounts } = useAppSelector((state: any) => state.auth);
  const { theme, toggleTheme } = useTheme();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // Получаем полную высоту экрана
  const screenDimensions = Dimensions.get('screen');
  const fullScreenHeight = screenDimensions.height;
  
  // Для Android используем StatusBar.currentHeight, для iOS - insets.top
  const statusBarHeight = Platform.OS === 'android' 
    ? (StatusBar.currentHeight || 0) 
    : insets.top;

  useEffect(() => {
    // Загружаем состояние зимней анимации из AsyncStorage
    AsyncStorage.getItem('flowix-winter-decor-enabled').then((stored) => {
      if (stored !== null) {
        setIsWinterAnimationEnabled(stored === 'true');
      }
    });
  }, []);

  // Делаем status bar прозрачным, когда панель открыта, чтобы панель была видна под ним
  useEffect(() => {
    if (isOpen && Platform.OS === 'android') {
      // Делаем status bar прозрачным, чтобы панель была видна под ним
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor('transparent', true);
      
      // Восстанавливаем при закрытии
      return () => {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent', true);
      };
    }
  }, [isOpen]);

  // Анимация выезжания панели с плавными параметрами
  useEffect(() => {
    if (isControlled) return; // управление из родителя
    console.log('🔄 [SideMenuPanel] isOpen changed:', isOpen, 'menuWidth:', menuWidth);
    if (isOpen) {
      setLocalShouldRender(true); // Показываем панель перед анимацией
      console.log('➡️ [SideMenuPanel] Открываем панель, анимация slideX: 0');
      // Плавное выезжание панели
      // Останавливаем возможные предыдущие анимации, чтобы избежать дёрганий при быстром тапе
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
      console.log('⬅️ [SideMenuPanel] Закрываем панель, анимация slideX:', menuWidth);
      // Плавное задвижение панели
      // Останавливаем возможные предыдущие анимации, чтобы избежать наложения
      slideX.stopAnimation();
      overlayOpacity.stopAnimation();
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: menuWidth,
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
    // Важно: не сбрасываем позицию, пока идёт анимация закрытия (shouldRender === true)
    if (!isOpen && !shouldRender) {
      slideX.setValue(menuWidth);
      overlayOpacity.setValue(0);
    }
  }, [menuWidth, isOpen, shouldRender, isControlled]);

  // Внутренний PanResponder: свайп внутри правой панели ВПРАВО — закрыть
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
          return;
        }
        // База 0; жест ВПРАВО закрывает — translateX положительно с "резиной"
        const dx = Math.max(0, g.dx);
        let translate = dx; // 0..+menuWidth
        if (translate > menuWidth) {
          const over = translate - menuWidth;
          translate = menuWidth + over / 3;
        }
        translate = Math.max(0, Math.min(menuWidth, translate));
        slideX.setValue(translate);
        const progress = Math.min(1, Math.max(0, (menuWidth - translate) / menuWidth));
        overlayOpacity.setValue(progress);
      },
      onPanResponderRelease: (_e, g) => {
        if (!isOpen) return;
        const shouldClose = g.dx > SWIPE_DISTANCE_THRESHOLD || g.vx > SWIPE_VELOCITY_THRESHOLD;
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
            toValue: shouldClose ? menuWidth : 0,
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

  const handleThemeToggle = () => {
    toggleTheme();
    console.log('🔄 [SideMenuPanel] Тема переключена на:', theme === 'light' ? 'dark' : 'light');
  };

  const handleWinterToggle = async () => {
    const next = !isWinterAnimationEnabled;
    setIsWinterAnimationEnabled(next);
    await AsyncStorage.setItem('flowix-winter-decor-enabled', String(next));
    // TODO: Отправить событие для обновления UI
    Alert.alert('Успешно', `Зимняя анимация ${next ? 'включена' : 'выключена'}`);
  };

  const handleTutorialClick = () => {
    onClose();
    // TODO: Реализовать открытие обучающих материалов
    Alert.alert('Информация', 'Обучающие материалы будут реализованы позже');
  };


  // Не рендерим панель, если она не нужна
  if (!shouldRender) {
    return null;
  }

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

      {/* Side Menu */}
      <Animated.View
        style={{
          position: 'absolute',
          right: 0,
          top: -insets.top, // Компенсируем отступ SafeAreaView, чтобы панель начиналась с самого верха экрана
          height: fullScreenHeight + insets.top, // Добавляем insets.top к высоте, чтобы панель была на всю высоту
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
            backgroundColor: '#FF6B35', // Orange primary
            borderTopLeftRadius: 0, // Убрали, чтобы панель шла до самого верха
            borderBottomLeftRadius: 20,
            shadowColor: '#000',
            shadowOffset: { width: -5, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 15,
            elevation: 10,
          }}
          pointerEvents={isDragging ? 'none' : 'auto'}
        >
          <View style={{ flex: 1 }}>
            {/* Back Button */}
            <Pressable
              onPressIn={onClose}
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
                  backgroundColor: pressed 
                    ? 'rgba(255, 107, 53, 0.3)'
                    : 'transparent',
                  zIndex: 1005,
                  elevation: 1005,
                },
              ]}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              {({ pressed }) => (
                <Icon name="arrow-back" size={28} color={pressed ? '#FF6B35' : '#FFFFFF'} />
              )}
            </Pressable>
            
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Spacer для header главного меню - точно соответствует высоте header */}
              <View
                style={{
                  // Высота header главного меню:
                  // - SafeAreaView edges={['top']} добавляет insets.top
                  // - paddingTop: 12
                  // - Высота элементов: max(аватарка 60px, бургер 48px) = 60px
                  // - paddingBottom: 12
                  height: insets.top + 12 + 60 + 12, // insets.top + paddingTop + высота элементов + paddingBottom
                }}
              />

              {/* Avatar in Header */}
              <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 8 }}>
                {user?.photoUrl ? (
                  <Image
                    source={{ uri: user.photoUrl }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      borderWidth: 3,
                      borderColor: '#FFFFFF',
                    }}
                    resizeMode="cover"
                    onError={(error) => {
                      console.error('❌ [SideMenuPanel] Ошибка загрузки аватарки:', error.nativeEvent.error);
                    }}
                    onLoad={() => {
                      console.log('✅ [SideMenuPanel] Аватарка загружена успешно');
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 3,
                      borderColor: '#FFFFFF',
                    }}
                  >
                    <Icon 
                      name="account-circle" 
                      size={48} 
                      color="#FFFFFF" 
                    />
                  </View>
                )}
              </View>

            {/* Menu Options */}
            <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
              {/* Обучающие материалы */}
              <Pressable
                onPress={handleTutorialClick}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#FFFFFF',
                    flex: 1,
                  }}
                >
                  Обучающие материалы
                </Text>
                <Icon name="school" size={24} color="#FFFFFF" />
              </Pressable>

              {/* Зимняя анимация */}
              <Pressable
                onPress={handleWinterToggle}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#FFFFFF',
                    flex: 1,
                  }}
                >
                  {isWinterAnimationEnabled
                    ? 'Выключить зимнюю анимацию'
                    : 'Включить зимнюю анимацию'}
                </Text>
                <Icon name="ac-unit" size={24} color="#FFFFFF" />
              </Pressable>

            </View>
            </ScrollView>

            {/* Footer - Theme Toggle */}
            <View
              style={{
                padding: 20,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                paddingBottom: Math.max(insets.bottom + 20, 20),
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.15)',
                backgroundColor: 'transparent',
              }}
            >
              {/* Кнопка смены темы */}
              <Pressable
                onPress={handleThemeToggle}
                style={({ pressed }) => [
                  {
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 5,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Icon
                  name={theme === 'dark' ? 'light-mode' : 'dark-mode'}
                  size={24}
                  color="#FF6B35"
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
    </>
  );
};

export default SideMenuPanel;

