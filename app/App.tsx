import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation';
import { useTheme } from './src/hooks';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ConfigErrorScreen } from './src/components/ConfigErrorScreen';
import { envValidation } from './src/config/env';

export default function App() {
  const { isDark } = useTheme();
  usePushNotifications();

  if (!envValidation.isValid) {
    return <ConfigErrorScreen validation={envValidation} />;
  }

  return (
    <ErrorBoundary>
      <RootNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ErrorBoundary>
  );
}
