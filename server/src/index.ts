import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { checkDatabase, closePool } from './db/pool';
import { initRealtime, realtimeStatus } from './realtime/realtime';

const app = createApp();
const server = createServer(app);
initRealtime(server);

server.listen(env.port, '0.0.0.0', () => {
  console.log(`[api] ${env.serviceName} v${env.version} listening on http://0.0.0.0:${env.port}`);
  console.log(
    `[realtime] Socket.IO ${realtimeStatus().enabled ? 'enabled' : 'disabled'} on /socket.io (session cookie required)`,
  );
  console.log(`[api] environment: ${env.nodeEnv} | client origin: ${env.clientOrigin}`);
  console.log(
    `[auth] cookie "${env.cookieName}" | session ${env.sessionHours}h | JWT ${
      process.env.JWT_SECRET ? 'secret loaded' : 'development fallback secret'
    }`,
  );
});

void checkDatabase().then((status) => {
  console.log(`[db] configured=${status.configured} connected=${status.connected} - ${status.message}`);
});

const shutdown = (signal: string) => {
  console.log(`[api] ${signal} received, shutting down`);
  server.close(() => {
    void closePool().finally(() => process.exit(0));
  });
  // Do not hang forever on lingering keep-alive connections.
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandled rejection:', reason);
});
