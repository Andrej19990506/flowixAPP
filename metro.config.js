const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [],
  // Исключаем временные директории .cxx из отслеживания
  // Эти директории создаются/удаляются во время сборки Android и вызывают ошибки Metro
  blockList: [
    /.*\/node_modules\/.*\/\.cxx\/.*/,
    /.*\/node_modules\/.*\/android\/\.cxx\/.*/,
    /.*\/node_modules\/.*\/\.gradle\/.*/,
  ],
  // Увеличиваем таймаут для отслеживания файлов
  server: {
    enhanceMiddleware: (middleware) => {
      return middleware;
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
