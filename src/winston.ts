/**
 * Optional winston integration for `@master4n/decorators`.
 *
 * Import from `@master4n/decorators/winston`. This module is the **only** place
 * that imports winston, which is declared as an optional peer dependency — the
 * main `@master4n/decorators` entry point pulls in no logging framework at all.
 *
 * @example
 * import winston from 'winston';
 * import { redactFormat } from '@master4n/decorators/winston';
 *
 * const logger = winston.createLogger({
 *   format: winston.format.combine(redactFormat(), winston.format.json()),
 *   transports: [new winston.transports.Console()],
 * });
 */
import winston from 'winston';
import {
  redact,
  buildKeySet,
  isSensitiveKey,
  type RedactOptions,
} from './utilities/redact.js';

// Standard winston log-entry keys that must not be treated as redactable meta.
const RESERVED_LOG_KEYS = new Set([
  'level',
  'message',
  'timestamp',
  'label',
  'stack',
  'splat',
]);

/**
 * A winston `format` that redacts sensitive fields from log metadata. Add it to
 * your logger's `format.combine(...)` so structured fields like `password` or
 * any `@Secret`-marked property never reach your transports in clear text.
 *
 * Sensitive keys = `@Secret`-marked property names ∪ the built-in
 * {@link DEFAULT_SENSITIVE_KEYS} ∪ `options.keys`.
 */
export function redactFormat(options: RedactOptions = {}) {
  return winston.format((info) => {
    const keySet = buildKeySet(options.keys);
    const mask = options.mask ?? '[REDACTED]';
    for (const key of Object.keys(info)) {
      if (RESERVED_LOG_KEYS.has(key)) continue;
      const entry = info as Record<string, unknown>;
      entry[key] = isSensitiveKey(key, keySet)
        ? mask
        : redact(entry[key], options);
    }
    return info;
  })();
}
