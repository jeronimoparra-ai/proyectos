// Run from app: node --test src/__tests__/android-integration.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const toPlain = (obj) => JSON.parse(JSON.stringify(obj));

// Helper to compile and run TypeScript files in a mocked sandbox
function loadModule(filePath, customGlobals = {}) {
  const source = fs.readFileSync(require.resolve(filePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const exports = {};
  const moduleObj = { exports };
  const sandbox = {
    exports,
    module: moduleObj,
    require: (name) => {
      if (customGlobals[name]) return customGlobals[name];
      if (name.includes('device-calendar')) return customGlobals['device-calendar'] || exports;
      if (name.includes('useAppPermissions')) return customGlobals['useAppPermissions'] || exports;
      if (name.includes('event')) return customGlobals['./event'] || customGlobals.eventService;
      return {};
    },
    console,
    Date,
    Set,
    Map,
    Array,
    Object,
    Promise,
    setTimeout,
    clearTimeout,
    ...customGlobals,
  };

  vm.runInNewContext(compiled, sandbox);
  return sandbox.module.exports;
}

// In-memory mock for AsyncStorage
function createMockAsyncStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => { store.set(key, String(value)); },
    removeItem: async (key) => { store.delete(key); },
    clear: async () => { store.clear(); },
    _store: store,
  };
}

// In-memory mock for Expo Calendar
function createMockExpoCalendar(options = {}) {
  let permissionsGranted = options.permissionsGranted ?? true;
  let calendars = options.calendars ?? [
    {
      id: 'cal-personal',
      title: 'Personal',
      allowsModifications: true,
      isPrimary: true,
      createEvent: async (data) => ({ id: `event-created-${Date.now()}`, ...data }),
    },
    {
      id: 'cal-holidays',
      title: 'Festivos Nacionales',
      allowsModifications: false,
      isPrimary: false,
      createEvent: async () => { throw new Error('Write failed on read-only'); },
    },
  ];

  let queriedCalendars = [];
  let eventsList = options.events ?? [];

  return {
    EntityTypes: { EVENT: 'event', REMINDER: 'reminder' },
    getCalendarPermissions: async () => ({
      status: permissionsGranted ? 'granted' : 'denied',
      granted: permissionsGranted,
      canAskAgain: true,
    }),
    requestCalendarPermissions: async () => ({
      status: permissionsGranted ? 'granted' : 'denied',
      granted: permissionsGranted,
      canAskAgain: true,
    }),
    getCalendars: async () => calendars,
    listEvents: async (targetCals, from, to) => {
      queriedCalendars = targetCals;
      return eventsList;
    },
    setGranted: (val) => { permissionsGranted = val; },
    setCalendars: (cals) => { calendars = cals; },
    setEvents: (events) => { eventsList = events; },
    getQueriedCalendars: () => queriedCalendars,
  };
}

// Mock EventService
function createMockEventService() {
  const existingEvents = [];
  return {
    eventService: {
      list: async () => ({ events: [...existingEvents], total: existingEvents.length, page: 1, limit: 100 }),
      create: async (data) => {
        const created = { id: `server-evt-${existingEvents.length + 1}`, ...data };
        existingEvents.push(created);
        return created;
      },
    },
    _events: existingEvents,
  };
}

test('1. Contrato device-calendar: listCalendars, getSelectedCalendarId, setSelectedCalendarId', async () => {
  const asyncStorage = createMockAsyncStorage();
  const mockCalendar = createMockExpoCalendar();
  const mockEventService = createMockEventService();

  const mod = loadModule('../services/device-calendar.ts', {
    'expo-calendar': mockCalendar,
    '@react-native-async-storage/async-storage': asyncStorage,
    './event': mockEventService,
  });

  // Test listCalendars
  const calendars = await mod.listCalendars();
  assert.equal(calendars.length, 2);
  assert.deepEqual(toPlain(calendars[0]), { id: 'cal-personal', title: 'Personal', readOnly: false });
  assert.deepEqual(toPlain(calendars[1]), { id: 'cal-holidays', title: 'Festivos Nacionales', readOnly: true });

  // Test calendar selection contract
  assert.equal(mod.getSelectedCalendarId(), null);

  mod.setSelectedCalendarId('cal-personal');
  assert.equal(mod.getSelectedCalendarId(), 'cal-personal');

  // Verify persistence in AsyncStorage
  const stored = await asyncStorage.getItem('@productivity_selected_calendar_id');
  assert.equal(stored, 'cal-personal');

  // Clear selection
  mod.setSelectedCalendarId(null);
  assert.equal(mod.getSelectedCalendarId(), null);
  const cleared = await asyncStorage.getItem('@productivity_selected_calendar_id');
  assert.equal(cleared, null);
});

test('2. Selección de calendario restringe la consulta en listDeviceEvents', async () => {
  const asyncStorage = createMockAsyncStorage();
  const mockCalendar = createMockExpoCalendar({
    events: [
      { id: 'dev-1', title: 'Evento 1', startDate: new Date('2026-11-21T10:00:00Z'), endDate: new Date('2026-11-21T11:00:00Z') },
    ],
  });
  const mockEventService = createMockEventService();

  const mod = loadModule('../services/device-calendar.ts', {
    'expo-calendar': mockCalendar,
    '@react-native-async-storage/async-storage': asyncStorage,
    './event': mockEventService,
  });

  // Sin selección: consulta todos los calendarios
  mod.setSelectedCalendarId(null);
  await mod.listDeviceEvents(new Date('2026-11-20'), new Date('2026-11-25'));
  assert.equal(mockCalendar.getQueriedCalendars().length, 2);

  // Con selección específica: consulta únicamente el seleccionado
  mod.setSelectedCalendarId('cal-holidays');
  await mod.listDeviceEvents(new Date('2026-11-20'), new Date('2026-11-25'));
  const queried = mockCalendar.getQueriedCalendars();
  assert.equal(queried.length, 1);
  assert.equal(queried[0].id, 'cal-holidays');
});

test('3. Permiso denegado: listCalendars retorna vacío y sync falla de forma segura', async () => {
  const asyncStorage = createMockAsyncStorage({
    '@productivity_calendar_auto_sync_opt_in': 'true',
  });
  const mockCalendar = createMockExpoCalendar({ permissionsGranted: false });
  const mockEventService = createMockEventService();

  const mod = loadModule('../services/device-calendar.ts', {
    'expo-calendar': mockCalendar,
    '@react-native-async-storage/async-storage': asyncStorage,
    './event': mockEventService,
  });

  const hasPerm = await mod.hasCalendarPermission();
  assert.equal(hasPerm, false);

  const calendars = await mod.listCalendars();
  assert.deepEqual(toPlain(calendars), []);

  const syncResult = await mod.syncDeviceCalendarOnStartup();
  assert.equal(syncResult.synced, false);
  assert.equal(syncResult.reason, 'Calendar permission not granted');
});

test('4. Export a calendario de solo lectura es RECHAZADO con error', async () => {
  const asyncStorage = createMockAsyncStorage();
  const mockCalendar = createMockExpoCalendar();
  const mockEventService = createMockEventService();

  const mod = loadModule('../services/device-calendar.ts', {
    'expo-calendar': mockCalendar,
    '@react-native-async-storage/async-storage': asyncStorage,
    './event': mockEventService,
  });

  // Seleccionamos un calendario de solo lectura (cal-holidays)
  mod.setSelectedCalendarId('cal-holidays');

  await assert.rejects(
    async () => {
      await mod.createDeviceEvent({
        title: 'Estudiar examen',
        startDate: '2026-11-22T09:00:00Z',
        endDate: '2026-11-22T10:00:00Z',
      });
    },
    {
      message: 'Cannot export to a read-only calendar.',
    }
  );

  // Cambiamos a un calendario editable: debe completarse con éxito
  mod.setSelectedCalendarId('cal-personal');
  const eventId = await mod.createDeviceEvent({
    title: 'Estudiar examen',
    startDate: '2026-11-22T09:00:00Z',
    endDate: '2026-11-22T10:00:00Z',
  });
  assert.match(eventId, /^event-created-/);
});

test('5. Sincronización e importación SIN DUPLICADOS (external_id y coincidencia de clave)', async () => {
  const asyncStorage = createMockAsyncStorage({
    '@productivity_calendar_auto_sync_opt_in': 'true',
  });

  const deviceDate1 = new Date(Date.now() + 86400000);
  const deviceDate2 = new Date(Date.now() + 172800000);
  const deviceDate3 = new Date(Date.now() + 259200000);

  const mockCalendar = createMockExpoCalendar({
    events: [
      { id: 'ext-device-1', title: 'Taller de Sistemas', startDate: deviceDate1, endDate: new Date(deviceDate1.getTime() + 3600000) },
      { id: 'ext-device-2', title: 'Reunión de Grupo', startDate: deviceDate2, endDate: new Date(deviceDate2.getTime() + 3600000) },
      { id: 'ext-device-3', title: 'Nuevo Evento Único', startDate: deviceDate3, endDate: new Date(deviceDate3.getTime() + 3600000) },
    ],
  });

  const mockEventService = createMockEventService();
  // El evento 1 ya existe en el servidor con el mismo external_id
  mockEventService._events.push({
    id: 'server-1',
    title: 'Taller de Sistemas (modificado local)',
    start_date: deviceDate1.toISOString(),
    end_date: new Date(deviceDate1.getTime() + 3600000).toISOString(),
    external_id: 'ext-device-1',
  });

  // El evento 2 ya existe en el servidor por identidad de título + start_date (sin external_id)
  mockEventService._events.push({
    id: 'server-2',
    title: 'Reunión de Grupo',
    start_date: deviceDate2.toISOString(),
    end_date: new Date(deviceDate2.getTime() + 3600000).toISOString(),
    external_id: null,
  });

  const mod = loadModule('../services/device-calendar.ts', {
    'expo-calendar': mockCalendar,
    '@react-native-async-storage/async-storage': asyncStorage,
    './event': mockEventService,
  });

  const result = await mod.syncDeviceCalendarOnStartup();
  assert.equal(result.synced, true);
  // De los 3 eventos: 1 y 2 eran duplicados (uno por external_id, otro por título/fecha). Solo 1 importado.
  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 2);

  // Verificar que el nuevo evento guardó el external_id del dispositivo
  const newlyCreated = mockEventService._events.find((e) => e.title === 'Nuevo Evento Único');
  assert.ok(newlyCreated);
  assert.equal(newlyCreated.external_id, 'ext-device-3');

  // Segunda ejecución consecutiva no debe importar nada nuevo (0 importados, 3 omitidos)
  const secondResult = await mod.syncDeviceCalendarOnStartup();
  assert.equal(secondResult.imported, 0);
  assert.equal(secondResult.skipped, 3);
});

test('6. Sincronización automática al inicio respeta estrictamente el opt-in', async () => {
  const asyncStorage = createMockAsyncStorage(); // No opt-in configurado
  const mockCalendar = createMockExpoCalendar({
    events: [{ id: 'evt-1', title: 'Clase', startDate: new Date(), endDate: new Date() }],
  });
  const mockEventService = createMockEventService();

  const mod = loadModule('../services/device-calendar.ts', {
    'expo-calendar': mockCalendar,
    '@react-native-async-storage/async-storage': asyncStorage,
    './event': mockEventService,
  });

  // Por defecto está deshabilitado
  const isEnabledInitial = await mod.isAutoSyncEnabled();
  assert.equal(isEnabledInitial, false);

  // Al no estar habilitado, sync no ejecuta nada
  const disabledResult = await mod.syncDeviceCalendarOnStartup();
  assert.equal(disabledResult.synced, false);
  assert.equal(disabledResult.reason, 'Auto-sync opt-in is disabled');
  assert.equal(mockEventService._events.length, 0);

  // El usuario otorga su consentimiento explícito
  await mod.setAutoSyncEnabled(true);
  assert.equal(await mod.isAutoSyncEnabled(), true);

  // Ahora sí se ejecuta la sincronización
  const enabledResult = await mod.syncDeviceCalendarOnStartup();
  assert.equal(enabledResult.synced, true);
  assert.equal(enabledResult.imported, 1);

  // Si el usuario revoca el consentimiento
  await mod.setAutoSyncEnabled(false);
  assert.equal(await mod.isAutoSyncEnabled(), false);

  const revokedResult = await mod.syncDeviceCalendarOnStartup();
  assert.equal(revokedResult.synced, false);
});

test('7. Hook y utilidades de useAppPermissions: explicaciones, status y revocación', async () => {
  let settingsOpened = false;
  const mockLinking = {
    openSettings: async () => { settingsOpened = true; },
  };
  const mockCalendar = {
    getCalendarPermissions: async () => ({ status: 'granted', granted: true, canAskAgain: true }),
    requestCalendarPermissions: async () => ({ status: 'granted', granted: true, canAskAgain: true }),
  };
  const mockNotifications = {
    getPermissionsAsync: async () => ({ status: 'denied', granted: false, canAskAgain: false }),
    requestPermissionsAsync: async () => ({ status: 'granted', granted: true, canAskAgain: true }),
  };

  const mod = loadModule('../hooks/useAppPermissions.ts', {
    'react-native': { Linking: mockLinking, Platform: { OS: 'android' } },
    'react': { useState: (init) => [init, () => {}], useEffect: () => {}, useCallback: (fn) => fn },
    'expo-calendar': mockCalendar,
    'expo-notifications': mockNotifications,
  });

  // Verificar explicaciones contextuales
  assert.ok(mod.PERMISSION_EXPLANATIONS.calendar.includes('calendario'));
  assert.ok(mod.PERMISSION_EXPLANATIONS.notifications.includes('notificaciones'));

  // Verificar verificación de permisos
  const calState = await mod.checkCalendarPermissionState();
  assert.equal(calState.granted, true);
  assert.equal(calState.status, 'granted');

  const notifState = await mod.checkNotificationsPermissionState();
  assert.equal(notifState.granted, false);
  assert.equal(notifState.status, 'denied');

  // Verificar apertura de ajustes para revocación de permisos
  await mod.openSystemSettings();
  assert.equal(settingsOpened, true);
});

test('8. Deep linking: validación de scheme productivityapp y parseo de rutas', () => {
  const mod = loadModule('../hooks/useAppPermissions.ts', {
    'react-native': { Linking: {}, Platform: { OS: 'android' } },
    'react': { useState: () => [], useEffect: () => {}, useCallback: (fn) => fn },
    'expo-calendar': {},
    'expo-notifications': {},
  });

  // Construcción de deep links
  const taskLink = mod.buildDeepLinkUrl('task', 'task-uuid-123');
  assert.equal(taskLink, 'productivityapp://tasks/task-uuid-123');

  const eventLink = mod.buildDeepLinkUrl('event', 'event-uuid-456');
  assert.equal(eventLink, 'productivityapp://events/event-uuid-456');

  // Parseo de deep links
  const parsedTask = mod.parseDeepLinkUrl('productivityapp://tasks/task-uuid-123');
  assert.equal(parsedTask.type, 'task');
  assert.equal(parsedTask.id, 'task-uuid-123');

  const parsedEvent = mod.parseDeepLinkUrl('productivityapp://events/event-uuid-456');
  assert.equal(parsedEvent.type, 'event');
  assert.equal(parsedEvent.id, 'event-uuid-456');

  const parsedUnknown = mod.parseDeepLinkUrl('productivityapp://unknown/123');
  assert.equal(parsedUnknown.type, 'unknown');
});

test('9. Validación de app.json: permisos de Android, plugins y scheme', () => {
  const appJson = JSON.parse(fs.readFileSync(require.resolve('../../app.json'), 'utf8'));
  const expo = appJson.expo;

  // Scheme verificado
  assert.equal(expo.scheme, 'productivityapp');

  // Permisos Android verificados
  assert.ok(Array.isArray(expo.android.permissions));
  assert.ok(expo.android.permissions.includes('READ_CALENDAR'));
  assert.ok(expo.android.permissions.includes('WRITE_CALENDAR'));
  assert.ok(expo.android.permissions.includes('POST_NOTIFICATIONS'));

  // Intent filters configurados para Android deep linking
  assert.ok(Array.isArray(expo.android.intentFilters));
  const filter = expo.android.intentFilters[0];
  assert.equal(filter.action, 'VIEW');
  assert.equal(filter.data[0].scheme, 'productivityapp');

  // Plugins de Expo SDK 57 presentes
  const pluginNames = expo.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
  assert.ok(pluginNames.includes('expo-calendar'));
  assert.ok(pluginNames.includes('expo-notifications'));
});
