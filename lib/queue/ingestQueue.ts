import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { ingestPdf, UploadResult, IngestOptions } from '../ingest/ingestService';
import dotenv from 'dotenv';

dotenv.config();

export const INGEST_QUEUE_NAME = 'pdf-ingestion';

export interface IngestJobData {
  fileBufferBase64: string;
  filename: string;
  options?: IngestOptions;
  clientId?: string;
}

import net from 'net';

export function getRedisConnectionOptions() {
  let host = 'localhost';
  let port = 6379;
  let username: string | undefined;
  let password: string | undefined;

  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      host = url.hostname || 'localhost';
      port = parseInt(url.port || '6379', 10);
      username = url.username || undefined;
      password = url.password || undefined;
    } catch {
      // quiet fallback
    }
  } else {
    host = process.env.REDIS_HOST || 'localhost';
    port = parseInt(process.env.REDIS_PORT || '6379', 10);
  }

  // Seamlessly adapt Docker service hostname 'redis' to localhost when running on host machine
  if (host === 'redis' && !process.env.DOCKER_CONTAINER) {
    host = 'localhost';
  }

  return {
    host,
    port,
    username,
    password,
    maxRetriesPerRequest: null,
  };
}

let lastRedisCheckTime = 0;
let lastRedisCheckResult = false;
const REDIS_CHECK_CACHE_MS = 10000; // 10 detik

/**
 * Checks if Redis server is reachable within timeoutMs to avoid blocking in-memory pipelines.
 * Menggunakan cache 10 detik untuk menghindari TCP socket handshake berulang pada request cepat.
 */
export async function isRedisReachable(host: string, port: number, timeoutMs = 300): Promise<boolean> {
  const now = Date.now();
  if (now - lastRedisCheckTime < REDIS_CHECK_CACHE_MS) {
    return lastRedisCheckResult;
  }

  const result = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('error', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    try {
      socket.connect(port, host);
    } catch {
      resolve(false);
    }
  });

  lastRedisCheckTime = Date.now();
  lastRedisCheckResult = result;
  return result;
}


let queueInstance: Queue<IngestJobData, UploadResult> | null = null;
let workerInstance: Worker<IngestJobData, UploadResult> | null = null;
let queueEventsInstance: QueueEvents | null = null;

/**
 * Returns the singleton BullMQ Queue for PDF ingestion jobs.
 */
export function getIngestQueue(): Queue<IngestJobData, UploadResult> {
  if (!queueInstance) {
    const connection = getRedisConnectionOptions();
    queueInstance = new Queue<IngestJobData, UploadResult>(INGEST_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 1, // Hindari auto-retry dokumen raksasa
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    });
  }
  return queueInstance;
}

/**
 * Returns the singleton BullMQ Worker for processing ingestion jobs.
 */
export function getIngestWorker(): Worker<IngestJobData, UploadResult> {
  if (!workerInstance) {
    const connection = getRedisConnectionOptions();
    workerInstance = new Worker<IngestJobData, UploadResult>(
      INGEST_QUEUE_NAME,
      async (job: Job<IngestJobData, UploadResult>) => {
        const { fileBufferBase64, filename, options, clientId } = job.data;
        const fileBuffer = Buffer.from(fileBufferBase64, 'base64');
        return await ingestPdf(fileBuffer, filename, options, clientId);
      },
      {
        connection,
        concurrency: 1,
        lockDuration: 3600000, // 1 jam lock duration untuk dokumen ribuan halaman
        maxStalledCount: 0,
      }
    );

    workerInstance.on('failed', (job, err) => {
      console.error(`[IngestWorker] Job ${job?.id} failed:`, err);
    });
  }
  return workerInstance;
}

/**
 * Returns the QueueEvents instance for awaiting job completion.
 */
export function getIngestQueueEvents(): QueueEvents {
  if (!queueEventsInstance) {
    const connection = getRedisConnectionOptions();
    queueEventsInstance = new QueueEvents(INGEST_QUEUE_NAME, { connection });
  }
  return queueEventsInstance;
}

/**
 * Queues a PDF ingestion job to BullMQ and awaits the completed result.
 *
 * @param fileBuffer - In-memory Buffer of the uploaded PDF
 * @param filename - Name of the PDF file
 * @param options - Optional ingestion options
 * @returns Promise<UploadResult>
 */
export async function queuePdfIngestion(
  fileBuffer: Buffer,
  filename: string,
  options?: IngestOptions,
  clientId?: string
): Promise<UploadResult> {
  const connection = getRedisConnectionOptions();
  const redisUp = await isRedisReachable(connection.host, connection.port, 600);

  if (!redisUp) {
    console.log(
      `[IngestQueue] Redis tidak terhubung pada ${connection.host}:${connection.port}. Menjalankan ingestion langsung secara in-memory (Direct Local Mode)...`
    );
    return await ingestPdf(fileBuffer, filename, options, clientId);
  }

  try {
    const queue = getIngestQueue();
    // Ensure worker is running to process jobs in local server lifecycle
    getIngestWorker();
    const queueEvents = getIngestQueueEvents();

    const job = await queue.add('ingest-pdf', {
      fileBufferBase64: fileBuffer.toString('base64'),
      filename,
      options,
      clientId,
    });

    const result = await job.waitUntilFinished(queueEvents);
    return result;
  } catch (error) {
    console.warn(
      '[IngestQueue] BullMQ queue dispatch encountered an error. Falling back to direct execution:',
      error instanceof Error ? error.message : error
    );
    // Fallback directly to ingestPdf
    return await ingestPdf(fileBuffer, filename, options, clientId);
  }
}

export const queueDocumentIngestion = queuePdfIngestion;

