import { logger } from '../utilities/logger.js';

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Method decorator: retry the method on failure, up to `attempts` total tries.
 * Works for sync and async (promise-returning) methods. `delayMs` (async only)
 * waits between attempts. Re-throws the last error if all attempts fail.
 *
 * @example
 * class Api {
 *   \@Retry(3, { delayMs: 200 })
 *   async fetch() { ... }
 * }
 */
export function Retry(attempts = 3, options: { delayMs?: number } = {}) {
  const total = Math.max(1, attempts);
  const delayMs = options.delayMs ?? 0;

  return function (
    _target: any,
    _methodName: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      let attempt = 0;

      const wait = () =>
        delayMs > 0
          ? new Promise((resolve) => setTimeout(resolve, delayMs))
          : Promise.resolve();

      // One recursive driver handles both sync throws and async rejections,
      // returning synchronously for sync methods and a promise for async ones.
      // Never leaves a floating (unhandled) promise.
      const tryOnce = (): unknown => {
        attempt++;
        try {
          const result = original.apply(this, args);
          if (isPromise(result)) {
            return result.catch((error: unknown) => {
              if (attempt < total) return wait().then(tryOnce);
              throw error;
            });
          }
          return result; // sync success
        } catch (error) {
          if (attempt < total) return tryOnce(); // sync retry (no delay)
          throw error;
        }
      };

      return tryOnce();
    };

    return descriptor;
  };
}

/**
 * Method decorator: memoize results keyed by the JSON of the arguments, per
 * instance. Removes hand-rolled caching maps. Best for pure, cheap-to-key methods.
 *
 * @example
 * class Calc {
 *   \@Memoize
 *   fib(n: number): number { ... }
 * }
 */
export function Memoize(
  _target: any,
  _methodName: string,
  descriptor: PropertyDescriptor,
) {
  const original = descriptor.value;
  const caches = new WeakMap<object, Map<string, unknown>>();

  descriptor.value = function (this: object, ...args: unknown[]) {
    let cache = caches.get(this);
    if (!cache) {
      cache = new Map();
      caches.set(this, cache);
    }
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = original.apply(this, args);
    cache.set(key, result);
    return result;
  };

  return descriptor;
}

/**
 * Method decorator: log a one-time deprecation warning the first time the
 * method is called.
 *
 * @example
 * class Api {
 *   \@Deprecated('Use fetchV2() instead.')
 *   fetch() { ... }
 * }
 */
export function Deprecated(message?: string) {
  return function (
    _target: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;
    let warned = false;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      if (!warned) {
        warned = true;
        logger.warn(
          `DEPRECATED: "${methodName}" is deprecated.${
            message ? ' ' + message : ''
          }`,
        );
      }
      return original.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Method decorator: log how long the method takes. Handles sync and async
 * methods (async is measured to settlement).
 *
 * @example
 * class Job {
 *   \@Measure
 *   run() { ... }
 * }
 */
export function Measure(
  _target: any,
  methodName: string,
  descriptor: PropertyDescriptor,
) {
  const original = descriptor.value;

  descriptor.value = function (this: unknown, ...args: unknown[]) {
    const start = Date.now();
    const log = () => logger.info(`${methodName} took ${Date.now() - start}ms`);
    const result = original.apply(this, args);
    if (isPromise(result)) {
      return result.then(
        (value) => {
          log();
          return value;
        },
        (error) => {
          log();
          throw error;
        },
      );
    }
    log();
    return result;
  };

  return descriptor;
}
