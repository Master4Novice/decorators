import winston from 'winston';
import { getSecretKeys } from '../services/injection.js';

/**
 * Common sensitive field names redacted by default, in addition to any
 * properties marked with `@Secret`. Matching is case-insensitive and ignores
 * `_`/`-` separators (so `apiKey`, `api_key`, `API-KEY` all match `apikey`).
 */
export const DEFAULT_SENSITIVE_KEYS: readonly string[] = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'authorization',
  'auth',
  'jwt',
  'session',
  'sessionid',
  'privatekey',
  'clientsecret',
  'otp',
  'pin',
  'creditcard',
  'card',
  'cvv',
  'ssn',
  'aadhaar',
  'pan',
];

export interface RedactOptions {
  /** Extra sensitive key names to redact (case/separator-insensitive). */
  keys?: string[];
  /** Replacement for redacted values. Default `'[REDACTED]'`. */
  mask?: string;
  /** Max recursion depth; deeper values are replaced with `'[Truncated]'`
   * (never passed through raw, so deep secrets can't leak). Default 12. */
  maxDepth?: number;
}

const normalize = (key: string): string =>
  key.toLowerCase().replace(/[_-]/g, '');

function buildKeySet(extra?: string[]): Set<string> {
  const set = new Set<string>();
  for (const k of DEFAULT_SENSITIVE_KEYS) set.add(normalize(k));
  for (const k of getSecretKeys()) set.add(normalize(k)); // @Secret-marked fields
  if (extra) for (const k of extra) set.add(normalize(k));
  return set;
}

/** True when a property name should be redacted, per the combined key set. */
export function isSensitiveKey(key: string, keySet: Set<string>): boolean {
  return keySet.has(normalize(key));
}

/**
 * Return a deep copy of `value` with the values of sensitive keys replaced by a
 * mask. Sensitive keys = `@Secret`-marked property names ∪ {@link
 * DEFAULT_SENSITIVE_KEYS} ∪ `options.keys`. Handles nested objects/arrays and
 * circular references; passes `Date`/`RegExp` and primitives through.
 *
 * @example
 * logger.info('config', redact(appConfig)); // password/jwtSecret -> [REDACTED]
 */
export function redact<T>(value: T, options: RedactOptions = {}): T {
  const keySet = buildKeySet(options.keys);
  const mask = options.mask ?? '[REDACTED]';
  const maxDepth = options.maxDepth ?? 12;
  const seen = new WeakSet<object>();

  const walk = (val: unknown, depth: number): unknown => {
    if (val === null || typeof val !== 'object') return val;
    if (val instanceof Date || val instanceof RegExp) return val;
    if (seen.has(val)) return '[Circular]';
    // Beyond max depth, TRUNCATE rather than return the raw value — otherwise a
    // secret nested deeper than maxDepth would leak through unmasked.
    if (depth >= maxDepth) return '[Truncated]';
    seen.add(val);

    if (Array.isArray(val)) return val.map((item) => walk(item, depth + 1));
    if (val instanceof Set) return [...val].map((item) => walk(item, depth + 1));
    if (val instanceof Map) {
      const fromMap: Record<string, unknown> = {};
      for (const [k, v] of val) {
        const key = String(k);
        fromMap[key] = isSensitiveKey(key, keySet) ? mask : walk(v, depth + 1);
      }
      return fromMap;
    }

    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(val)) {
      out[key] = isSensitiveKey(key, keySet) ? mask : walk(child, depth + 1);
    }
    return out;
  };

  return walk(value, 0) as T;
}

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
 * A winston format that redacts sensitive fields from log metadata. Add it to
 * your logger's `format.combine(...)` so structured fields like `password` or
 * any `@Secret` property never reach your transports in clear text.
 *
 * The package's own logger already uses this.
 *
 * @example
 * winston.createLogger({ format: winston.format.combine(redactFormat(), ...) });
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
