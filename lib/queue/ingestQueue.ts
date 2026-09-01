import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { ingestPdf, UploadResult, IngestOptions } from '../ingest/ingestService';
import dotenv from 'dotenv';

dotenv.config();

export const INGEST_QUEUE_NAME = 'pdf-ingestion';

export interface IngestJobData {
  fileBufferBase64: string;
  filename: string;
  options?: IngestOptions;
}

export function getRedisConnectionOptions() {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '6379', 10),
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };
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
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
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
        const { fileBufferBase64, filename, options } = job.data;
        const fileBuffer = Buffer.from(fileBufferBase64, 'base64');
        return await ingestPdf(fileBuffer, filename, options);
      },
      {
        connection,
        concurrency: 2,
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
  options?: IngestOptions
): Promise<UploadResult> {
  try {
    const queue = getIngestQueue();
    // Ensure worker is running to process jobs in local server lifecycle
    getIngestWorker();
    const queueEvents = getIngestQueueEvents();

    const job = await queue.add('ingest-pdf', {
      fileBufferBase64: fileBuffer.toString('base64'),
      filename,
      options,
    });

    const result = await job.waitUntilFinished(queueEvents);
    return result;
  } catch (error) {
    console.warn(
      '[IngestQueue] BullMQ queue dispatch encountered an error. Falling back to direct execution:',
      error instanceof Error ? error.message : error
    );
    // Fallback directly to ingestPdf
    return await ingestPdf(fileBuffer, filename, options);
  }
}
