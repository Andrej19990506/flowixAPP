import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, Image } from 'react-native';

interface LoadingOverlayProps {
  isLoading: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const [shouldRender, setShouldRender] = React.useState(true);
  
  // Анимация для логотипа
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  
  // Анимации для точек
  const dot1Anim = useRef(new Animated.Value(0.8)).current;
  const dot2Anim = useRef(new Animated.Value(0.8)).current;
  const dot3Anim = useRef(new Animated.Value(0.8)).current;
  const dot1Opacity = useRef(new Animated.Value(0.4)).current;
  const dot2Opacity = useRef(new Animated.Value(0.4)).current;
  const dot3Opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let logoPulse: Animated.CompositeAnimation | null = null;
    
    if (isLoading) {
      // Показываем оверлей
      setShouldRender(true);
      slideAnim.setValue(0);
      opacityAnim.setValue(1);
      
      // Сбрасываем анимации логотипа
      logoScale.setValue(0.9);
      logoOpacity.setValue(0);
      
      // Анимация появления логотипа
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // После появления логотипа запускаем легкое пульсирование
        logoPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(logoScale, {
              toValue: 1.03,
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(logoScale, {
              toValue: 1,
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        logoPulse.start();
      });
      
      // Сбрасываем анимации точек
      dot1Anim.setValue(0.8);
      dot2Anim.setValue(0.8);
      dot3Anim.setValue(0.8);
      dot1Opacity.setValue(0.4);
      dot2Opacity.setValue(0.4);
      dot3Opacity.setValue(0.4);
      
      // Запускаем анимацию точек (более плавная и заметная)
      const createDotAnimation = (scaleAnim: Animated.Value, opacityAnim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(scaleAnim, {
                toValue: 1.4,
                duration: 500,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 500,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(scaleAnim, {
                toValue: 0.8,
                duration: 500,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 0.4,
                duration: 500,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
          ])
        );
      };

      const anim1 = createDotAnimation(dot1Anim, dot1Opacity, 0);
      const anim2 = createDotAnimation(dot2Anim, dot2Opacity, 200);
      const anim3 = createDotAnimation(dot3Anim, dot3Opacity, 400);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        if (logoPulse) {
          logoPulse.stop();
        }
        anim1.stop();
        anim2.stop();
        anim3.stop();
      };
    } else {
      // Скрываем оверлей с анимацией выезда влево
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -1,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [isLoading, slideAnim, opacityAnim, dot1Anim, dot2Anim, dot3Anim, dot1Opacity, dot2Opacity, dot3Opacity]);

  if (!shouldRender) {
    return null;
  }

  const screenWidth = Dimensions.get('window').width;
  const translateX = slideAnim.interpolate({
    inputRange: [-1, 0],
    outputRange: [-screenWidth, 0],
  });

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          transform: [{ translateX }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents={isLoading ? 'auto' : 'none'}
    >
      {/* Логотип с анимацией */}
      <Animated.View 
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image 
          source={require('../../../assets/Logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      
      {/* Анимированные точки */}
      <View style={styles.dotsContainer}>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [{ scale: dot1Anim }],
              opacity: dot1Opacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [{ scale: dot2Anim }],
              opacity: dot2Opacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [{ scale: dot3Anim }],
              opacity: dot3Opacity,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    // Оранжевый градиент через background (упрощенная версия)
    backgroundColor: '#FF6B35', // Основной оранжевый цвет
  },
  logoContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    // Легкая тень для логотипа
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: 140,
    height: 140,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  dot: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 6,
    width: 12,
    height: 12,
    marginHorizontal: 6,
    // Легкая тень для точек
    shadowColor: '#FFFFFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default LoadingOverlay;

