import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore, useAppStore } from '../store';
import { supabase } from '../services/supabase';
import { notificationService } from '../services/notification';
import type { ColorScheme } from '../types';

const THEME_OPTIONS: { label: string; value: ColorScheme }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export function SettingsScreen() {
  const { colors, borderRadius, insets } = useTheme();
  const { user, signOut } = useAuthStore();
  const { colorScheme, setColorScheme } = useAppStore();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    notificationService.getUnreadCount().then(setUnreadCount).catch(() => {});
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
          if (supabase) {
            await supabase.auth.signOut();
          }
          signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 16 }}
    >
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <View style={[styles.section, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Profile</Text>

        <View style={[styles.field, { borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
          <Text style={[styles.fieldValue, { color: colors.text }]}>{user?.email ?? '—'}</Text>
        </View>

        <View style={styles.fieldRow}>
          <View style={[styles.field, { flex: 1, borderBottomWidth: 0 }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
            {isEditingName ? (
              <TextInput
                style={[styles.nameInput, { color: colors.text, borderColor: colors.border, borderRadius: borderRadius.md }]}
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
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={() => {
              if (isEditingName) {
                handleSaveName();
              } else {
                setIsEditingName(true);
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.editButtonText}>{isEditingName ? 'Save' : 'Edit'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.themeOption,
                {
                  backgroundColor: colorScheme === option.value ? colors.primary : colors.surfaceVariant,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={() => setColorScheme(option.value)}
            >
              <Text
                style={[
                  styles.themeOptionText,
                  { color: colorScheme === option.value ? '#fff' : colors.textSecondary },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>
        <View style={styles.notificationRow}>
          <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.fieldValue, { color: colors.text, flex: 1 }]}>
            {unreadCount !== null ? `${unreadCount} unread` : 'Loading...'}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{unreadCount ?? 0}</Text>
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Push notifications are enabled for reminders and tasks
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.signOutButton, { borderColor: colors.error, borderRadius: borderRadius.md }]}
        onPress={handleSignOut}
      >
        <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    gap: 4,
    paddingBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  nameInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signOutButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 40,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    marginTop: 4,
  },
});
