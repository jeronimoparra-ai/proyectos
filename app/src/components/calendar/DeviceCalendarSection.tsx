import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { eventService } from '../../services/event';
import {
  createDeviceEvent,
  DeviceCalendarInfo,
  getSelectedCalendarId,
  hasCalendarPermission,
  isAutoSyncEnabled,
  listCalendars,
  listDeviceEvents,
  loadSelectedCalendarId,
  requestCalendarAccess,
  setAutoSyncEnabled,
  setSelectedCalendarId,
} from '../../services/device-calendar';
import { openSystemSettings, useAppPermissions } from '../../hooks/useAppPermissions';
import { useTaskStore } from '../../store/useTaskStore';

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendario del dispositivo: no requiere credenciales de Google. En Android los
// calendarios de la cuenta Google estan sincronizados a nivel de sistema.
export function DeviceCalendarSection() {
  const { colors } = useTheme();
  const permissions = useAppPermissions();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [calendars, setCalendars] = useState<DeviceCalendarInfo[]>([]);
  const [selectedCalId, setSelectedCalId] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  // setBusy no actualiza hasta el siguiente render: dos toques rapidos pueden
  // entrar juntos y duplicar la importacion/exportacion.
  const running = useRef(false);
  const tasks = useTaskStore((state) => state.tasks);

  useEffect(() => {
    let active = true;
    async function loadInitialState() {
      const savedId = await loadSelectedCalendarId();
      const syncOptIn = await isAutoSyncEnabled();
      if (!active) return;
      setSelectedCalId(savedId);
      setAutoSync(syncOptIn);

      const hasPerm = await hasCalendarPermission();
      if (hasPerm && active) {
        const cals = await listCalendars();
        if (active) setCalendars(cals);
      }
    }
    void loadInitialState();
    return () => {
      active = false;
    };
  }, []);

  async function refreshCalendarList() {
    setBusy(true);
    try {
      const granted = await requestCalendarAccess();
      if (!granted) {
        setMessage('Calendar permission denied. Enable it in system settings.');
        return;
      }
      const cals = await listCalendars();
      setCalendars(cals);
      setMessage(`Found ${cals.length} calendar${cals.length === 1 ? '' : 's'} on device.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSelectCalendar(cal: DeviceCalendarInfo) {
    if (selectedCalId === cal.id) {
      // Toggle off / reset to auto selection
      setSelectedCalendarId(null);
      setSelectedCalId(null);
      setMessage('Calendar selection cleared. Default system calendar will be used.');
    } else {
      setSelectedCalendarId(cal.id);
      setSelectedCalId(cal.id);
      if (cal.readOnly) {
        setMessage(`Selected "${cal.title}" (Read-only). Available for import only; task export will use an editable calendar or be rejected.`);
      } else {
        setMessage(`Selected "${cal.title}" (Editable) for import and export.`);
      }
    }
  }

  async function handleToggleAutoSync(value: boolean) {
    setAutoSync(value);
    await setAutoSyncEnabled(value);
    setMessage(
      value
        ? 'Auto-sync on app launch enabled. Events will sync automatically without creating duplicates.'
        : 'Auto-sync on app launch disabled.',
    );
  }

  async function importEvents() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (Platform.OS === 'web') throw new Error('Device calendar is only available on the phone.');
      const granted = await requestCalendarAccess();
      if (!granted) {
        setMessage('Calendar permission denied. Enable it in system settings to import events.');
        return;
      }

      // Actualizar lista de calendarios si aún no se había cargado
      if (calendars.length === 0) {
        const cals = await listCalendars();
        setCalendars(cals);
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
      const existingExternalIds = new Set(
        existing.events.map((event) => event.external_id).filter((id): id is string => !!id),
      );
      const seen = new Set(
        existing.events.map(
          (event) => `${event.title.trim().toLowerCase()}|${normalize(event.start_date)}`,
        ),
      );

      let imported = 0;
      for (const event of deviceEvents) {
        const key = `${event.title.trim().toLowerCase()}|${normalize(event.startDate)}`;
        // Anti-duplicados por external_id de dispositivo y por clave normalizada
        if (existingExternalIds.has(event.id) || seen.has(key)) continue;

        await eventService.create({
          title: event.title,
          description: event.notes,
          start_date: event.startDate,
          end_date: event.endDate,
          location: event.location,
          external_id: event.id,
          source: 'local',
        });
        existingExternalIds.add(event.id);
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
      running.current = false;
      setBusy(false);
    }
  }

  async function exportTasks() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (Platform.OS === 'web') throw new Error('Device calendar is only available on the phone.');

      const granted = await requestCalendarAccess();
      if (!granted) {
        setMessage('Calendar permission denied. Enable it in system settings to export tasks.');
        return;
      }

      // Si hay un calendario seleccionado y es de solo lectura, rechazar exportación
      if (selectedCalId) {
        const selected = calendars.find((c) => c.id === selectedCalId);
        if (selected?.readOnly) {
          setMessage('Cannot export tasks: the selected calendar is read-only. Please select an editable calendar.');
          return;
        }
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
      running.current = false;
      setBusy(false);
    }
  }

  const activeCal = calendars.find((c) => c.id === selectedCalId);

  return (
    <View style={{ margin: 16, padding: 16, gap: 12, backgroundColor: colors.surface, borderRadius: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Device calendar</Text>
      <Text style={{ color: colors.textSecondary }}>
        No Google sign-in needed. Import events from your phone calendar, or add tasks with a due date to it.
      </Text>

      {/* Explicación de permisos contextuales y revocación */}
      <View style={{ backgroundColor: colors.background, padding: 10, borderRadius: 8, gap: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
          Permiso de Calendario: {permissions.calendar.granted ? 'Concedido' : 'No concedido'}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
          {permissions.calendar.explanation}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void openSystemSettings()}
          style={{ alignSelf: 'flex-start', marginTop: 4 }}
        >
          <Text style={{ fontSize: 12, color: colors.primary, textDecorationLine: 'underline' }}>
            Gestionar o revocar permisos en Ajustes del Sistema
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selector explícito de calendario */}
      <View style={{ gap: 6 }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            if (calendars.length === 0) void refreshCalendarList();
            setShowCalendarPicker((prev) => !prev);
          }}
          style={{
            padding: 10,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 14 }}>
            {activeCal
              ? `Calendario activo: ${activeCal.title} (${activeCal.readOnly ? 'Solo lectura' : 'Editable'})`
              : 'Calendario activo: Todos / Predeterminado del sistema (Toca para elegir)'}
          </Text>
        </TouchableOpacity>

        {showCalendarPicker && (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Selecciona el calendario para importar eventos o exportar tareas:
            </Text>
            {calendars.length === 0 ? (
              <TouchableOpacity onPress={() => void refreshCalendarList()} style={{ padding: 8 }}>
                <Text style={{ color: colors.primary, fontSize: 12 }}>Cargar calendarios del dispositivo</Text>
              </TouchableOpacity>
            ) : (
              calendars.map((cal) => {
                const isSelected = cal.id === selectedCalId;
                return (
                  <TouchableOpacity
                    key={cal.id}
                    onPress={() => handleSelectCalendar(cal)}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      backgroundColor: isSelected ? colors.primary + '20' : colors.background,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: isSelected ? '600' : '400' }}>
                        {cal.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: cal.readOnly ? '#E67E22' : '#27AE60' }}>
                        {cal.readOnly ? 'Solo lectura (solo importación)' : 'Editable (importación y exportación)'}
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* Sincronización opcional al abrir la app (Consentimiento explícito / Opt-in) */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 6,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
            Sincronizar al abrir la app
          </Text>
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
            Opcional. Requiere consentimiento. Sincroniza eventos sin duplicar.
          </Text>
        </View>
        <Switch
          value={autoSync}
          onValueChange={(val) => void handleToggleAutoSync(val)}
          accessibilityLabel="Sincronización automática al abrir la aplicación"
        />
      </View>

      {!!message && (
        <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 13 }}>
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
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
          Import events from this device
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy || activeCal?.readOnly}
        onPress={() => void exportTasks()}
        style={{
          padding: 12,
          backgroundColor: activeCal?.readOnly ? colors.border : colors.primary,
          borderRadius: 8,
          opacity: busy || activeCal?.readOnly ? 0.5 : 1,
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
          {activeCal?.readOnly ? 'Export disabled (Read-only calendar)' : 'Add my tasks to this device'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
