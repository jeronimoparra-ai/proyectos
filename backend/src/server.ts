import { app } from './app';
import { env } from './config/env';
import {
  startReminderWorker,
  stopReminderWorker,
} from './modules/reminders/reminder-checker';

// Seguridad extra: el lote en curso debe terminar o expirar antes de
// salir, para que los reintentos en backoff recuperen los avisos pendientes.
const SERVER_SHUTDOWN_GRACE_MS = Number(process.env.SERVER_SHUTDOWN_GRACE_MS ?? '30_000');

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
