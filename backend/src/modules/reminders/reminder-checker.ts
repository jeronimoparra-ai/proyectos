import { createReminderCheckerClient, runWithSystemUser } from '../../database/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { notificationService } from '../notifications/notification.service';
import type { TokenResult } from '../notifications/notification.service';

// Solo el worker interno puede usar este cliente con service_role (sin contexto de petición).
// Lazy: se crea en el arranque del worker, nunca al importar el módulo.
let checkerClient: SupabaseClient | null = null;
function getCheckerClient(): SupabaseClient {
  if (!checkerClient) {
    checkerClient = createReminderCheckerClient();
  }
  return checkerClient;
}

// ---------------------------------------------------------------------------
// Configuración del trabajador de recordatorios (todo por variable de
// entorno; no hay secretos hardcodados). Valores por defecto.
// ---------------------------------------------------------------------------
// Defaults seguros: acepta valores con guiones bajos como separadores de miles
// (p.ej. '60_000') o números normales; nunca devuelve NaN.
function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const cleaned = raw.replace(/_/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

const CHECK_INTERVAL_MS = numEnv('REMINDER_CHECK_INTERVAL_MS', 60000);
const BATCH_SIZE = numEnv('REMINDER_BATCH_SIZE', 25);
const CLAIM_TTL_SECONDS = numEnv('REMINDER_CLAIM_TTL_SECONDS', 300);
const RETRY_BASE_DELAY_MS = numEnv('REMINDER_RETRY_BASE_DELAY_MS', 5000);
const RETRY_MAX_DELAY_MS = numEnv('REMINDER_RETRY_MAX_DELAY_MS', 300000);
const SHUTDOWN_GRACE_MS = numEnv('REMINDER_SHUTDOWN_GRACE_MS', 30000);

// Límite hard de reintentos para evitar bucles infinitos ante fallos que no
// se recuperan. Se aplica por recordatorio.
const MAX_RETRY_ATTEMPTS = 20;

const WORKER_ID = `worker-${process.pid}-${Date.now().toString(36)}`;

// ---------------------------------------------------------------
// Tipos internos.
// ---------------------------------------------------------------
interface ClaimedReminder {
  id: string;
  user_id: string;
  remind_at: string;
  type: string;
  created_at: string;
  task_id: string | null;
  task_title: string;
  task_priority: string | null;
}


// ---------------------------------------------------------------
// Lifecycle: arranque y parada ordenada del trabajador.
//
// Se separa de la importación de Express (ver app.ts): importar app.ts no
// lanza ningún worker. El worker se arranca explícitamente desde
// server.ts y se detiene por SIGTERM/SIGINT.
// ---------------------------------------------------------------
let intervalId: NodeJS.Timeout | null = null;
let batchCount = 0; // lotes en vuelo (para la parada ordenada).
let isStopping = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Arranca el trabajador. Idempotente. No bloquea: el primer lote se
 * planifica via setTimeout y el siguiente se planifica al finalizar el
 * presente (sin superponerse).
 */
export function startReminderWorker(): void {
  if (intervalId !== null) return;
  isStopping = false;

  const tick = async (): Promise<void> => {
    if (isStopping) return;
    try {
      await runBatch();
    } catch (err) {
      console.error('Error en el lote de recordatorios:', err);
    } finally {
      batchCount = Math.max(0, batchCount - 1);
      if (!isStopping) {
        intervalId = setTimeout(tick, CHECK_INTERVAL_MS);
      }
    }
  };

  intervalId = setTimeout(tick, 0);
}

/**
 * Parada ordenada (SIGTERM/SIGINT):
 *   1. dejar de reservar (limpiar el temporizador),
 *   2. esperar el lote en curso con timeout (graceMs),
 *   3. cerrar clientes (el cliente Supabase es compartido y no expone
 *      close(); se liberan los timers del worker y el proceso sale vía
 *      server.close() del gestor de señales).
 */
export async function stopReminderWorker(graceMs: number = SHUTDOWN_GRACE_MS): Promise<void> {
  if (isStopping) return Promise.resolve();
  isStopping = true;
  if (intervalId !== null) {
    clearTimeout(intervalId);
    intervalId = null;
  }
  const deadline = Date.now() + graceMs;
  while (batchCount > 0 && Date.now() < deadline) {
    await sleep(100);
  }
  console.log('Trabajador de recordatorios detenido.');
}

// ---------------------------------------------------------------
// Lógica del lote: reserva atómica + ENVÍO.
// ---------------------------------------------------------------
async function runBatch(): Promise<void> {
  batchCount += 1;
  try {
    const due = await claimDueReminders();
    for (const reminder of due) {
      await processReminder(reminder);
    }
  } finally {
    batchCount -= 1;
  }
}

/**
 * Reserva atómica y determinista un lote de recordatorios pendientes.
 * La reserva es una sola sentencia UPDATE ... RETURNING del DB, por lo que
 * no puede haber una reserva simultánea por dos trabajadores.
 */
async function claimDueReminders(): Promise<ClaimedReminder[]> {
  const { data, error } = await getCheckerClient().rpc('claim_due_reminders', {
    p_locked_by: WORKER_ID,
    p_limit: BATCH_SIZE,
    p_claim_ttl: CLAIM_TTL_SECONDS,
  });
  if (error) {
    console.error('Error RPC claim_due_reminders:', error.message);
    return [];
  }
  return (data ?? []) as ClaimedReminder[];
}

async function processReminder(reminder: ClaimedReminder): Promise<void> {
  const taskTitle = reminder.task_title ?? 'Tarea sin título';
  const data = {
    reminderId: reminder.id,
    taskId: reminder.task_id,
    priority: reminder.task_priority,
  };

  try {
    // 1) CREACIÓN del aviso interno: se inscribe la nota en la base de
    //    datos antes de llamar a Expo. El trabajo interno va acotado al
    //    destinatario (runWithSystemUser); nunca a un service_role abierto.
    const result = await runWithSystemUser(reminder.user_id, () =>
      notificationService.sendReminderNotification(
        reminder.user_id,
        taskTitle,
        reminder.remind_at,
        data
      )
    ) as { notification: { id: string } | null; tokenResults: TokenResult[]; delivered: boolean };

    // 2) Si la entrega se registró sobre el aviso, marcar el recordatorio
    //    como sent (no volverá a ser reclamado).
    if (result.delivered && result.notification?.id) {
      await markReminderSent(reminder.id);
    } else if (result.notification?.id) {
      // El aviso interno existe pero la entrega no se registró: el backoff
      // de abajo lo reintenta; no marcar sent_at para conservar el retento.
      console.warn(
        `Recordatorio ${reminder.id} creado pero entrega sin registrar (delivered=${result.delivered}).`
      );
    }
  } catch (err) {
    // 3) REINTENTO con backoff exponencial. El recordatorio reingresa a
    //    la lista de disponibles cuando caduque la reclamación
    //    (retry_at <= now) tras claim_due_reminders.
    await scheduleRetry(reminder.id, err);
  }
}

async function markReminderSent(reminderId: string): Promise<void> {
  await getCheckerClient()
    .from('reminders')
    .update({ is_sent: true, sent_at: new Date().toISOString() })
    .eq('id', reminderId);
}

async function scheduleRetry(reminderId: string, error: unknown): Promise<void> {
  const { data, error: qErr } = await getCheckerClient()
    .from('reminders')
    .select('retry_count')
    .eq('id', reminderId)
    .single();
  if (qErr) {
    console.error(`No se pudo consultar retry_count del recordatorio ${reminderId}:`, qErr);
    return;
  }
  const retryCount = (data as { retry_count: number } | null)?.retry_count ?? 0;
  if (retryCount >= MAX_RETRY_ATTEMPTS) {
    console.error(
      `Recordatorio ${reminderId} agotó ${MAX_RETRY_ATTEMPTS} reintentos. Abandonando hasta reinicio.`
    );
    return;
  }
  const delay = Math.min(
    RETRY_MAX_DELAY_MS,
    RETRY_BASE_DELAY_MS * 2 ** retryCount
  );
  await getCheckerClient()
    .from('reminders')
    .update({
      retry_at: new Date(Date.now() + delay).toISOString(),
      retry_count: retryCount + 1,
    })
    .eq('id', reminderId);
  console.error(
    `Recordatorio ${reminderId} fallido (intento ${retryCount + 1}/${MAX_RETRY_ATTEMPTS}). Reintento en ${delay} ms: ${error}`
  );
}
