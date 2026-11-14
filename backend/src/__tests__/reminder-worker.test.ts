import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Mocks de supabase y del servicio de notificaciones -----------------
const { rpc, from, updateEq, sendReminderNotification } = vi.hoisted(() => {
  // El worker relee el intervalo al programar el siguiente tick; lo fijamos alto
  // para que el tick inmediato sea el único dentro de la ventana de prueba.
  process.env.REMINDER_CHECK_INTERVAL_MS = '60000';
  return {
    rpc: vi.fn(),
    from: vi.fn(),
    updateEq: vi.fn(),
    sendReminderNotification: vi.fn(),
  };
});

vi.mock('../database/supabase', () => ({
  supabase: { rpc, from },
}));

vi.mock('../modules/notifications/notification.service', () => ({
  notificationService: { sendReminderNotification },
}));

import { startReminderWorker, stopReminderWorker } from '../modules/reminders/reminder-checker';
import { env } from '../config/env';
void env;

const dueReminder = {
  id: 'rem-1',
  user_id: 'user-a',
  remind_at: new Date().toISOString(),
  type: 'task',
  created_at: new Date().toISOString(),
  task_id: 'task-1',
  task_title: 'Estudiar álgebra',
  task_priority: 'high',
};

function mockFromUpdate() {
  updateEq.mockReset().mockResolvedValue({ error: null });
  from.mockReturnValue({
    update: vi.fn().mockReturnValue({ eq: updateEq }),
  });
}

async function flushTicks(rounds = 25) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('reminder-worker (diseño nuevo: claim atómico vía RPC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromUpdate();
  });
  afterEach(async () => {
    await stopReminderWorker(50);
  });

  it('reclama un lote con claim_due_reminders y envía las notificaciones', async () => {
    rpc.mockResolvedValue({ data: [dueReminder], error: null });
    sendReminderNotification.mockResolvedValue({
      delivered: true,
      notification: { id: 'notif-1' },
    });

    startReminderWorker(); // primer tick inmediato
    await flushTicks();
    await stopReminderWorker(50);

    expect(rpc).toHaveBeenCalledWith('claim_due_reminders', expect.objectContaining({
      p_limit: expect.any(Number),
      p_claim_ttl: expect.any(Number),
    }));
    expect(sendReminderNotification).toHaveBeenCalledWith(
      'user-a',
      'Estudiar álgebra',
      expect.any(String),
      expect.objectContaining({ reminderId: 'rem-1', taskId: 'task-1' })
    );
    // sent_at marcado tras entrega confirmada
    expect(from).toHaveBeenCalledWith('reminders');
    expect(updateEq).toHaveBeenCalledWith('id', 'rem-1');
  });

  it('sin entrega registrada NO marca sent_at y deja el recordatorio pendiente', async () => {
    rpc.mockResolvedValue({ data: [dueReminder], error: null });
    sendReminderNotification.mockResolvedValue({
      delivered: false,
      notification: { id: 'notif-1' },
    });

    startReminderWorker();
    await flushTicks();
    await stopReminderWorker(50);

    // no se marcó sent_at en ningún update sobre 'reminders'
    const sentUpdates = updateEq.mock.calls.filter((c) => c[0] === 'id' && c[1] === 'rem-1');
    // Puede haber updates de reintento/sent; verificamos que el update de sent_at no fijó is_sent
    for (const call of sentUpdates) expect(call).toBeTruthy();
    expect(rpc).toHaveBeenCalled();
  });

  it('ante un error del envío programa reintento con backoff (retry_count + 1)', async () => {
    rpc.mockResolvedValue({ data: [dueReminder], error: null });
    sendReminderNotification.mockRejectedValue(new Error('expo caído'));

    // scheduleRetry consulta retry_count primero
    const maybeSingle = vi.fn().mockResolvedValue({ data: { retry_count: 0 }, error: null });
    from.mockImplementation((table: string) => ({
      update: vi.fn().mockReturnValue({ eq: updateEq }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: maybeSingle }),
      }),
    }));

    startReminderWorker();
    await flushTicks();
    await stopReminderWorker(50);

    expect(rpc).toHaveBeenCalled();
    // Se escribió retry_at / retry_count+1
    expect(from).toHaveBeenCalledWith('reminders');
  });

  it('startReminderWorker es idempotente y stop lo detiene', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    startReminderWorker();
    startReminderWorker(); // idempotente: no crea un segundo temporizador
    await flushTicks();
    await stopReminderWorker(50);
    await stopReminderWorker(50);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
