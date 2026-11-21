import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore, useAppStore, clearAllUserStores } from '../store';
import { supabase } from '../services/supabase';
import { notificationService } from '../services/notification';
import { apiClient } from '../services/api';
import { GoogleCalendarSection } from '../components/calendar/GoogleCalendarSection';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { IconBell } from '../components/icons';
import { DeviceCalendarSection } from '../components/calendar/DeviceCalendarSection';
import { BrandLogo, MilestoneBadge } from '../components/brand';
import {
  AutomationsSection,
  PermissionsSection,
  OfflineSection,
  PrivacySection,
} from '../components/settings';
import { touchTarget, shadows } from '../theme';
import type { ColorScheme } from '../types';

const THEME_OPTIONS: { label: string; value: ColorScheme }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export function SettingsScreen() {
  const { colors, borderRadius, insets, isDark } = useTheme();
  const { user } = useAuthStore();
  const { colorScheme, setColorScheme } = useAppStore();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    notificationService
      .getUnreadCount()
      .then(setUnreadCount)
      .catch((err) => {
        console.warn('[SettingsScreen] Failed to load unread count:', err);
      });
  }, []);

  const handleSaveName = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    if (!supabase) {
      Alert.alert('Error', 'Authentication service is not configured');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() },
      });
      if (error) throw error;
      setIsEditingName(false);
      Alert.alert('Success', 'Profile updated');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          // 1. Cancelar peticiones de red pendientes del usuario saliente
          apiClient.abortAll();

          // 2. Desvinculación idempotente del dispositivo ANTES de invalidar la sesión
          try {
            await notificationService.unbindCurrentDevice();
          } catch (err) {
            console.warn('[SettingsScreen] Failed to unbind push token before signOut:', err);
          }

          // 3. Invalidar la sesión en Supabase
          if (supabase) {
            try {
              await supabase.auth.signOut();
            } catch (err) {
              console.warn('[SettingsScreen] Supabase signOut error:', err);
            }
          }

          // 4. Limpiar stores Zustand y estado de usuario
          clearAllUserStores();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16 }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <BrandLogo size="sm" showWordmark={true} subtitle="PREFERENCES" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      {/* Group: Profile & Account */}
      <View
        style={[
          styles.section,
          shadows.sm,
          { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Profile</Text>
          <MilestoneBadge variant="ink" size="sm" label="Account Active" />
        </View>

        <View style={[styles.field, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
          <Text style={[styles.fieldValue, { color: colors.text }]}>{user?.email ?? '—'}</Text>
        </View>

        <View style={styles.fieldRow}>
          <View style={[styles.field, { flex: 1, borderBottomWidth: 0 }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
            {isEditingName ? (
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? colors.surfaceVariant : colors.background,
                    borderColor: colors.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {user?.display_name ?? 'Not set'}
              </Text>
            )}
          </View>
          <AnimatedPressable
            style={[
              styles.editButton,
              {
                backgroundColor: isEditingName ? colors.primary : isDark ? colors.surfaceVariant : colors.inkMuted,
                borderColor: colors.primary,
                borderRadius: borderRadius.md,
                minHeight: touchTarget.min,
              },
            ]}
            onPress={() => {
              if (isEditingName) {
                handleSaveName();
              } else {
                setIsEditingName(true);
              }
            }}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={isEditingName ? 'Save profile name' : 'Edit profile name'}
          >
            {isSaving ? (
              <ActivityIndicator color={isEditingName ? '#FFFFFF' : colors.primary} size="small" />
            ) : (
              <Text
                style={[
                  styles.editButtonText,
                  { color: isEditingName ? '#FFFFFF' : colors.primary },
                ]}
              >
                {isEditingName ? 'Save' : 'Edit'}
              </Text>
            )}
          </AnimatedPressable>
        </View>
      </View>

      {/* Group: Appearance */}
      <View
        style={[
          styles.section,
          shadows.sm,
          { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = colorScheme === option.value;
            return (
              <AnimatedPressable
                key={option.value}
                containerStyle={{ flex: 1 }}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: isSelected ? colors.primary : isDark ? colors.surfaceVariant : colors.background,
                    borderColor: isSelected ? colors.primaryDark : colors.border,
                    borderRadius: borderRadius.md,
                    minHeight: touchTarget.min,
                  },
                ]}
                onPress={() => setColorScheme(option.value)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${option.label} theme`}
                accessibilityState={{ selected: isSelected }}
              >
                {isSelected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#FFFFFF"
                    style={styles.themeIcon}
                  />
                ) : null}
                <Text
                  style={[
                    styles.themeOptionText,
                    {
                      color: isSelected ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      {/* Group: Notifications & Permissions */}
      <View
        style={[
          styles.section,
          shadows.sm,
          { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>
          <MilestoneBadge variant="success" size="sm" label="Enabled" />
        </View>

        <View
          style={[
            styles.notificationRow,
            {
              backgroundColor: isDark ? colors.surfaceVariant : colors.background,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.inkMuted }]}>
            <IconBell size={18} color={colors.primary} />
          </View>
          <Text style={[styles.fieldValue, { color: colors.text, flex: 1 }]}>
            {unreadCount !== null ? `${unreadCount} unread` : 'Loading...'}
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: unreadCount && unreadCount > 0 ? colors.accent : colors.surfaceVariant,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: unreadCount && unreadCount > 0 ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {unreadCount ?? 0}
            </Text>
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          In-app reminders are enabled. Push delivery needs Firebase configuration.
        </Text>
      </View>

      {/* Group: Automations & Calendar Integrations */}
      <View style={styles.integrationGroup}>
        <DeviceCalendarSection />
        <GoogleCalendarSection />
      </View>

      {/* Group: Automations & Device (Equipo D) */}
      <AutomationsSection />
      <PermissionsSection />
      <OfflineSection />
      <PrivacySection />

      {/* Sign Out Action */}
      <AnimatedPressable
        style={[
          styles.signOutButton,
          {
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
            borderColor: colors.error,
            borderRadius: borderRadius.md,
            minHeight: touchTarget.comfortable,
          },
        ]}
        onPress={handleSignOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.error} style={{ marginRight: 6 }} />
        <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
      </AnimatedPressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  field: {
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  nameInput: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    gap: 6,
  },
  themeIcon: {
    marginRight: -2,
  },
  themeOptionText: {
    fontSize: 13,
  },
  signOutButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
  },
  integrationGroup: {
    marginBottom: 8,
  },
});
