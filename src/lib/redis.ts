import type { RedisOptions } from 'ioredis';
import { URL } from 'url';

export type RedisConnectionOptions = RedisOptions;

let cachedConnection: RedisConnectionOptions | null = null;

export function getRedisConnectionOptions(): RedisConnectionOptions {
  if (cachedConnection) {
    return cachedConnection;
  }

  const url = process.env.REDIS_URL;

  if (url) {
    console.log('✅ [Frontend] Using REDIS_URL for Redis connection');
    const redisUrl = new URL(url);

    // Upstash-specific configuration for serverless environments
    cachedConnection = {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || '6379'),
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: Number.parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS ?? '30000', 10),
      keepAlive: Number.parseInt(process.env.REDIS_KEEP_ALIVE_MS ?? '30000', 10),
      retryStrategy: (times) => {
        // More aggressive retry for serverless
        if (times > 10) return null; // Stop retrying after 10 attempts
        return Math.min(times * 200, 2000);
      },
      reconnectOnError: (error) => {
        const message = error?.message ?? '';
        if (message.includes('READONLY') || message.includes('ECONNRESET') || message.includes('EPIPE')) {
          console.log('🔁 [Frontend] Redis connection error detected, reconnecting...', message);
          return true;
        }
        return false;
      },
      enableOfflineQueue: false,
      lazyConnect: true, // Important for serverless
      autoResubscribe: false,
      autoResendUnfulfilledCommands: false,
    };

    if (redisUrl.protocol === 'rediss:') {
      console.log('   🔒 [Frontend] TLS enabled for Redis connection.');
      const rejectUnauthorized =
        process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'true' ||
        process.env.REDIS_TLS_REJECT_UNAUTHORIZED === undefined;
      cachedConnection.tls = {
        rejectUnauthorized,
      };
    }

    return cachedConnection;
  }

  console.warn('⚠️ [Frontend] REDIS_URL not found. Falling back to individual REDIS_* variables.');
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
    connectTimeout: Number.parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS ?? '30000', 10),
    keepAlive: Number.parseInt(process.env.REDIS_KEEP_ALIVE_MS ?? '30000', 10),
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 200, 2000);
    },
    reconnectOnError: (error) => {
      const message = error?.message ?? '';
      if (message.includes('READONLY') || message.includes('ECONNRESET') || message.includes('EPIPE')) {
        console.log('🔁 [Frontend] Redis connection error detected, reconnecting...', message);
        return true;
      }
      return false;
    },
    enableOfflineQueue: false,
    lazyConnect: true,
    autoResubscribe: false,
    autoResendUnfulfilledCommands: false,
    ...(useTls ? { tls: {} } : {}),
  };

  return cachedConnection;
}
