import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { notificationService } from '../services/notification';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const expoPushToken = useRef<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const registerForPushNotifications = useCallback(async () => {
    if (!user || !supabase) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      expoPushToken.current = tokenData.data;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B35',
        });
      }

      try {
        await notificationService.registerPushToken(
          tokenData.data,
          Platform.OS as 'android' | 'ios'
        );
      } catch (err) {
        console.warn('[usePushNotifications] Failed to register push token with backend:', err);
      }
    } catch (err) {
      console.warn('[usePushNotifications] Error during push notification setup:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    registerForPushNotifications();

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('Notification tapped:', data);
      }
    );

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, [user, registerForPushNotifications]);

  return { expoPushToken };
}
