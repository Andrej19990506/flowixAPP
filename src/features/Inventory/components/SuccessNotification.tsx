import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface SuccessNotificationProps {
  visible: boolean;
  title: string;
  message: string;
  gtin?: string;
  codeType?: 'qr' | 'barcode';
  onHide?: () => void;
  duration?: number;
}

const SuccessNotification: React.FC<SuccessNotificationProps> = ({
  visible,
  title,
  message,
  gtin,
  codeType = 'qr',
  onHide,
  duration = 3000,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';
  
  const translateY = useRef(new Animated.Value(200)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      // Очищаем предыдущий таймер, если есть
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      // Анимация появления
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start(() => {
        // Анимация иконки после появления уведомления
        Animated.spring(iconScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 7,
        }).start();
      });

      // Автоматическое скрытие через duration
      hideTimeoutRef.current = setTimeout(() => {
        handleHide();
      }, duration);
    } else {
      handleHide();
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [visible]);

  const handleHide = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 200,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      iconScale.setValue(0);
      if (onHide) {
        onHide();
      }
    });
  };

  if (!visible) {
    return null;
  }

  const styles = createStyles(isDark, insets, gtin);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.notification}>
        {/* Иконка успеха с анимацией */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          <View style={styles.iconBackground}>
            <Icon
              name="check-circle"
              size={32}
              color="#FFFFFF"
            />
          </View>
        </Animated.View>

        {/* Контент */}
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {gtin && (
            <View style={styles.gtinContainer}>
              <Icon
                name={codeType === 'qr' ? 'qr-code-2' : 'barcode-reader'}
                size={14}
                color={isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                style={styles.gtinIcon}
              />
              <Text style={styles.gtinText}>GTIN: {gtin}</Text>
            </View>
          )}
        </View>

        {/* Кнопка закрытия */}
        <Animated.View
          style={[
            styles.closeButton,
            {
              opacity: iconScale.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          <Icon
            name="close"
            size={20}
            color={isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const createStyles = (isDark: boolean, insets: any, gtin?: string) => {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingBottom: Math.max(insets.bottom, 16),
      zIndex: 10000,
      alignItems: 'center',
    },
    notification: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 107, 53, 0.2)' : 'rgba(255, 107, 53, 0.1)',
    },
    iconContainer: {
      marginRight: 12,
    },
    iconBackground: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#FF6B35',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#FF6B35',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#000000',
      marginBottom: 4,
    },
    message: {
      fontSize: 14,
      color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
      lineHeight: 20,
      marginBottom: gtin ? 8 : 0,
    },
    gtinContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    gtinIcon: {
      marginRight: 6,
    },
    gtinText: {
      fontSize: 12,
      fontFamily: 'monospace',
      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
      fontWeight: '500',
    },
    closeButton: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
  });
};

export default SuccessNotification;

