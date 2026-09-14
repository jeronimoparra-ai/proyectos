import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation';
import { useTheme } from './src/hooks';

export default function App() {
  const { isDark } = useTheme();

  return (
    <>
      <RootNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
