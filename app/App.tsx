import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { RootNavigator } from './src/navigation';
import { useTheme } from './src/hooks';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { envValidation } from './src/config/env';

export default function App() {
  const { isDark } = useTheme();
  usePushNotifications();

  if (!envValidation.isValid) {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          <Text style={styles.title}>Configuración necesaria</Text>
          <Text style={styles.message}>{envValidation.missingVars.length > 0 ? 'Faltan variables de Supabase' : 'Configuración incompleta'}</Text>
          <Text style={styles.message}>{envValidation.warnings.join(' • ')}</Text>
          <Text style={styles.message}>Regresa cuando esté configurada la cuenta de Supabase</Text>
          <TouchableOpacity style={styles.button} onPress={() => reload()}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
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

function reload() {
  window.location.reload();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e74c3c',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
