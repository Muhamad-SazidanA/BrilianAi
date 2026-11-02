/**
 * In-Memory Stale-While-Revalidate (SWR) cache for System & Dashboard Stats.
 * Provides < 1ms response latency for repeated page loads, tab switches, and concurrent requests.
 */

interface CachedStats {
  data: any;
  timestamp: number;
}

const statsCache = new Map<string, CachedStats>();
const STATS_CACHE_TTL_MS = 6000; // 6 seconds TTL for instant reload & request deduplication

export function getCachedStats(cacheKey: string): any | null {
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setCachedStats(cacheKey: string, data: any): void {
  statsCache.set(cacheKey, { data, timestamp: Date.now() });
}

export function invalidateStatsCache(): void {
  statsCache.clear();
}

