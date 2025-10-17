import type { RedisOptions } from 'ioredis';

export type BullRedisConnection = RedisOptions & {
  connectionString?: string;
};

let cachedConnection: BullRedisConnection | null = null;

export function getRedisConnectionOptions(): BullRedisConnection {
  if (cachedConnection) {
    return cachedConnection;
  }

  const url = process.env.REDIS_URL;

  if (url) {
    cachedConnection = {
      connectionString: url,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
    return cachedConnection;
  }

  const host = process.env.REDIS_HOST ?? '127.0.0.1';
  const port = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  const useTls = process.env.REDIS_TLS === 'true';

  cachedConnection = {
    host,
    port,
    username,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(useTls ? { tls: {} } : {}),
  };

  return cachedConnection;
}
