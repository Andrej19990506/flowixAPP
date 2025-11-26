import { useMemo, useState } from 'react';
import type { FooterButton } from '../../../shared/components/Footer';

interface UseInventoryFooterOptions {
  onSearchPress?: () => void;
  onQrScanPress?: () => void;
  isSearchActive?: boolean;
  isQrScannerOpen?: boolean;
}

export const useInventoryFooter = (options: UseInventoryFooterOptions = {}) => {
  const {
    onSearchPress,
    onQrScanPress,
    isSearchActive = false,
    isQrScannerOpen = false,
  } = options;

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const buttons: FooterButton[] = useMemo(() => {
    const footerButtons: FooterButton[] = [];

    // Кнопка поиска
    if (onSearchPress !== undefined) {
      footerButtons.push({
        id: 'search',
        icon: isSearchOpen ? 'close' : 'search',
        label: isSearchOpen ? 'Закрыть' : 'Поиск',
        onPress: () => {
          setIsSearchOpen((prev) => !prev);
          onSearchPress();
        },
        active: isSearchActive || isSearchOpen,
      });
    }

    // Кнопка QR-сканера
    if (onQrScanPress !== undefined) {
      footerButtons.push({
        id: 'qr-scan',
        icon: isQrScannerOpen ? 'qr-code-scanner' : 'qr-code-scanner',
        label: isQrScannerOpen ? 'QR-сканер (открыт)' : 'QR-сканер',
        onPress: onQrScanPress,
        active: isQrScannerOpen,
      });
    }

    return footerButtons;
  }, [onSearchPress, onQrScanPress, isSearchActive, isQrScannerOpen, isSearchOpen]);

  return {
    buttons,
    isSearchOpen,
    setIsSearchOpen,
  };
};

