import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation';
import { useTheme } from './src/hooks';
import { usePushNotifications } from './src/hooks/usePushNotifications';

export default function App() {
  const { isDark } = useTheme();
  usePushNotifications();

  return (
    <>
      <RootNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
