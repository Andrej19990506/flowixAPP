module.exports = {
  dependencies: {
    // Исключаем react-native-vision-camera из autolinking, т.к. используем нативный QR-сканер
    'react-native-vision-camera': {
      platforms: {
        android: null, // отключаем autolinking для Android
      },
    },
  },
};

