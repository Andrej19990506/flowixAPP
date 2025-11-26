module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      // КРИТИЧНО: Плагин для worklets ДОЛЖЕН быть первым!
      'react-native-worklets-core/plugin',
      'nativewind/babel',
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.json', '.tsx', '.ts'],
          alias: {
            '@contexts': './src/contexts',
            '@navigation': './src/navigation',
            '@shared': './src/shared',
            '@features': './src/features',
          },
        },
      ],
    ],
  };
};
