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
  createReminderCheckerClient: () => ({ rpc, from }),
  runWithSystemUser: (_userId: string, cb: () => unknown) => cb(),
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
  const final = Promise.resolve({ error: null });
  updateEq.mockReset().mockReturnValue({ eq: vi.fn(() => final) });
  from.mockReturnValue({
    update: vi.fn().mockReturnValue({ eq: updateEq }),
    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { retry_count: 0 }, error: null }) }),
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
    rpc.mockImplementation((name) => Promise.resolve({ data: name === 'renew_reminder_claim' ? true : [dueReminder], error: null }));
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
    rpc.mockImplementation((name) => Promise.resolve({ data: name === 'renew_reminder_claim' ? true : [dueReminder], error: null }));
    sendReminderNotification.mockResolvedValue({
      delivered: false,
      notification: { id: 'notif-1' },
    });

    startReminderWorker();
    await flushTicks();
    await stopReminderWorker(50);

    const builder = from.mock.results[0].value;
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ retry_count: 1, claimed_at: null, locked_by: null }));
    expect(builder.update).not.toHaveBeenCalledWith(expect.objectContaining({ is_sent: true }));
  });

  it('ante un error del envío programa reintento con backoff (retry_count + 1)', async () => {
    rpc.mockImplementation((name) => Promise.resolve({ data: name === 'renew_reminder_claim' ? true : [dueReminder], error: null }));
    sendReminderNotification.mockRejectedValue(new Error('expo caído'));

    startReminderWorker();
    await flushTicks();
    await stopReminderWorker(50);

    expect(rpc).toHaveBeenCalled();
    // Se escribió retry_at / retry_count+1
    expect(from).toHaveBeenCalledWith('reminders');
  });

  it('does not send after another worker takes the lease', async () => {
    rpc.mockImplementation((name) => Promise.resolve({ data: name === 'renew_reminder_claim' ? false : [dueReminder], error: null }));
    startReminderWorker();
    await flushTicks();
    await stopReminderWorker(50);
    expect(sendReminderNotification).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
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
