import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '@contexts/ThemeContext';

interface ScannerOverlayProps {
  scanning: boolean;
  detected: boolean;
  error?: string;
}

const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  scanning,
  detected,
  error,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const scanLineAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (scanning && !detected) {
      // Анимация сканирующей линии
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [scanning, detected, scanLineAnim]);

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200], // Высота рамки сканирования
  });

  const styles = createStyles(isDark, detected, error);

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Затемнение по краям */}
      <View style={styles.topOverlay} />
      <View style={styles.bottomOverlay} />
      <View style={styles.leftOverlay} />
      <View style={styles.rightOverlay} />

      {/* Рамка сканирования */}
      <View style={styles.reticle}>
        {/* Углы рамки */}
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />

        {/* Сканирующая линия */}
        {scanning && !detected && (
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [{ translateY }],
              },
            ]}
          />
        )}

        {/* Индикатор успеха */}
        {detected && (
          <View style={styles.successIndicator}>
            <View style={styles.successIcon} />
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (
  isDark: boolean,
  detected: boolean,
  error?: string
) => {
  const reticleSize = 250;
  const reticleBorderColor = detected
    ? '#4CAF50'
    : error
    ? '#F44336'
    : isDark
    ? '#FFFFFF'
    : '#000000';

  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      marginTop: -125, // Половина высоты рамки
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '50%',
      marginBottom: -125, // Половина высоты рамки
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    leftOverlay: {
      position: 'absolute',
      top: '50%',
      left: 0,
      width: '50%',
      height: reticleSize,
      marginTop: -reticleSize / 2,
      marginLeft: -125, // Половина ширины рамки
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    rightOverlay: {
      position: 'absolute',
      top: '50%',
      right: 0,
      width: '50%',
      height: reticleSize,
      marginTop: -reticleSize / 2,
      marginRight: -125, // Половина ширины рамки
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    reticle: {
      width: reticleSize,
      height: reticleSize,
      borderWidth: 2,
      borderColor: reticleBorderColor,
      borderRadius: 12,
      position: 'relative',
      overflow: 'hidden',
    },
    corner: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderColor: reticleBorderColor,
    },
    topLeft: {
      top: -2,
      left: -2,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderTopLeftRadius: 12,
    },
    topRight: {
      top: -2,
      right: -2,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderTopRightRadius: 12,
    },
    bottomLeft: {
      bottom: -2,
      left: -2,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderBottomLeftRadius: 12,
    },
    bottomRight: {
      bottom: -2,
      right: -2,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderBottomRightRadius: 12,
    },
    scanLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: '#FF6B35',
      shadowColor: '#FF6B35',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
      elevation: 4,
    },
    successIndicator: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(76, 175, 80, 0.2)',
    },
    successIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 3,
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.3)',
    },
  });
};

export default ScannerOverlay;

