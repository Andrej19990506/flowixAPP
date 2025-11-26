import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';

interface EmptyInventoryStateProps {
  title?: string;
  description?: string;
  icon?: string;
  onAction?: () => void;
  actionLabel?: string;
}

const EmptyInventoryState: React.FC<EmptyInventoryStateProps> = ({
  title = 'Инвентарь пуст',
  description = 'Начните добавлять товары в инвентарь',
  icon = 'inventory-2',
  onAction,
  actionLabel = 'Добавить товар',
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon 
          name={icon} 
          size={80} 
          color="#FF6B35"
        />
      </View>
      
      <Text style={styles.title}>{title}</Text>
      
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
      
      {onAction && actionLabel && (
        <View style={styles.actionContainer}>
          <Icon 
            name="add-circle-outline" 
            size={24} 
            color={theme === 'dark' ? '#FF6B35' : '#FF6B35'} 
            style={styles.actionIcon}
          />
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: 'light' | 'dark') => {
  const isDark = theme === 'dark';
  
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 64,
      backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
    } as ViewStyle,
    
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.12)' : 'rgba(255, 107, 53, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    } as ViewStyle,
    
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#000000',
      textAlign: 'center',
      marginBottom: 12,
    } as TextStyle,
    
    description: {
      fontSize: 16,
      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
    } as TextStyle,
    
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255, 107, 53, 0.1)' : 'rgba(255, 107, 53, 0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 107, 53, 0.3)' : 'rgba(255, 107, 53, 0.3)',
    } as ViewStyle,
    
    actionIcon: {
      marginRight: 8,
    } as ViewStyle,
    
    actionLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: '#FF6B35',
    } as TextStyle,
  });
};

export default EmptyInventoryState;

