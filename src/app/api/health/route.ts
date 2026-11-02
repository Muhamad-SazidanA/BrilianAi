import { NextResponse } from 'next/server';
import { getPool } from '@lib/db/dbClient';
import { getRedisConnectionOptions } from '@lib/queue/ingestQueue';
import net from 'net';

export const dynamic = 'force-dynamic';

function checkRedisSocket(timeoutMs = 1500): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const opts = getRedisConnectionOptions();
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({ ok: true, latencyMs });
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve({ ok: false, latencyMs: Date.now() - start, error: 'Redis connection timeout' });
    });

    socket.once('error', (err) => {
      socket.destroy();
      resolve({ ok: false, latencyMs: Date.now() - start, error: err.message });
    });

    socket.connect(opts.port, opts.host);
  });
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.floor(process.uptime());
  const memory = process.memoryUsage();

  interface ServiceHealth {
    ok: boolean;
    latencyMs: number;
    error?: string;
  }

  // 1. Check PostgreSQL Database
  let dbStatus: ServiceHealth = { ok: false, latencyMs: 0 };
  const dbStart = Date.now();
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    dbStatus = {
      ok: true,
      latencyMs: Date.now() - dbStart,
    };
  } catch (err: any) {
    dbStatus = {
      ok: false,
      latencyMs: Date.now() - dbStart,
      error: err?.message || 'Database query failed',
    };
  }

  // 2. Check Redis / BullMQ Ingestion Queue
  let redisStatus: ServiceHealth = { ok: false, latencyMs: 0 };
  try {
    redisStatus = await checkRedisSocket();
  } catch (err: any) {
    redisStatus = {
      ok: false,
      latencyMs: 0,
      error: err?.message || 'Redis check exception',
    };
  }

  // Determine overall system health
  // PostgreSQL is required (P0). Redis is required for queue mode, but app has sync fallback.
  const isHealthy = dbStatus.ok;
  const status = isHealthy ? (redisStatus.ok ? 'healthy' : 'degraded') : 'unhealthy';

  const responsePayload = {
    status,
    timestamp,
    version: process.env.npm_package_version || '1.0.0',
    uptimeSeconds,
    services: {
      database: {
        status: dbStatus.ok ? 'up' : 'down',
        latencyMs: dbStatus.latencyMs,
        ...(dbStatus.error ? { error: dbStatus.error } : {}),
      },
      redisQueue: {
        status: redisStatus.ok ? 'up' : 'down',
        latencyMs: redisStatus.latencyMs,
        ...(redisStatus.error ? { error: redisStatus.error } : {}),
      },
    },
    system: {
      nodeVersion: process.version,
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
    },
  };

  return NextResponse.json(responsePayload, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
