import os from 'os';
import { redact } from './redact.js';

/**
 * The package's internal logger. Intentionally **zero-dependency**: it writes
 * structured lines to the console so that simply importing `@master4n/decorators`
 * pulls in no logging framework. Consumers who want winston/pino can ignore this
 * and pass their own logger to the decorators that accept one (e.g. `@Log`).
 *
 * For a winston `format` that redacts secrets, see the optional `@master4n/decorators/winston`
 * subpath (requires winston as a peer dependency).
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LABEL = 'Master4Novice';

// Default threshold matches winston's historical default ('info'), so `debug`
// is suppressed unless explicitly enabled. Override via DECORATORS_LOG_LEVEL.
function thresholdWeight(): number {
  const raw = (process.env.DECORATORS_LOG_LEVEL ?? 'info').toLowerCase();
  const lvl = (raw in LEVEL_WEIGHT ? raw : 'info') as LogLevel;
  return LEVEL_WEIGHT[lvl];
}

const HOST = typeof os.hostname === 'function' ? os.hostname() : 'unknown';

function emit(level: LogLevel, message: unknown, meta?: unknown): void {
  if (LEVEL_WEIGHT[level] > thresholdWeight()) return;

  const env = process.env.NODE_ENV ? process.env.NODE_ENV : 'local';
  const line = `${new Date().toISOString()} [${LABEL}] ${level}: ${String(message)}`;

  // Any structured metadata is redacted before it can reach the console, so a
  // stray `password`/`@Secret` field never leaks through the default logger.
  const safeMeta =
    meta !== undefined ? redact({ host: HOST, env, ...(meta as object) }) : undefined;

  const sink =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'debug'
          ? console.debug
          : console.log;

  if (safeMeta !== undefined) {
    sink(line, safeMeta);
  } else {
    sink(line);
  }
}

export const logger = {
  error: (message: unknown, meta?: unknown) => emit('error', message, meta),
  warn: (message: unknown, meta?: unknown) => emit('warn', message, meta),
  info: (message: unknown, meta?: unknown) => emit('info', message, meta),
  debug: (message: unknown, meta?: unknown) => emit('debug', message, meta),
};
