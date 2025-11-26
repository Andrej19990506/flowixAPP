import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  Image,
  type PressableStateCallbackType,
  StatusBar,
  Platform,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dimensions, Animated, Easing } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../store/hooks';
import { useTheme } from '../contexts/ThemeContext';
import type { Role, User } from '../types/user';
import type { RootStackParamList } from '../navigation/AppNavigator';
import SideMenuPanel from '../components/SideMenuPanel';
import ProfilePanel from '../components/ProfilePanel';

type MenuItem = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
};

// Маппинг между feature_code из БД и элементами меню
const featureCodeToMenuItem: Record<string, Omit<MenuItem, 'id'>> = {
  'events': { title: 'События', description: 'Управление событиями' },
  'inventory': { title: 'Инвентарь', description: 'Управление инвентаризацией товаров' },
  'write-off': { title: 'Списание', description: 'Управление списанием товаров' },
  'purchasing': { title: 'Закупки', description: 'Управление закупками товаров' },
  'requests': { title: 'Поставки', description: 'Управление поставками' },
  'courier-schedule': { title: 'Записаться', description: 'Запись на смены курьеров' },
  'shifts': { title: 'Смены', description: 'Управление сменами сотрудников' },
  'notifications': { title: 'Уведомления', description: 'Отправка уведомлений в группы' },
};

const MainMenuScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeGroup, setActiveGroup] = useState<string | null>(null); // ID выбранной группы
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // Флаги для принудительного рендеринга панелей при начале жеста
  const [forceProfileRender, setForceProfileRender] = useState(false);
  const [forceSideRender, setForceSideRender] = useState(false);
  const [photoError, setPhotoError] = useState<Record<string, boolean>>({}); // Отслеживаем ошибки загрузки фото по userId
  const { user, isAuthenticated } = useAppSelector((state: any) => state.auth);
  const { theme } = useTheme();

  // Перенаправляем на Auth, если пользователь не авторизован
  useEffect(() => {
    if (!isAuthenticated) {
      console.log('⚠️ [MainMenuScreen] Пользователь не авторизован, перенаправляем на Auth');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    }
  }, [isAuthenticated, navigation]);
  const EDGE_WIDTH = 24; // Увеличен порог для более удобного захвата от краев
  const SWIPE_DISTANCE_THRESHOLD = 40;
  const SWIPE_VELOCITY_THRESHOLD = 0.2;
  const screenWidthRef = useRef(Dimensions.get('window').width);
  const screenWidth = screenWidthRef.current;
  // Ref для сохранения начальной позиции касания в unified edge PanResponder
  const initialTouchXRef = useRef<number | null>(null);
  // Контролируемые значения для панелей (следуют за жестом)
  const profileSlideX = useRef(new Animated.Value(-screenWidth)).current;   // от -W до 0
  const profileOverlay = useRef(new Animated.Value(0)).current;             // 0..1
  const sideSlideX = useRef(new Animated.Value(screenWidth)).current;       // от W до 0
  const sideOverlay = useRef(new Animated.Value(0)).current;                // 0..1
  const settleTiming = (value: Animated.Value, toValue: number, duration = 220) =>
    Animated.timing(value, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
  
  // Сбрасываем ошибки фото при смене пользователя
  useEffect(() => {
    if (user?.id) {
      // Сбрасываем ошибку для текущего пользователя, чтобы попробовать загрузить фото снова
      setPhotoError(prev => {
        const newState = { ...prev };
        delete newState[user.id];
        return newState;
      });
    }
  }, [user?.id]);
  
  // Убрали анимацию бургера: используем статичную иконку меню/крестика без Animated
  // Unified edge swipe PanResponder - по паттерну из официальной документации
  // Но с проверкой координат, чтобы не блокировать клики
  const unifiedEdgePanResponder = useRef(
    PanResponder.create({
      // НЕ захватываем на touchstart - ждем движения (как в примере, но с проверкой)
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      
      // Проверяем координаты и движение - захватываем только жесты из edge zones
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        // Во время жеста (forceRender) продолжаем получать события
        if (forceProfileRender || forceSideRender) {
          return true;
        }
        if (isMenuOpen || isProfileOpen) return false;
        
        // Проверяем координаты начального касания из gestureState (g.x0 - это начальная X координата)
        const touchX = g.x0 || _e.nativeEvent.pageX || 0;
        const isLeftEdge = touchX <= EDGE_WIDTH;
        const isRightEdge = touchX >= screenWidthRef.current - EDGE_WIDTH;
        
        // Захватываем ТОЛЬКО горизонтальные движения из edge zones
        const isHorizontal = Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) + 3;
        return (isLeftEdge || isRightEdge) && isHorizontal;
      },
      onMoveShouldSetPanResponderCapture: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        // Во время жеста (forceRender) продолжаем получать события
        if (forceProfileRender || forceSideRender) {
          return true;
        }
        if (isMenuOpen || isProfileOpen) return false;
        
        // Проверяем координаты начального касания
        const touchX = g.x0 || _e.nativeEvent.pageX || 0;
        const isLeftEdge = touchX <= EDGE_WIDTH;
        const isRightEdge = touchX >= screenWidthRef.current - EDGE_WIDTH;
        
        // Захватываем ТОЛЬКО горизонтальные движения из edge zones
        const isHorizontal = Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) + 3;
        return (isLeftEdge || isRightEdge) && isHorizontal;
      },
      
      // Не отдаем жест другим компонентам
      onPanResponderTerminationRequest: () => false,
      
      // Блокируем нативные обработчики только во время жеста (как в примере)
      onShouldBlockNativeResponder: () => {
        return forceProfileRender || forceSideRender;
      },
      onPanResponderGrant: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        if (isMenuOpen || isProfileOpen) return;
        // Используем x0 из gestureState - это начальная позиция касания
        const touchX = g.x0 || _e.nativeEvent.pageX || _e.nativeEvent.locationX || 0;
        initialTouchXRef.current = touchX; // Сохраняем начальную позицию
        const isLeftEdge = touchX <= EDGE_WIDTH;
        const isRightEdge = touchX >= screenWidthRef.current - EDGE_WIDTH;
        
        // НЕ открываем панель сразу - только сохраняем позицию
        // Панель откроется в onPanResponderMove при реальном движении
        if (isLeftEdge) {
          console.log('🟢 [UnifiedEdge] Grant LEFT EDGE, touchX:', touchX.toFixed(1));
        } else if (isRightEdge) {
          console.log('🟠 [UnifiedEdge] Grant RIGHT EDGE, touchX:', touchX.toFixed(1));
        }
      },
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        // Используем сохраненную начальную позицию касания
        if (initialTouchXRef.current === null) {
          initialTouchXRef.current = null; // Сбрасываем
          return;
        }
        const initialTouchX = initialTouchXRef.current;
        const isLeftEdge = initialTouchX <= EDGE_WIDTH;
        const isRightEdge = initialTouchX >= screenWidthRef.current - EDGE_WIDTH;
        initialTouchXRef.current = null; // Сбрасываем после release
        
        // Если это был просто клик (dx=0, vx=0), ничего не делаем - панель не должна была открыться
        if (Math.abs(g.dx) < 5 && Math.abs(g.vx) < 0.1) {
          console.log(`🔴 [UnifiedEdge] Release - это был клик (dx=${g.dx.toFixed(1)}, vx=${g.vx.toFixed(2)}), ничего не делаем`);
          // Если панель была открыта во время жеста, закрываем её
          if (forceProfileRender) {
            profileSlideX.stopAnimation();
            profileOverlay.stopAnimation();
            profileSlideX.setValue(-screenWidthRef.current);
            profileOverlay.setValue(0);
            setIsProfileOpen(false);
            setForceProfileRender(false);
          }
          if (forceSideRender) {
            sideSlideX.stopAnimation();
            sideOverlay.stopAnimation();
            sideSlideX.setValue(screenWidthRef.current);
            sideOverlay.setValue(0);
            setIsMenuOpen(false);
            setForceSideRender(false);
          }
          return;
        }
        
        if (isLeftEdge) {
          console.log(`🔴 [UnifiedEdge] Release LEFT: dx=${g.dx.toFixed(1)}, vx=${g.vx.toFixed(2)}`);
          const isRight = g.dx > SWIPE_DISTANCE_THRESHOLD || g.vx > SWIPE_VELOCITY_THRESHOLD;
          if (isRight) {
            console.log('🔴 [UnifiedEdge] Открываем Profile панель');
            Animated.parallel([
              settleTiming(profileSlideX, 0, 230),
              settleTiming(profileOverlay, 1, 230),
            ]).start();
          } else {
            console.log('🔴 [UnifiedEdge] Закрываем Profile панель');
            Animated.parallel([
              settleTiming(profileSlideX, -screenWidthRef.current, 210),
              settleTiming(profileOverlay, 0, 210),
            ]).start(() => {
              setIsProfileOpen(false);
              setForceProfileRender(false);
            });
          }
        } else if (isRightEdge) {
          console.log(`🔴 [UnifiedEdge] Release RIGHT: dx=${g.dx.toFixed(1)}, vx=${g.vx.toFixed(2)}`);
          const isLeft = g.dx < -SWIPE_DISTANCE_THRESHOLD || g.vx < -SWIPE_VELOCITY_THRESHOLD;
          if (isLeft) {
            console.log('🔴 [UnifiedEdge] Открываем Side панель');
            Animated.parallel([
              settleTiming(sideSlideX, 0, 230),
              settleTiming(sideOverlay, 1, 230),
            ]).start();
          } else {
            console.log('🔴 [UnifiedEdge] Закрываем Side панель');
            Animated.parallel([
              settleTiming(sideSlideX, screenWidthRef.current, 210),
              settleTiming(sideOverlay, 0, 210),
            ]).start(() => {
              setIsMenuOpen(false);
              setForceSideRender(false);
            });
          }
        }
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        // Используем сохраненную начальную позицию касания
        if (initialTouchXRef.current === null) {
          console.log('⚠️ [UnifiedEdge] Move: initialTouchXRef is null');
          return;
        }
        const initialTouchX = initialTouchXRef.current;
        const isLeftEdge = initialTouchX <= EDGE_WIDTH;
        const isRightEdge = initialTouchX >= screenWidthRef.current - EDGE_WIDTH;
        const isCenter = !isLeftEdge && !isRightEdge;
        
        // Для центральных жестов определяем направление по первому движению
        if (isCenter && !isProfileOpen && !isMenuOpen) {
          const isSwipeRight = g.dx > 10; // Свайп вправо открывает левую панель
          const isSwipeLeft = g.dx < -10; // Свайп влево открывает правую панель
          
          if (isSwipeRight) {
            console.log('🟢 [UnifiedEdge] Move CENTER - СВАЙП ВПРАВО, открываем Profile, dx:', g.dx.toFixed(1));
            profileSlideX.stopAnimation();
            profileOverlay.stopAnimation();
            profileSlideX.setValue(-screenWidthRef.current);
            profileOverlay.setValue(0);
            setForceProfileRender(true);
            setIsProfileOpen(true);
          } else if (isSwipeLeft) {
            console.log('🟠 [UnifiedEdge] Move CENTER - СВАЙП ВЛЕВО, открываем Side, dx:', g.dx.toFixed(1));
            sideSlideX.stopAnimation();
            sideOverlay.stopAnimation();
            sideSlideX.setValue(screenWidthRef.current);
            sideOverlay.setValue(0);
            setForceSideRender(true);
            setIsMenuOpen(true);
          } else {
            // Движение еще слишком маленькое, ждем
            return;
          }
        }
        
        // Продолжаем движение, даже если панель уже открыта (благодаря forceRender)
        if (isLeftEdge) {
          // Для edge zones открываем панель при первом движении
          if (!isProfileOpen && !forceProfileRender) {
            console.log('🟢 [UnifiedEdge] Move LEFT EDGE - открываем Profile панель, dx:', g.dx.toFixed(1));
            profileSlideX.stopAnimation();
            profileOverlay.stopAnimation();
            profileSlideX.setValue(-screenWidthRef.current);
            profileOverlay.setValue(0);
            setForceProfileRender(true);
            setIsProfileOpen(true);
          }
          // Логируем каждое движение для отладки
          if (Math.floor(Math.abs(g.dx)) % 5 === 0 || Math.abs(g.dx) < 3) {
            console.log(`🟡 [UnifiedEdge] Move LEFT: dx=${g.dx.toFixed(1)}, dy=${g.dy.toFixed(1)}, x будет: ${(-screenWidthRef.current + Math.max(0, g.dx)).toFixed(1)}`);
          }
          const dx = Math.max(0, g.dx);
          let x = -screenWidthRef.current + dx;
          // Сопротивление при выходе за границы
          if (x > 0) {
            const over = x;
            x = 0 + over / 3;
          }
          x = Math.min(0, Math.max(-screenWidthRef.current, x));
          const progress = Math.min(1, Math.max(0, (x + screenWidthRef.current) / screenWidthRef.current));
          profileSlideX.setValue(x);
          profileOverlay.setValue(progress);
        } else if (isRightEdge) {
          // Для edge zones открываем панель при первом движении
          if (!isMenuOpen && !forceSideRender) {
            console.log('🟠 [UnifiedEdge] Move RIGHT EDGE - открываем Side панель, dx:', g.dx.toFixed(1));
            sideSlideX.stopAnimation();
            sideOverlay.stopAnimation();
            sideSlideX.setValue(screenWidthRef.current);
            sideOverlay.setValue(0);
            setForceSideRender(true);
            setIsMenuOpen(true);
          }
          // Логируем каждое движение для отладки
          if (Math.floor(Math.abs(g.dx)) % 5 === 0 || Math.abs(g.dx) < 3) {
            console.log(`🟡 [UnifiedEdge] Move RIGHT: dx=${g.dx.toFixed(1)}, dy=${g.dy.toFixed(1)}, x будет: ${(screenWidthRef.current + Math.min(0, g.dx)).toFixed(1)}`);
          }
          const dx = Math.min(0, g.dx);
          let x = screenWidthRef.current + dx;
          // Сопротивление при выходе за границы
          if (x < 0) {
            const over = -x;
            x = 0 - over / 3;
          }
          x = Math.max(0, Math.min(screenWidthRef.current, x));
          const progress = Math.min(1, Math.max(0, (screenWidthRef.current - x) / screenWidthRef.current));
          sideSlideX.setValue(x);
          sideOverlay.setValue(progress);
        }
      },
    })
  ).current;

  const rightEdgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Всегда возвращаем true для edge zone, проверку координат делаем в onPanResponderGrant
        console.log('🟠 [Side] onStartShouldSetPanResponder: true');
        return true;
      },
      onStartShouldSetPanResponderCapture: () => {
        // Захватываем в capture фазе для приоритета над ScrollView
        console.log('🟠 [Side] onStartShouldSetPanResponderCapture: true');
        return true;
      },
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const shouldCapture = Math.abs(g.dx) > 8 && Math.abs(g.dy) < 12;
        if (shouldCapture) {
          console.log('🟠 [Side] onMoveShouldSetPanResponder: true', g.dx, g.dy);
        }
        return shouldCapture;
      },
      onMoveShouldSetPanResponderCapture: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const shouldCapture = Math.abs(g.dx) > 8 && Math.abs(g.dy) < 12;
        if (shouldCapture) {
          console.log('🟠 [Side] onMoveShouldSetPanResponderCapture: true', g.dx, g.dy);
        }
        return shouldCapture;
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true, // Блокируем нативные обработчики
      onPanResponderGrant: (_e: GestureResponderEvent) => {
        if (isMenuOpen || isProfileOpen) return;
        // Проверяем, что касание действительно в правой edge zone
        const touchX = _e.nativeEvent.pageX;
        const screenWidth = screenWidthRef.current;
        const isInEdgeZone = touchX >= screenWidth - EDGE_WIDTH;
        console.log('🟠 [Side] onPanResponderGrant - touchX:', touchX, 'screenWidth:', screenWidth, 'isInEdgeZone:', isInEdgeZone);
        if (!isInEdgeZone) {
          console.log('🟠 [Side] Касание не в edge zone, игнорируем');
          return;
        }
        console.log('🟠 [Side] onPanResponderGrant - начинаем жест');
        // Останавливаем все анимации перед началом драга
        sideSlideX.stopAnimation();
        sideOverlay.stopAnimation();
        // Устанавливаем значения ДО setState, чтобы они были готовы сразу
        sideSlideX.setValue(screenWidthRef.current);
        sideOverlay.setValue(0);
        console.log('🟠 [Side] Установили начальные значения:', screenWidthRef.current, 0);
        // Принудительно рендерим панель сразу, но НЕ устанавливаем isMenuOpen пока
        // чтобы edge zone не исчезла до первого onPanResponderMove
        setForceSideRender(true);
        console.log('🟠 [Side] Установили forceSideRender=true (isMenuOpen отложен)');
      },
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        console.log(`🔴 [Side] Release: dx=${g.dx.toFixed(1)}, vx=${g.vx.toFixed(2)}, isMenuOpen=${isMenuOpen}`);
        // Открываем по расстоянию ИЛИ скорости
        const isLeft = g.dx < -SWIPE_DISTANCE_THRESHOLD || g.vx < -SWIPE_VELOCITY_THRESHOLD;
        console.log(`🔴 [Side] Решение: isLeft=${isLeft}, threshold=${SWIPE_DISTANCE_THRESHOLD}, velocity=${SWIPE_VELOCITY_THRESHOLD}`);
        if (isLeft && !isMenuOpen && !isProfileOpen) {
          console.log('🔴 [Side] Открываем панель');
          Animated.parallel([
            settleTiming(sideSlideX, 0, 230),
            settleTiming(sideOverlay, 1, 230),
          ]).start();
        } else {
          console.log('🔴 [Side] Закрываем панель');
          Animated.parallel([
            settleTiming(sideSlideX, screenWidthRef.current, 210),
            settleTiming(sideOverlay, 0, 210),
          ]).start(() => {
            setIsMenuOpen(false);
            setForceSideRender(false);
            console.log('🔴 [Side] Панель закрыта');
          });
        }
      },
      onPanResponderMove: (_e, g) => {
        if (isProfileOpen) return;
        console.log(`🟡 [Side] Move: dx=${g.dx.toFixed(1)}, dy=${g.dy.toFixed(1)}, vx=${g.vx.toFixed(2)}`);
        // Устанавливаем isMenuOpen при первом движении (после того как PanResponder уже захватил жест)
        if (!isMenuOpen) {
          console.log('🟡 [Side] Первое движение - устанавливаем isMenuOpen=true');
          setIsMenuOpen(true);
        }
        // Останавливаем анимации только один раз при первом движении
        if (!forceSideRender) {
          console.log('🟡 [Side] Первое движение - устанавливаем forceSideRender');
          sideSlideX.stopAnimation();
          sideOverlay.stopAnimation();
          setForceSideRender(true);
        }
        const dx = Math.min(0, g.dx); // только влево (отриц.)
        let x = screenWidthRef.current + dx; // dx отрицательный
        // Сопротивление при выходе за границы
        if (x < 0) {
          const over = -x;
          x = 0 - over / 3;
        }
        x = Math.max(0, Math.min(screenWidthRef.current, x));
        const progress = Math.min(1, Math.max(0, (screenWidthRef.current - x) / screenWidthRef.current));
        // Логируем каждые 10 кадров, чтобы не засорять консоль
        if (Math.floor(Math.abs(g.dx)) % 10 === 0 || Math.abs(g.dx) < 5) {
          console.log(`🟡 [Side] Move: dx=${g.dx.toFixed(1)}, x=${x.toFixed(1)}, progress=${progress.toFixed(2)}`);
        }
        // Устанавливаем напрямую - панель должна следовать за пальцем
        sideSlideX.setValue(x);
        sideOverlay.setValue(progress);
      },
    })
  ).current;

  // Центр экрана: свайп из любой точки
  const dragTargetRef = useRef<'profile' | 'side' | null>(null);
  const dragInitialOpenRef = useRef(false);
  const dragStartXRef = useRef(0);
  const centerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) + 2,
      onPanResponderGrant: () => {
        dragTargetRef.current = null;
        dragStartXRef.current = 0;
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderMove: (_e, g) => {
        // Определяем цель в момент первого явного горизонтального смещения
        if (!dragTargetRef.current) {
          if (isProfileOpen) {
            dragTargetRef.current = 'profile';
            dragStartXRef.current = 0; // панель в нуле
            dragInitialOpenRef.current = true;
          } else if (isMenuOpen) {
            dragTargetRef.current = 'side';
            dragStartXRef.current = 0;
            dragInitialOpenRef.current = true;
          } else {
            dragTargetRef.current = g.dx > 0 ? 'profile' : 'side';
            dragStartXRef.current = g.dx;
            dragInitialOpenRef.current = false;
            if (dragTargetRef.current === 'profile') {
              // начинаем показывать панель, но состояние isProfileOpen обновится асинхронно
              profileSlideX.stopAnimation();
              profileOverlay.stopAnimation();
              profileSlideX.setValue(-screenWidthRef.current);
              profileOverlay.setValue(0);
              setForceProfileRender(true);
              setIsProfileOpen(true);
            } else {
              sideSlideX.stopAnimation();
              sideOverlay.stopAnimation();
              sideSlideX.setValue(screenWidthRef.current);
              sideOverlay.setValue(0);
              setForceSideRender(true);
              setIsMenuOpen(true);
            }
          }
        }
        // Обновляем позицию с небольшим сопротивлением за пределами
        if (dragTargetRef.current === 'profile') {
          // Убеждаемся, что панель рендерится
          if (!forceProfileRender) {
            setForceProfileRender(true);
          }
          const base = dragInitialOpenRef.current ? 0 : -screenWidthRef.current;
          let x = base + Math.max(0, g.dx);
          if (x > 0) {
            const over = x;
            x = 0 + over / 3; // сопротивление
          }
          profileSlideX.setValue(Math.min(0, x));
          const progress = Math.min(1, Math.max(0, (x + screenWidthRef.current) / screenWidthRef.current));
          profileOverlay.setValue(progress);
        } else if (dragTargetRef.current === 'side') {
          // Убеждаемся, что панель рендерится
          if (!forceSideRender) {
            setForceSideRender(true);
          }
          const base = dragInitialOpenRef.current ? 0 : screenWidthRef.current;
          let x = base + Math.min(0, g.dx);
          if (x < 0) {
            const over = -x;
            x = 0 - over / 3; // сопротивление
          }
          sideSlideX.setValue(Math.max(0, x));
          const progress = Math.min(1, Math.max(0, (screenWidthRef.current - x) / screenWidthRef.current));
          sideOverlay.setValue(progress);
        }
      },
      onPanResponderRelease: (_e, g) => {
        const target = dragTargetRef.current;
        dragTargetRef.current = null;
        if (target === 'profile') {
          // если открыта: dx<0 — закрываем; если закрыта: dx>0 — открываем
          const currentOpen = isProfileOpen;
          const dx = g.dx;
          const openDecision = currentOpen
            ? !(dx < -SWIPE_DISTANCE_THRESHOLD || g.vx < -SWIPE_VELOCITY_THRESHOLD)
            : (dx > SWIPE_DISTANCE_THRESHOLD || g.vx > SWIPE_VELOCITY_THRESHOLD);
          Animated.parallel([
            settleTiming(profileSlideX, openDecision ? 0 : -screenWidthRef.current, 230),
            settleTiming(profileOverlay, openDecision ? 1 : 0, 230),
          ]).start(() => {
            if (!openDecision) setIsProfileOpen(false);
            else setIsProfileOpen(true);
          });
        } else if (target === 'side') {
          const currentOpen = isMenuOpen;
          const dx = g.dx;
          const openDecision = currentOpen
            ? !(dx > SWIPE_DISTANCE_THRESHOLD || g.vx > SWIPE_VELOCITY_THRESHOLD) // движение вправо — закрыть
            : (-dx > SWIPE_DISTANCE_THRESHOLD || -g.vx > SWIPE_VELOCITY_THRESHOLD);
          Animated.parallel([
            settleTiming(sideSlideX, openDecision ? 0 : screenWidthRef.current, 230),
            settleTiming(sideOverlay, openDecision ? 1 : 0, 230),
          ]).start(() => {
            if (!openDecision) setIsMenuOpen(false);
            else setIsMenuOpen(true);
          });
        }
      },
      onPanResponderTerminate: () => {
        dragTargetRef.current = null;
      },
    })
  ).current;

  // Панреспондеры для drag-to-close поверх открытых панелей (включая внутренние области)
  const profileDragPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        isProfileOpen && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) + 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        // База 0, тянем влево закрывая; резина за  -width
        let x = Math.min(0, Math.max(-screenWidthRef.current, g.dx)); // dx<=0
        if (x < -screenWidthRef.current) {
          const over = -screenWidthRef.current - x;
          x = -screenWidthRef.current - over / 3;
        }
        const translate = Math.min(0, 0 + x);
        profileSlideX.setValue(translate);
        const progress = Math.min(1, Math.max(0, (translate + screenWidthRef.current) / screenWidthRef.current));
        profileOverlay.setValue(progress);
      },
      onPanResponderRelease: (_e, g) => {
        const shouldStayOpen = !(g.dx < -SWIPE_DISTANCE_THRESHOLD || g.vx < -SWIPE_VELOCITY_THRESHOLD);
        Animated.parallel([
          settleTiming(profileSlideX, shouldStayOpen ? 0 : -screenWidthRef.current, 230),
          settleTiming(profileOverlay, shouldStayOpen ? 1 : 0, 230),
        ]).start(() => {
          if (!shouldStayOpen) setIsProfileOpen(false);
        });
      },
    })
  ).current;

  const sideDragPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        isMenuOpen && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) + 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        // База 0, тянем вправо закрывая; резина за +width
        let x = Math.max(0, Math.min(screenWidthRef.current, g.dx)); // dx>=0
        if (x > screenWidthRef.current) {
          const over = x - screenWidthRef.current;
          x = screenWidthRef.current + over / 3;
        }
        const translate = Math.max(0, 0 + x);
        // правую панель закрываем вправо => translateX из 0 к +W
        sideSlideX.setValue(translate);
        const progress = Math.min(1, Math.max(0, (screenWidthRef.current - translate) / screenWidthRef.current));
        sideOverlay.setValue(progress);
      },
      onPanResponderRelease: (_e, g) => {
        const shouldStayOpen = !(g.dx > SWIPE_DISTANCE_THRESHOLD || g.vx > SWIPE_VELOCITY_THRESHOLD);
        Animated.parallel([
          settleTiming(sideSlideX, shouldStayOpen ? 0 : screenWidthRef.current, 230),
          settleTiming(sideOverlay, shouldStayOpen ? 1 : 0, 230),
        ]).start(() => {
          if (!shouldStayOpen) setIsMenuOpen(false);
        });
      },
    })
  ).current;

  // Сбрасываем force flags когда панели закрываются
  useEffect(() => {
    if (!isProfileOpen && forceProfileRender) {
      console.log('🔄 [MainMenuScreen] isProfileOpen=false, сбрасываем forceProfileRender');
      setForceProfileRender(false);
    }
  }, [isProfileOpen, forceProfileRender]);

  useEffect(() => {
    if (!isMenuOpen && forceSideRender) {
      console.log('🔄 [MainMenuScreen] isMenuOpen=false, сбрасываем forceSideRender');
      setForceSideRender(false);
    }
  }, [isMenuOpen, forceSideRender]);

  // Обновление ширины при смене ориентации
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      screenWidthRef.current = window.width;
      // Нормализуем позиции согласно текущему состоянию
      if (isProfileOpen) {
        profileSlideX.setValue(0);
        profileOverlay.setValue(1);
      } else {
        profileSlideX.setValue(-screenWidthRef.current);
        profileOverlay.setValue(0);
      }
      if (isMenuOpen) {
        sideSlideX.setValue(0);
        sideOverlay.setValue(1);
      } else {
        sideSlideX.setValue(screenWidthRef.current);
        sideOverlay.setValue(0);
      }
    });
    return () => {
      // @ts-ignore compat for RN versions
      sub?.remove?.();
    };
  }, [isMenuOpen, isProfileOpen]);

  useEffect(() => {
    if (user && user.groups && user.groups.length > 0) {
      // Устанавливаем первую группу как активную, если активная группа не выбрана
      if (!activeGroup) {
        const firstGroup = user.groups[0];
        if (firstGroup) {
          console.log('[MainMenuScreen] 🎯 Автоматически выбираем первую группу:', {
            id: firstGroup.id,
            group_id: firstGroup.group_id,
            title: firstGroup.title,
            name: firstGroup.name,
            group_type: firstGroup.group_type,
          });
          setActiveGroup(firstGroup.id);
        }
      }
    }
  }, [user, activeGroup]);
  
  // Логируем изменения activeGroup
  useEffect(() => {
    if (activeGroup) {
      const group = user?.groups?.find((g: any) => g.id === activeGroup);
      console.log('[MainMenuScreen] 📊 Активная группа изменена:', {
        activeGroup,
        group: group ? {
          id: group.id,
          group_id: group.group_id,
          title: group.title,
          name: group.name,
          group_type: group.group_type,
          company_role: group.company_role ? {
            role_code: group.company_role.role_code,
            role_name: group.company_role.role_name,
          } : null,
          chatId: group.group_id || group.id,
        } : null,
      });
    }
  }, [activeGroup, user?.groups]);

  // Получаем активную группу
  const activeGroupData = useMemo(() => {
    if (!activeGroup || !user?.groups) {
      return null;
    }
    return user.groups.find((g: any) => g.id === activeGroup);
  }, [activeGroup, user?.groups]);

  // Получаем роль из активной группы
  const activeRoleFromGroup = useMemo(() => {
    if (!activeGroupData) return 'none' as Role;
    // Используем group_type из данных группы, если он есть
    return (activeGroupData.group_type || 'none') as Role;
  }, [activeGroupData]);

  // Формируем меню на основе features активной группы
  const currentMenuItems = useMemo(() => {
    if (!activeGroupData || !activeGroupData.features || activeGroupData.features.length === 0) {
      return [];
    }

    // Преобразуем features в MenuItem
    const menuItems: MenuItem[] = activeGroupData.features
      .filter((feature: any) => feature.feature_code && featureCodeToMenuItem[feature.feature_code])
      .map((feature: any) => {
        const menuItemData = featureCodeToMenuItem[feature.feature_code];
        return {
          id: feature.feature_code,
          title: feature.feature_name || menuItemData.title,
          description: feature.description || menuItemData.description,
          icon: feature.icon || menuItemData.icon,
        };
      });

    return menuItems;
  }, [activeGroupData]);

  const handleMenuItemPress = (item: MenuItem) => {
    console.log(`Открываем раздел: ${item.id}`);
    
    // Навигация к соответствующим экранам
    switch (item.id) {
      case 'inventory':
        // Логируем информацию о выбранной группе
        console.log('[MainMenuScreen] 📊 Состояние перед навигацией к Inventory:', {
          activeGroup,
          activeGroupData: activeGroupData ? {
            id: activeGroupData.id,
            group_id: activeGroupData.group_id,
            title: activeGroupData.title,
            name: activeGroupData.name,
            group_type: activeGroupData.group_type,
            company_role: activeGroupData.company_role ? {
              id: activeGroupData.company_role.id,
              role_name: activeGroupData.company_role.role_name,
              role_code: activeGroupData.company_role.role_code,
            } : null,
            hasFeatures: !!activeGroupData.features,
            featuresCount: activeGroupData.features?.length || 0,
            features: activeGroupData.features?.map((f: any) => ({
              id: f.id,
              feature_code: f.feature_code,
              feature_name: f.feature_name,
            })) || [],
          } : null,
          userGroupsCount: user?.groups?.length || 0,
          fullGroupData: activeGroupData ? JSON.stringify(activeGroupData, null, 2) : null,
        });
        
        // Получаем chatId из activeGroupData (используем group_id, это Telegram chat ID)
        const chatId = activeGroupData?.group_id || activeGroupData?.id || null;
        console.log('[MainMenuScreen] 🎯 ChatId для Inventory:', {
          chatId,
          source: activeGroupData?.group_id ? 'group_id' : activeGroupData?.id ? 'id' : 'null',
          willNavigate: !!chatId,
          chatIdType: typeof chatId,
          chatIdString: chatId ? String(chatId) : null,
        });
        
        if (chatId) {
          const navigationParams = { chatId: String(chatId) };
          console.log('[MainMenuScreen] 🚀 Навигация к Inventory с параметрами:', navigationParams);
          navigation.navigate('Inventory', navigationParams);
          console.log('[MainMenuScreen] ✅ Навигация выполнена');
        } else {
          console.warn('[MainMenuScreen] ⚠️ ChatId не найден, навигация без параметров');
          navigation.navigate('Inventory');
        }
        break;
      case 'events':
        // TODO: Navigate to Events screen
        console.log('Events screen - в разработке');
        break;
      case 'write-off':
        // TODO: Navigate to WriteOff screen
        console.log('WriteOff screen - в разработке');
        break;
      case 'purchasing':
        // TODO: Navigate to Purchasing screen
        console.log('Purchasing screen - в разработке');
        break;
      case 'requests':
        // TODO: Navigate to Requests screen
        console.log('Requests screen - в разработке');
        break;
      case 'courier-schedule':
        // TODO: Navigate to CourierSchedule screen
        console.log('CourierSchedule screen - в разработке');
        break;
      case 'shifts':
        // TODO: Navigate to Shifts screen
        console.log('Shifts screen - в разработке');
        break;
      case 'notifications':
        // TODO: Navigate to Notifications screen
        console.log('Notifications screen - в разработке');
        break;
      default:
        console.log(`Экран для ${item.id} не реализован`);
    }
  };


  return (
    <View 
      className={`flex-1 ${theme === 'dark' ? 'dark bg-background-dark' : 'bg-background-light'}`}
      style={{ flex: 1 }}
    >
      <StatusBar 
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        translucent={true}
        backgroundColor="transparent"
      />
      
      {/* Header Container with Glassmorphism - от самого верха */}
      {/* 
        ВЕБ vs МОБИЛЬНЫЙ GLASSMORPHISM:
        - ВЕБ: backdrop-filter: blur() + полупрозрачный фон
        - iOS: BlurView размывает контент ЗА ним (как backdrop-filter)
        - Android: BlurView работает плохо, используем полупрозрачный фон
      */}
      {Platform.OS === 'ios' ? (
        // iOS - используем BlurView для настоящего размытия
        <BlurView
          blurType={theme === 'dark' ? 'dark' : 'light'}
          blurAmount={20}
          reducedTransparencyFallbackColor={theme === 'dark' ? '#1A1A1A' : '#F5F5F5'}
          style={{
            zIndex: 1002,
            elevation: 1002,
          }}
        >
          <View
            style={{
              backgroundColor: theme === 'dark' 
                ? 'rgba(26, 26, 26, 0.3)' 
                : 'rgba(255, 255, 255, 0.3)',
              borderBottomWidth: 1,
              borderBottomColor: theme === 'dark' 
                ? 'rgba(255, 255, 255, 0.15)' 
                : 'rgba(0, 0, 0, 0.1)',
              shadowColor: theme === 'dark' ? '#000000' : '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: theme === 'dark' ? 0.3 : 0.1,
              shadowRadius: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 16,
              }}
            >
        {/* Avatar (Left) - всегда отображается, панели перекрывают сверху */}
          <Pressable
            onPress={() => {
              console.log('👆 [MainMenuScreen] Клик на аватарку, открываем ProfilePanel');
              setIsProfileOpen(true);
              // анимация контролируемых значений
              profileSlideX.setValue(-screenWidth);
              profileOverlay.setValue(0);
              Animated.parallel([
                Animated.timing(profileSlideX, { toValue: 0, duration: 220, useNativeDriver: true }),
                Animated.timing(profileOverlay, { toValue: 1, duration: 220, useNativeDriver: true }),
              ]).start();
            }}
            style={{
              width: 60,
              height: 60,
              borderRadius: 50,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: '#FF6B35',
            }}
          >
            {user?.photoUrl && !photoError[user.id] ? (
              <Image
                source={{ uri: user.photoUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                onError={(error) => {
                  console.error('❌ [MainMenuScreen] Ошибка загрузки аватарки:', error.nativeEvent.error);
                  console.log('🔗 [MainMenuScreen] URL аватарки:', user.photoUrl);
                  // Помечаем фото как недоступное для этого пользователя
                  setPhotoError(prev => ({ ...prev, [user.id]: true }));
                }}
                onLoad={() => {
                  console.log('✅ [MainMenuScreen] Аватарка загружена успешно:', user.photoUrl);
                  // Сбрасываем ошибку при успешной загрузке
                  setPhotoError(prev => {
                    const newState = { ...prev };
                    delete newState[user.id];
                    return newState;
                  });
                }}
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#E0E0E0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="account-circle" size={32} color="#666666" />
              </View>
            )}
          </Pressable>

        {/* Burger Menu Button (Right) - всегда статичная иконка меню */}
          <Pressable
            onPress={() => {
              console.log('👆 [MainMenuScreen] Клик на бургер-меню, переключаем SideMenuPanel');
              console.log('📊 [MainMenuScreen] Текущее состояние isMenuOpen:', isMenuOpen);
              if (!isMenuOpen) {
                setIsMenuOpen(true);
                sideSlideX.setValue(screenWidth);
                sideOverlay.setValue(0);
                Animated.parallel([
                  Animated.timing(sideSlideX, { toValue: 0, duration: 220, useNativeDriver: true }),
                  Animated.timing(sideOverlay, { toValue: 1, duration: 220, useNativeDriver: true }),
                ]).start();
              } else {
                Animated.parallel([
                  Animated.timing(sideSlideX, { toValue: screenWidth, duration: 200, useNativeDriver: true }),
                  Animated.timing(sideOverlay, { toValue: 0, duration: 200, useNativeDriver: true }),
                ]).start(() => setIsMenuOpen(false));
              }
            }}
            style={({ pressed }) => [
              {
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 24,
                backgroundColor: pressed ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
              },
            ]}
          >
          <Icon
            name="menu"
            size={28}
            color={theme === 'dark' ? '#FFFFFF' : '#333333'}
          />
        </Pressable>
            </View>
          </View>
        </BlurView>
      ) : (
        // Android - используем полупрозрачный фон с эффектом стекла
        <View
          style={{
            zIndex: 1002,
            elevation: 8,
            backgroundColor: theme === 'dark' 
              ? 'rgba(26, 26, 26, 0.85)' 
              : 'rgba(255, 255, 255, 0.85)',
            borderBottomWidth: 1,
            borderBottomColor: theme === 'dark' 
              ? 'rgba(255, 255, 255, 0.15)' 
              : 'rgba(0, 0, 0, 0.1)',
            shadowColor: theme === 'dark' ? '#000000' : '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: theme === 'dark' ? 0.3 : 0.1,
            shadowRadius: 8,
            paddingTop: StatusBar.currentHeight || 0,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 16,
            }}
          >
            {/* Avatar */}
            <Pressable
              onPress={() => {
                console.log('👆 [MainMenuScreen] Клик на аватарку, открываем ProfilePanel');
                setIsProfileOpen(true);
                profileSlideX.setValue(-screenWidth);
                profileOverlay.setValue(0);
                Animated.parallel([
                  Animated.timing(profileSlideX, { toValue: 0, duration: 220, useNativeDriver: true }),
                  Animated.timing(profileOverlay, { toValue: 1, duration: 220, useNativeDriver: true }),
                ]).start();
              }}
              style={{
                width: 60,
                height: 60,
                borderRadius: 50,
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: '#FF6B35',
              }}
            >
              {user?.photoUrl && !photoError[user.id] ? (
                <Image
                  source={{ uri: user.photoUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error('❌ [MainMenuScreen] Ошибка загрузки аватарки:', error.nativeEvent.error);
                    setPhotoError(prev => ({ ...prev, [user.id]: true }));
                  }}
                  onLoad={() => {
                    console.log('✅ [MainMenuScreen] Аватарка загружена успешно:', user.photoUrl);
                    setPhotoError(prev => {
                      const newState = { ...prev };
                      delete newState[user.id];
                      return newState;
                    });
                  }}
                />
              ) : (
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#E0E0E0',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="account-circle" size={32} color="#666666" />
                </View>
              )}
            </Pressable>

            {/* Burger Menu */}
            <Pressable
              onPress={() => {
                console.log('👆 [MainMenuScreen] Клик на бургер-меню, переключаем SideMenuPanel');
                if (!isMenuOpen) {
                  setIsMenuOpen(true);
                  sideSlideX.setValue(screenWidth);
                  sideOverlay.setValue(0);
                  Animated.parallel([
                    Animated.timing(sideSlideX, { toValue: 0, duration: 220, useNativeDriver: true }),
                    Animated.timing(sideOverlay, { toValue: 1, duration: 220, useNativeDriver: true }),
                  ]).start();
                } else {
                  Animated.parallel([
                    Animated.timing(sideSlideX, { toValue: screenWidth, duration: 200, useNativeDriver: true }),
                    Animated.timing(sideOverlay, { toValue: 0, duration: 200, useNativeDriver: true }),
                  ]).start(() => setIsMenuOpen(false));
                }
              }}
              style={({ pressed }) => [
                {
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 24,
                  backgroundColor: pressed ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                },
              ]}
            >
              <Icon
                name="menu"
                size={28}
                color={theme === 'dark' ? '#FFFFFF' : '#333333'}
              />
            </Pressable>
          </View>
        </View>
      )}

      {/* Unified edge swipe zone - упрощенная версия: один View с PanResponder */}
      {/* Показываем ТОЛЬКО когда панели закрыты - не блокируем клики когда панели открыты */}
      {!isProfileOpen && !isMenuOpen ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 10001, // Выше всего когда панели закрыты
          }}
          pointerEvents="box-none" // Пропускаем события к детям - клики проходят сквозь
          {...unifiedEdgePanResponder.panHandlers} // PanResponder проверяет координаты и захватывает только жесты
        />
      ) : null}
      {/* Невидимый View для продолжения жеста во время открытия панели */}
      {(forceProfileRender || forceSideRender) && (isProfileOpen || isMenuOpen) ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 10000, // Ниже панелей во время жеста
          }}
          pointerEvents="box-none" // Пропускаем события к детям
          {...unifiedEdgePanResponder.panHandlers} // PanResponder для продолжения жеста
        />
      ) : null}

      {/* Main Content */}
      <ScrollView 
        className={`flex-1 ${theme === 'dark' ? 'dark bg-background-dark' : 'bg-background-light'}`}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={false}
        scrollEnabled={!isProfileOpen && !isMenuOpen} // Отключаем скролл когда панели открыты
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {/* Title Section */}
          {activeGroup && user?.groups ? (
            <View style={{ marginBottom: 28 }}>
              <Text 
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: theme === 'dark' ? '#FFFFFF' : '#000000',
                  marginBottom: 6,
                  letterSpacing: -0.5,
                }}
              >
                {user.groups.find((g: any) => g.id === activeGroup)?.name || 'Главное меню'}
              </Text>
              <Text 
                style={{
                  fontSize: 15,
                  color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
                }}
              >
                Выберите раздел для работы
              </Text>
            </View>
          ) : (
            <View style={{ marginBottom: 28 }}>
              <Text 
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: theme === 'dark' ? '#FFFFFF' : '#000000',
                  marginBottom: 6,
                  letterSpacing: -0.5,
                }}
              >
                Главное меню
              </Text>
              <Text 
                style={{
                  fontSize: 15,
                  color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
                }}
              >
                Выберите группу в профиле для начала работы
              </Text>
            </View>
          )}

          {/* Menu Items Grid */}
          {currentMenuItems.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {currentMenuItems.map((item) => {
                const icons: { [key: string]: string } = {
                  'events': 'event',
                  'inventory': 'inventory-2',
                  'write-off': 'remove-shopping-cart',
                  'requests': 'local-shipping',
                  'courier-schedule': 'schedule',
                };
                const iconName = icons[item.id] || 'folder';
                
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }: PressableStateCallbackType) => [
                      {
                        width: '48%',
                        marginBottom: 14,
                        borderRadius: 18,
                        backgroundColor: theme === 'dark' 
                          ? 'rgba(255, 255, 255, 0.05)' 
                          : '#F8F8F8',
                        padding: 22,
                        borderWidth: 1,
                        borderColor: theme === 'dark' 
                          ? 'rgba(255, 255, 255, 0.08)' 
                          : 'rgba(0, 0, 0, 0.05)',
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                    onPress={() => handleMenuItemPress(item)}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: 'rgba(255, 107, 53, 0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 14,
                      }}
                    >
                      <Icon 
                        name={iconName} 
                        size={26} 
                        color="#FF6B35" 
                      />
                    </View>
                    <Text 
                      style={{
                        fontSize: 17,
                        fontWeight: '600',
                        color: theme === 'dark' ? '#FFFFFF' : '#000000',
                        letterSpacing: -0.3,
                      }}
                    >
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View 
              style={{
                width: '100%',
                borderRadius: 18,
                backgroundColor: theme === 'dark' 
                  ? 'rgba(255, 255, 255, 0.05)' 
                  : '#F8F8F8',
                borderWidth: 1,
                borderColor: theme === 'dark' 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(0, 0, 0, 0.05)',
                padding: 40,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: theme === 'dark' 
                    ? 'rgba(255, 255, 255, 0.08)' 
                    : 'rgba(0, 0, 0, 0.05)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Icon 
                  name="info-outline" 
                  size={32} 
                  color={theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'} 
                />
              </View>
              <Text 
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: theme === 'dark' ? '#FFFFFF' : '#000000',
                  marginBottom: 10,
                  textAlign: 'center',
                }}
              >
                Доступ ограничен
              </Text>
              <Text 
                style={{
                  fontSize: 14,
                  color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
                  textAlign: 'center',
                  lineHeight: 20,
                }}
              >
                Выберите группу в профиле для получения доступа
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Center swipe zone: не мешает вертикальному скроллу, активируется только при горизонтальном движении */}
      {/* Отключен, чтобы не блокировать клики в панелях */}
      {false && !isProfileOpen && !isMenuOpen && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 1000,
          }}
          pointerEvents="auto"
          {...centerPanResponder.panHandlers}
        />
      )}


      {/* Side Menu Panel - рендерится перед хедером, чтобы хедер был выше */}
      <SideMenuPanel
        isOpen={isMenuOpen}
        onClose={() => {
          Animated.parallel([
            settleTiming(sideSlideX, screenWidthRef.current, 210),
            settleTiming(sideOverlay, 0, 210),
          ]).start(() => setIsMenuOpen(false));
        }}
        controlledSlideX={sideSlideX}
        controlledOverlayOpacity={sideOverlay}
        controlledShouldRender={isMenuOpen || forceSideRender}
        dragPanHandlers={sideDragPanResponder.panHandlers}
      />
      
      {/* Profile Panel - левая панель для профиля */}
      <ProfilePanel 
        isOpen={isProfileOpen} 
        onClose={() => {
          Animated.parallel([
            settleTiming(profileSlideX, -screenWidthRef.current, 210),
            settleTiming(profileOverlay, 0, 210),
          ]).start(() => setIsProfileOpen(false));
        }}
        activeRole={activeRoleFromGroup}
        activeGroup={activeGroup}
        onGroupSelect={(groupId: string, role: Role) => {
          setActiveGroup(groupId);
          Animated.parallel([
            settleTiming(profileSlideX, -screenWidthRef.current, 210),
            settleTiming(profileOverlay, 0, 210),
          ]).start(() => setIsProfileOpen(false));
        }}
        controlledSlideX={profileSlideX}
        controlledOverlayOpacity={profileOverlay}
        controlledShouldRender={isProfileOpen || forceProfileRender}
        dragPanHandlers={profileDragPanResponder.panHandlers}
      />
    </View>
  );
};

export default MainMenuScreen;
