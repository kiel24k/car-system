import { createApp } from './app';
import { config } from './config';
import { pool } from './db';

const app = createApp();

const server = app.listen(config.port, (error?: Error) => {
  if (error) {
    console.error(`Failed to start server on port ${config.port}: ${error.message}`);
    void pool.end().finally(() => process.exit(1));
    return;
  }
  console.log(`Car Shop API listening on http://localhost:${config.port}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
