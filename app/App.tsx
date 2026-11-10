import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation';
import { useTheme } from './src/hooks';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ConfigErrorScreen } from './src/components/ConfigErrorScreen';
import { envValidation } from './src/config/env';

export default function App() {
  const { isDark } = useTheme();

  // Los hooks no pueden llamarse condicionalmente: se ejecuta antes del guard.
  // Dentro comprueba que exista cliente de Supabase y sale si no hay configuracion.
  usePushNotifications();

  // Sin configuracion valida no se monta la app: se muestra una pantalla que
  // explica que falta en lugar de arrancar contra un backend inexistente.
  if (!envValidation.isValid) {
    return (
      <ErrorBoundary>
        <ConfigErrorScreen validation={envValidation} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <RootNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ErrorBoundary>
  );
}
