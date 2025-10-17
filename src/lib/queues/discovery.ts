import { Queue } from 'bullmq';
import type { JobsOptions, Queue as QueueType } from 'bullmq';
import { getRedisConnectionOptions } from '../redis';

export const DISCOVERY_QUEUE_NAME = 'discovery-jobs';

export interface DiscoveryJobData {
  discoveryId: string;
  hashtag: string;
  limit: number;
  source: string;
  requestedBy?: string;
  metadata?: Record<string, unknown>;
}

let discoveryQueue: QueueType<DiscoveryJobData> | null = null;

export function getDiscoveryQueue(): QueueType<DiscoveryJobData> {
  if (!discoveryQueue) {
    discoveryQueue = new Queue<DiscoveryJobData>(DISCOVERY_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: getDefaultJobOptions(),
    });
  }

  return discoveryQueue;
}

export async function enqueueDiscoveryJob(
  data: DiscoveryJobData,
  options?: JobsOptions,
): Promise<string> {
  const queue = getDiscoveryQueue();
  const job = await queue.add('hashtag-discovery', data, options);
  const jobId = job.id;

  if (!jobId) {
    throw new Error('Failed to determine queue job id');
  }

  return jobId;
}

function getDefaultJobOptions(): JobsOptions {
  return {
    attempts: Number.parseInt(process.env.DISCOVERY_MAX_ATTEMPTS ?? '3', 10),
    backoff: {
      type: 'exponential',
      delay: Number.parseInt(process.env.DISCOVERY_BACKOFF_MS ?? '60000', 10),
    },
    removeOnComplete: false,
    removeOnFail: false,
  };
}
