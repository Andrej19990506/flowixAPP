/**
 * @format
 */

// react-native-gesture-handler ДОЛЖЕН быть импортирован самым первым
import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import { NativeWindStyleSheet } from 'nativewind';
import App from './App';
import { name as appName } from './app.json';

NativeWindStyleSheet.setOutput({
  default: 'native',
});

AppRegistry.registerComponent(appName, () => App);
