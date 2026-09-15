import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { EnvValidation } from '../config/env';

interface ConfigErrorScreenProps {
  validation: EnvValidation;
}

export function ConfigErrorScreen({ validation }: ConfigErrorScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>Configuración incompleta</Text>
      <Text style={styles.subtitle}>
        La app no puede iniciarse porque faltan variables de entorno necesarias.
      </Text>

      {validation.missingVars.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Variables faltantes:</Text>
          {validation.missingVars.map((varName) => (
            <View key={varName} style={styles.varItem}>
              <Text style={styles.varName}>{varName}</Text>
            </View>
          ))}
        </View>
      )}

      {validation.warnings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advertencias:</Text>
          {validation.warnings.map((warning, i) => (
            <Text key={i} style={styles.warning}>
              {warning}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cómo solucionarlo:</Text>
        <Text style={styles.instruction}>
          1. Crea las variables de entorno en EAS con{'\n'}
          <Text style={styles.code}>eas env:create</Text>
        </Text>
        <Text style={styles.instruction}>
          2. Asegúrate de que el perfil de build en eas.json incluya las variables
        </Text>
        <Text style={styles.instruction}>
          3. Reconstruye la app con{'\n'}
          <Text style={styles.code}>eas build -p android --profile preview</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e74c3c',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  section: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  varItem: {
    backgroundColor: '#2d2d44',
    padding: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  varName: {
    color: '#e74c3c',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  warning: {
    color: '#f39c12',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  instruction: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  code: {
    fontFamily: 'monospace',
    color: '#3498db',
  },
});
