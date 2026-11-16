import { useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { eventService } from '../../services/event';
import {
  createDeviceEvent,
  hasCalendarPermission,
  listDeviceEvents,
  requestCalendarAccess,
} from '../../services/device-calendar';
import { useTaskStore } from '../../store/useTaskStore';

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendario del dispositivo: no requiere credenciales de Google. En Android los
// calendarios de la cuenta Google estan sincronizados a nivel de sistema.
export function DeviceCalendarSection() {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const tasks = useTaskStore((state) => state.tasks);

  async function importEvents() {
    setBusy(true);
    setMessage('');
    try {
      if (Platform.OS === 'web') throw new Error('Device calendar is only available on the phone.');
      const granted = await requestCalendarAccess();
      if (!granted) {
        setMessage('Calendar permission denied. Enable it in system settings to import events.');
        return;
      }

      const from = new Date(Date.now() - 7 * DAY_MS);
      const to = new Date(Date.now() + 60 * DAY_MS);
      const deviceEvents = await listDeviceEvents(from, to);

      const existing = await eventService.list({
        start_after: from.toISOString(),
        start_before: to.toISOString(),
        limit: 100,
      });
      const normalize = (date: string) => new Date(date).toISOString();
      const seen = new Set(
        existing.events.map(
          (event) => `${event.title.trim().toLowerCase()}|${normalize(event.start_date)}`,
        ),
      );

      let imported = 0;
      for (const event of deviceEvents) {
        const key = `${event.title.trim().toLowerCase()}|${normalize(event.startDate)}`;
        if (seen.has(key)) continue;
        await eventService.create({
          title: event.title,
          description: event.notes,
          start_date: event.startDate,
          end_date: event.endDate,
          location: event.location,
        });
        seen.add(key);
        imported += 1;
      }

      setMessage(
        imported === 0
          ? 'No new events found in your device calendar.'
          : `Imported ${imported} event${imported === 1 ? '' : 's'}. Reopen Calendar to refresh.`,
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function exportTasks() {
    setBusy(true);
    setMessage('');
    try {
      if (Platform.OS === 'web') throw new Error('Device calendar is only available on the phone.');

      const granted = await requestCalendarAccess();
      if (!granted) {
        setMessage('Calendar permission denied. Enable it in system settings to export tasks.');
        return;
      }

      const withDate = tasks.flatMap((task) =>
        task.due_date ? [{ task, due: task.due_date }] : [],
      );
      if (withDate.length === 0) {
        setMessage('No tasks with a due date to export.');
        return;
      }

      // Evita duplicados si el usuario pulsa dos veces o los eventos ya estan en el telefono.
      const firstDue = Math.min(...withDate.map(({ due }) => new Date(due).getTime()));
      const lastDue = Math.max(...withDate.map(({ due }) => new Date(due).getTime()));
      const existingDevice = await listDeviceEvents(new Date(firstDue), new Date(lastDue + DAY_MS));
      const normalize = (date: string) => new Date(date).toISOString();
      const existingKeys = new Set(
        existingDevice.map((event) => `${event.title.trim().toLowerCase()}|${normalize(event.startDate)}`),
      );

      let exported = 0;
      for (const { task, due } of withDate) {
        const start = new Date(due);
        const key = `${task.title.trim().toLowerCase()}|${normalize(start.toISOString())}`;
        if (existingKeys.has(key)) continue;
        await createDeviceEvent({
          title: task.title,
          startDate: start.toISOString(),
          endDate: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
          notes: task.description ?? undefined,
        });
        existingKeys.add(key);
        exported += 1;
      }
      setMessage(exported === 0 ? 'All tasks are already in your device calendar.' : `Added ${exported} task${exported === 1 ? '' : 's'} to your device calendar.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkPermission() {
    setBusy(true);
    const granted = await hasCalendarPermission();
    setMessage(granted ? 'Calendar access granted.' : 'Calendar access not granted yet.');
    setBusy(false);
  }

  return (
    <View style={{ margin: 16, padding: 16, gap: 12, backgroundColor: colors.surface, borderRadius: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Device calendar</Text>
      <Text style={{ color: colors.textSecondary }}>
        No Google sign-in needed. Import events from your phone calendar, or add tasks with a due date to it.
      </Text>
      {!!message && (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {message}
        </Text>
      )}
      {busy && <ActivityIndicator accessibilityLabel="Updating device calendar" />}
      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void importEvents()}
        style={{ padding: 12, backgroundColor: colors.primary, borderRadius: 8, opacity: busy ? 0.5 : 1 }}
      >
        <Text style={{ color: '#fff' }}>Import events from this device</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void exportTasks()}
        style={{ padding: 12, backgroundColor: colors.primary, borderRadius: 8, opacity: busy ? 0.5 : 1 }}
      >
        <Text style={{ color: '#fff' }}>Add my tasks to this device</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void checkPermission()}>
        <Text style={{ color: colors.textSecondary }}>Check calendar permission</Text>
      </TouchableOpacity>
    </View>
  );
}
