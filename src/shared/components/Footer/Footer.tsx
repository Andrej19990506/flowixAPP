import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';

export interface FooterButton {
  id: string;
  icon: string;
  label?: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
}

interface FooterProps {
  buttons: FooterButton[];
  variant?: 'default' | 'compact';
}

const Footer: React.FC<FooterProps> = ({ buttons, variant = 'default' }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets, variant);
  const isDark = theme === 'dark';

  if (buttons.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.buttonsContainer}>
        {buttons.map((button) => (
          <Pressable
            key={button.id}
            onPress={button.onPress}
            disabled={button.disabled}
            style={({ pressed }) => [
              styles.button,
              button.active && styles.buttonActive,
              button.disabled && styles.buttonDisabled,
              pressed && !button.disabled && styles.buttonPressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.iconContainer}>
              <View style={[
                styles.iconWrapper,
                button.active && styles.iconWrapperActive,
              ]}>
                <Icon
                  name={button.icon}
                  size={variant === 'compact' ? 30 : 32}
                  color={
                    button.disabled
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.3)'
                        : 'rgba(0, 0, 0, 0.3)'
                      : button.active
                      ? '#FF6B35'
                      : isDark
                      ? '#FFFFFF'
                      : '#000000'
                  }
                />
              </View>
              {button.badge !== undefined && button.badge > 0 && (
                <View style={styles.badge}>
                  <View style={styles.badgeContent}>
                    <Text style={styles.badgeText}>
                      {button.badge > 99 ? '99+' : button.badge}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            {button.label && variant === 'default' && (
              <Text
                style={[
                  styles.label,
                  button.active && styles.labelActive,
                  button.disabled && styles.labelDisabled,
                ]}
              >
                {button.label}
              </Text>
            )}
          </Pressable>
        ))}
        </View>
      </View>
    </View>
  );
};

const createStyles = (
  theme: 'light' | 'dark',
  insets: any,
  variant: 'default' | 'compact'
) => {
  const isDark = theme === 'dark';
  const isCompact = variant === 'compact';

  return StyleSheet.create({
    wrapper: {
      // Обертка для правильной обработки SafeArea
      backgroundColor: 'rgba(0, 0, 0, 0)',
      paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 0 : 8),
    } as ViewStyle,

    container: {
      backgroundColor: 'rgba(0, 0, 0, 0)',
      borderTopWidth: 0,
      paddingTop: isCompact ? 4 : 6,
      paddingHorizontal: 16,
      paddingBottom: Platform.OS === 'ios' ? 0 : 4,
    } as ViewStyle,

    buttonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      gap: isCompact ? 16 : 20,
      width: '100%',
      flexWrap: 'nowrap',
    } as ViewStyle,

    button: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: isCompact ? 2 : 4,
      paddingHorizontal: isCompact ? 12 : 16,
      borderRadius: 12,
      minHeight: isCompact ? 36 : 40,
      minWidth: 50,
    } as ViewStyle,

    buttonActive: {
      backgroundColor: isDark
        ? 'rgba(255, 107, 53, 0.15)'
        : 'rgba(255, 107, 53, 0.1)',
    } as ViewStyle,

    buttonDisabled: {
      opacity: 0.4,
    } as ViewStyle,

    buttonPressed: {
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.06)',
      transform: [{ scale: 0.95 }],
    } as ViewStyle,

    iconContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,

    iconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    } as ViewStyle,

    iconWrapperActive: {
      backgroundColor: isDark
        ? 'rgba(255, 107, 53, 0.2)'
        : 'rgba(255, 107, 53, 0.15)',
    } as ViewStyle,

    label: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
      marginTop: 4,
      textAlign: 'center',
    } as TextStyle,

    labelActive: {
      color: '#FF6B35',
      fontWeight: '600',
    } as TextStyle,

    labelDisabled: {
      opacity: 0.5,
    } as TextStyle,

    badge: {
      position: 'absolute',
      top: -4,
      right: -6,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#FF6B35',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      borderWidth: 2.5,
      borderColor: isDark ? '#1A1A1A' : '#FFFFFF',
      shadowColor: '#FF6B35',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    } as ViewStyle,

    badgeContent: {
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,

    badgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    } as TextStyle,
  });
};

export default Footer;

