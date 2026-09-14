import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { AuthNavigator } from './AuthNavigator';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { TaskFormScreen } from '../screens/TaskFormScreen';
import { EventDetailScreen } from '../screens/EventDetailScreen';
import { EventFormScreen } from '../screens/EventFormScreen';
import { AcademicTaskDetailScreen } from '../screens/AcademicTaskDetailScreen';
import { AcademicTaskFormScreen } from '../screens/AcademicTaskFormScreen';
import { ReviewDetailScreen } from '../screens/ReviewDetailScreen';
import { useTheme, useAuthListener } from '../hooks';
import { useAuthStore } from '../store';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuthStore();

  useAuthListener();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: isDark,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.primary,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      {isAuthenticated ? (
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TaskForm" component={TaskFormScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EventForm" component={EventFormScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AcademicTaskDetail" component={AcademicTaskDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AcademicTaskForm" component={AcademicTaskFormScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ReviewDetail" component={ReviewDetailScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
