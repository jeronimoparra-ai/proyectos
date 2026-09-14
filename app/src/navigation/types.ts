import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
  TaskDetail: { taskId: string };
  TaskForm: { taskId?: string };
  EventDetail: { eventId: string };
  EventForm: { eventId?: string };
  AcademicTaskDetail: { taskId: string };
  AcademicTaskForm: { taskId?: string };
  ReviewDetail: { taskId: string };
};

export type TabParamList = {
  Home: undefined;
  Tasks: undefined;
  Calendar: undefined;
  Academic: undefined;
  Settings: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
