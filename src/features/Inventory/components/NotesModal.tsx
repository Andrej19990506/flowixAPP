import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: string;
  onSave: (notes: string) => void;
  onDelete: () => void;
  itemName: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;
const isMediumScreen = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;

const getResponsiveSize = (small: number, medium: number, large: number) => {
  if (isSmallScreen) return small;
  if (isMediumScreen) return medium;
  return large;
};

const NotesModal: React.FC<NotesModalProps> = ({
  isOpen,
  onClose,
  notes,
  onSave,
  onDelete,
  itemName,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';
  const styles = createStyles(isDark, insets);

  const [editedNotes, setEditedNotes] = useState(notes);
  const [hasChanges, setHasChanges] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (isOpen) {
      setEditedNotes(notes);
      setHasChanges(false);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const handleNotesChange = (value: string) => {
    setEditedNotes(value);
    setHasChanges(value !== notes);
  };

  const handleSave = () => {
    onSave(editedNotes);
    setHasChanges(false);
    onClose();
  };

  const handleCancel = () => {
    setEditedNotes(notes);
    setHasChanges(false);
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  if (!isOpen) return null;

  const translateY = slideAnim;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={handleCancel}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.modal,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Icon name="note" size={getResponsiveSize(20, 22, 24)} color="#FF6B35" />
              <Text style={styles.title}>Заметки для товара</Text>
            </View>
            <Pressable onPress={handleCancel} style={styles.closeButton}>
              <Icon name="close" size={getResponsiveSize(20, 22, 24)} color={isDark ? '#FFFFFF' : '#1A1A1A'} />
            </Pressable>
          </View>

          <View style={styles.itemNameContainer}>
            <Text style={styles.itemName}>{itemName}</Text>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <TextInput
              style={styles.textarea}
              value={editedNotes}
              onChangeText={handleNotesChange}
              placeholder="Введите заметки для этого товара..."
              placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
              multiline
              textAlignVertical="top"
              selectionColor="#FF6B35"
            />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.buttonPressed,
                !notes.trim() && styles.buttonDisabled,
              ]}
              disabled={!notes.trim()}
            >
              <Icon 
                name="delete" 
                size={getResponsiveSize(16, 18, 20)} 
                color="#FFFFFF" 
              />
              <Text style={styles.deleteButtonText}>Удалить</Text>
            </Pressable>

            <View style={styles.rightButtons}>
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.cancelButtonText}>Отменить</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.buttonPressed,
                  !hasChanges && styles.buttonDisabled,
                ]}
                disabled={!hasChanges}
              >
                <Icon 
                  name="check" 
                  size={getResponsiveSize(16, 18, 20)} 
                  color="#FFFFFF" 
                />
                <Text style={styles.saveButtonText}>Сохранить</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (isDark: boolean, insets: any) => {
  const horizontalPadding = getResponsiveSize(20, 24, 28);
  const colors = {
    background: isDark ? '#0F0F0F' : '#FAFAFA',
    surface: isDark ? '#1A1A1A' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    textSecondary: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    backdrop: 'rgba(0, 0, 0, 0.7)',
  };

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    modal: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: getResponsiveSize(28, 32, 36),
      borderTopRightRadius: getResponsiveSize(28, 32, 36),
      maxHeight: SCREEN_HEIGHT * 0.9,
      paddingBottom: Math.max(insets.bottom, getResponsiveSize(20, 24, 28)),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -12 },
      shadowOpacity: 0.4,
      shadowRadius: 32,
      elevation: 40,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: horizontalPadding,
      paddingVertical: getResponsiveSize(20, 24, 28),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getResponsiveSize(10, 12, 14),
    },
    title: {
      fontSize: getResponsiveSize(18, 20, 22),
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      width: getResponsiveSize(40, 44, 48),
      height: getResponsiveSize(40, 44, 48),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: getResponsiveSize(20, 22, 24),
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    },
    itemNameContainer: {
      paddingHorizontal: horizontalPadding,
      paddingVertical: getResponsiveSize(12, 16, 20),
    },
    itemName: {
      fontSize: getResponsiveSize(14, 15, 16),
      color: colors.textSecondary,
      fontWeight: '500',
    },
    content: {
      flex: 1,
      paddingHorizontal: horizontalPadding,
    },
    textarea: {
      minHeight: getResponsiveSize(200, 250, 300),
      fontSize: getResponsiveSize(15, 16, 17),
      color: colors.text,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: getResponsiveSize(12, 14, 16),
      padding: getResponsiveSize(16, 20, 24),
      borderWidth: 1,
      borderColor: colors.border,
      textAlignVertical: 'top',
    },
    footer: {
      flexDirection: isSmallScreen ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isSmallScreen ? 'stretch' : 'center',
      paddingHorizontal: horizontalPadding,
      paddingTop: getResponsiveSize(12, 16, 20),
      paddingBottom: getResponsiveSize(8, 12, 16),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: getResponsiveSize(8, 10, 12),
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: getResponsiveSize(6, 8, 10),
      paddingVertical: getResponsiveSize(12, 14, 16),
      paddingHorizontal: getResponsiveSize(14, 18, 22),
      borderRadius: getResponsiveSize(12, 14, 16),
      backgroundColor: '#DC3545',
      ...(isSmallScreen && {
        width: '100%',
      }),
    },
    deleteButtonText: {
      color: '#FFFFFF',
      fontSize: getResponsiveSize(13, 14, 15),
      fontWeight: '600',
    },
    rightButtons: {
      flexDirection: 'row',
      gap: getResponsiveSize(8, 10, 12),
      ...(isSmallScreen && {
        width: '100%',
      }),
    },
    cancelButton: {
      flex: isSmallScreen ? 1 : 0,
      paddingVertical: getResponsiveSize(12, 14, 16),
      paddingHorizontal: getResponsiveSize(16, 20, 24),
      borderRadius: getResponsiveSize(12, 14, 16),
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: {
      color: colors.text,
      fontSize: getResponsiveSize(13, 14, 15),
      fontWeight: '600',
    },
    saveButton: {
      flex: isSmallScreen ? 1 : 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: getResponsiveSize(6, 8, 10),
      paddingVertical: getResponsiveSize(12, 14, 16),
      paddingHorizontal: getResponsiveSize(16, 20, 24),
      borderRadius: getResponsiveSize(12, 14, 16),
      backgroundColor: '#FF6B35',
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: getResponsiveSize(13, 14, 15),
      fontWeight: '600',
    },
    buttonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.96 }],
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
};

export default NotesModal;

