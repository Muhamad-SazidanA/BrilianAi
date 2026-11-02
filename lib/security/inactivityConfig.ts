/**
 * Inactivity Timeout Configuration & Helper Utilities
 *
 * Implements enterprise idle session detection:
 * - Default idle timeout: 30 minutes (1800000 ms)
 * - Default warning window: 2 minutes (120000 ms)
 *
 * Configurable via NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS and NEXT_PUBLIC_INACTIVITY_WARNING_MS.
 */

export const DEFAULT_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_INACTIVITY_WARNING_MS = 2 * 60 * 1000;  // 2 minutes

export interface InactivityConfig {
  timeoutMs: number;
  warningMs: number;
}

export interface InactivityState {
  isTimedOut: boolean;
  isWarning: boolean;
  remainingMs: number;
  remainingSeconds: number;
}

/**
 * Resolves inactivity timeout and warning window configuration from environment or defaults.
 */
export function getInactivityConfig(): InactivityConfig {
  const envTimeout = process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS
    ? parseInt(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS, 10)
    : NaN;

  const envWarning = process.env.NEXT_PUBLIC_INACTIVITY_WARNING_MS
    ? parseInt(process.env.NEXT_PUBLIC_INACTIVITY_WARNING_MS, 10)
    : NaN;

  const timeoutMs = !isNaN(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_INACTIVITY_TIMEOUT_MS;
  const warningMs = !isNaN(envWarning) && envWarning > 0 ? envWarning : DEFAULT_INACTIVITY_WARNING_MS;

  return {
    timeoutMs,
    warningMs: Math.min(warningMs, timeoutMs),
  };
}

/**
 * Calculates current inactivity status given the last activity timestamp and current time.
 */
export function calculateInactivityState(
  lastActivity: number,
  now: number = Date.now(),
  config?: Partial<InactivityConfig>
): InactivityState {
  const resolved = {
    ...getInactivityConfig(),
    ...config,
  };

  const elapsed = Math.max(0, now - lastActivity);
  const remainingMs = Math.max(0, resolved.timeoutMs - elapsed);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  const isTimedOut = remainingMs <= 0;
  const isWarning = !isTimedOut && remainingMs <= resolved.warningMs;

  return {
    isTimedOut,
    isWarning,
    remainingMs,
    remainingSeconds,
  };
}

/**
 * Format remaining seconds into MM:SS display format.
 */
export function formatInactivityCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

