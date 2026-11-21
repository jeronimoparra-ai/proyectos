import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { notificationService } from '../services/notification';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabase';
import { useAutomationStore } from '../store/useAutomationStore';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const currentUser = useAuthStore.getState().user;
    const recipientUserId = notification.request.content.data?.recipientUserId as string | undefined;

    // Protección frente a asociaciones obsoletas:
    // Si no hay usuario activo o el destinatario garantizado no coincide con el usuario logueado,
    // silenciar y ocultar la notificación completamente.
    if (!currentUser || (recipientUserId && recipientUserId !== currentUser.id)) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export function usePushNotifications() {
  const expoPushToken = useRef<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const remindersEnabled = useAutomationStore((s) => s.remindersEnabled);

  const registerForPushNotifications = useCallback(async () => {
    if (!user || !supabase) return;

    // Solo registrar push si los recordatorios están habilitados
    if (!remindersEnabled) {
      console.log('[usePushNotifications] Reminders disabled, skipping push registration');
      return;
    }

    const registrationUserId = user.id;

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

      // SDK 57 exige el projectId de EAS para emitir el token; si no, lanza
      // "An Expo project ID is required" y el push queda silenciosamente muerto.
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      // Guard: descartar respuesta tardía si la sesión cambió o se cerró durante el registro
      const current = useAuthStore.getState().user;
      if (!current || current.id !== registrationUserId) {
        return;
      }

      expoPushToken.current = tokenData.data;
      notificationService.setDevicePushToken(tokenData.data);

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

      // Procesar desvinculaciones o bajas previas encoladas offline
      await notificationService.flushPendingOperations().catch(() => {});
    } catch (err) {
      console.warn('[usePushNotifications] Error during push notification setup:', err);
    }
  }, [user, remindersEnabled]);

  useEffect(() => {
    if (!user) return;

    registerForPushNotifications();

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const currentUser = useAuthStore.getState().user;
      const recipientUserId = notification.request.content.data?.recipientUserId as string | undefined;
      if (recipientUserId && currentUser && recipientUserId !== currentUser.id) {
        // Ignorar notificación de usuario anterior
        return;
      }
      console.log('Notification received:', notification.request.content);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const currentUser = useAuthStore.getState().user;
        const data = response.notification.request.content.data;
        const recipientUserId = data?.recipientUserId as string | undefined;
        if (recipientUserId && currentUser && recipientUserId !== currentUser.id) {
          // No procesar tap de notificación obsoleta
          return;
        }
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
