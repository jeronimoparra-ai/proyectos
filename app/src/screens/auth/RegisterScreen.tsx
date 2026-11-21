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

interface RegisterScreenProps {
  navigation: any;
}

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { colors, borderRadius, isDark } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage('Please fill in all fields');
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      Alert.alert('Error', 'Password must be at least 8 characters');
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
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        Alert.alert('Registration Failed', error.message);
      } else {
        Alert.alert(
          'Success',
          'Account created! Please check your email to verify your account.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
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
            <BrandLogo size="lg" subtitle="ACADEMIC REGISTRATION" />
            <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign up to get started
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
              <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
                    color: colors.text,
                    borderColor: errorMessage && !displayName.trim() ? colors.error : colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your name"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
                accessibilityLabel="Name"
              />
            </View>

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
              <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
                    color: colors.text,
                    borderColor: errorMessage && password.length < 8 ? colors.error : colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Create a password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                accessibilityLabel="Password"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm Password</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
                    color: colors.text,
                    borderColor: errorMessage && confirmPassword !== password ? colors.error : colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Confirm your password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                accessibilityLabel="Confirm Password"
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
              onPress={handleRegister}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </AnimatedPressable>

            {/* Secondary navigation to Login */}
            <TouchableOpacity
              style={[styles.linkButton, { minHeight: touchTarget.min }]}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Already have an account? Sign In"
            >
              <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                Already have an account?{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  Sign In
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
    marginBottom: 24,
    gap: 6,
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
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
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
    marginTop: 6,
  },
  linkText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
