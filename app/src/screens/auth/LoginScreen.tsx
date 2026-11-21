import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks';
import { supabase } from '../../services/supabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { BrandLogo } from '../../components/brand';
import { touchTarget, shadows } from '../../theme';

interface LoginScreenProps {
  navigation: any;
}

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { colors, borderRadius, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please fill in all fields');
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!supabase) {
      setErrorMessage('Authentication service is not configured');
      Alert.alert('Error', 'Authentication service is not configured');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        Alert.alert('Login Failed', error.message);
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred');
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cardWrapper}>
          {/* Brand header */}
          <View style={styles.header}>
            <BrandLogo size="lg" subtitle="ACADEMIC WORKSPACE" />
            <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in to continue
            </Text>
          </View>

          {/* Visible error state banner */}
          {errorMessage ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.errorLight,
                  borderColor: colors.error,
                  borderRadius: borderRadius.md,
                },
              ]}
              accessible
              accessibilityRole="alert"
            >
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={[styles.errorBannerText, { color: colors.error }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
                    color: colors.text,
                    borderColor: errorMessage && !email.trim() ? colors.error : colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your email"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.forgotPasswordInline}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password?"
                >
                  <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
                    color: colors.text,
                    borderColor: errorMessage && !password.trim() ? colors.error : colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                accessibilityLabel="Password"
              />
            </View>

            {/* Unequivocal Primary CTA */}
            <AnimatedPressable
              style={[
                styles.button,
                shadows.sm,
                {
                  backgroundColor: colors.primary,
                  borderColor: isDark ? colors.borderFocus : colors.primaryDark,
                  borderRadius: borderRadius.md,
                  minHeight: touchTarget.comfortable,
                },
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </AnimatedPressable>

            {/* Secondary navigation to Register */}
            <TouchableOpacity
              style={[styles.linkButton, { minHeight: touchTarget.min }]}
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="button"
              accessibilityLabel="Don't have an account? Sign Up"
            >
              <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                Don't have an account?{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  Sign Up
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 28,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  form: {
    gap: 18,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  forgotPasswordInline: {
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
