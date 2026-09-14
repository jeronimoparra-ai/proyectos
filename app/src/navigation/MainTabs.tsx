import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { AcademicScreen } from '../screens/AcademicScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useTheme } from '../hooks';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ tabBarLabel: 'Tasks' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: 'Calendar' }} />
      <Tab.Screen name="Academic" component={AcademicScreen} options={{ tabBarLabel: 'Academic' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}
