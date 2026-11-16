import { app } from './app';
import { env } from './config/env';
import {
  startReminderWorker,
  stopReminderWorker,
} from './modules/reminders/reminder-checker';

// Seguridad extra: el lote en curso debe terminar o expirar antes de
// salir, para que los reintentos en backoff recuperen los avisos pendientes.
// Defaults seguros: acepta valores con guiones bajos como separadores de miles.
function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const cleaned = raw.replace(/_/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

const SERVER_SHUTDOWN_GRACE_MS = numEnv('SERVER_SHUTDOWN_GRACE_MS', 30000);

const server = app.listen(env.port, () => {
  console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  // Arranque explícito del trabajador: importar app.ts no lanza workers.
  startReminderWorker();
});

// Parada ordenada (SIGTERM/SIGINT): dejar de reservar, esperar el lote en
// curso con timeout, y cerrar clientes.
function shutdown(signal: string): void {
  console.log(`${signal} recibido. Deteniendo trabajador de recordatorios...`);
  stopReminderWorker(SERVER_SHUTDOWN_GRACE_MS).then(() => {
    server.close(() => {
      console.log('Servidor HTTP cerrado. Saliendo.');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
