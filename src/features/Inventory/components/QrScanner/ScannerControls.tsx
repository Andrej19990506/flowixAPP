import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@contexts/ThemeContext';

interface ScannerControlsProps {
  onClose: () => void;
  onTorchToggle: () => void;
  torchEnabled: boolean;
  canUseTorch: boolean;
  statusMessage?: string;
}

const ScannerControls: React.FC<ScannerControlsProps> = ({
  onClose,
  onTorchToggle,
  torchEnabled,
  canUseTorch,
  statusMessage,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = createStyles(isDark);

  return (
    <View style={styles.container}>
      {/* Верхняя панель */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.button,
            styles.closeButton,
            pressed && styles.buttonPressed,
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
        </Pressable>

        {canUseTorch && (
          <Pressable
            onPress={onTorchToggle}
            style={({ pressed }) => [
              styles.button,
              styles.torchButton,
              torchEnabled && styles.torchButtonActive,
              pressed && styles.buttonPressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name={torchEnabled ? 'flash-on' : 'flash-off'}
              size={24}
              color={torchEnabled ? '#FFD700' : isDark ? '#FFFFFF' : '#000000'}
            />
          </Pressable>
        )}
      </View>

      {/* Нижняя панель со статусом */}
      {statusMessage && (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (isDark: boolean) => {
  return StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      pointerEvents: 'box-none',
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 50,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    button: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.95 }],
    },
    closeButton: {
      // Стили для кнопки закрытия
    },
    torchButton: {
      // Стили для кнопки фонарика
    },
    torchButtonActive: {
      backgroundColor: isDark ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.4)',
    },
    statusBar: {
      position: 'absolute',
      bottom: 100,
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    statusText: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#000000',
      textAlign: 'center',
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      overflow: 'hidden',
    },
  });
};

export default ScannerControls;

