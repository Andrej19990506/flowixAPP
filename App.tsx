// App.tsx
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

// Компонент для применения темы к StatusBar
const ThemedApp: React.FC = () => {
  const { theme } = useTheme();
  
  return (
    <>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <AppNavigator />
    </>
  );
};

function App(): React.JSX.Element {
  // Логируем запуск приложения для отладки
  console.log('🚀 [App] Приложение запускается...');

  return (
    <Provider store={store}>
      <ThemeProvider>
        <SafeAreaProvider>
          <ThemedApp />
        </SafeAreaProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
