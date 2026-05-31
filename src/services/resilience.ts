import {
  TimeoutError,
  RateLimitError,
  CircuitOpenError,
} from './errors.js';

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

type MethodDecorator = (
  target: any,
  methodName: string,
  descriptor: PropertyDescriptor,
) => PropertyDescriptor;

/** Helper that wraps a method's implementation, preserving the descriptor. */
function wrap(
  descriptor: PropertyDescriptor,
  make: (
    original: (...args: any[]) => any,
    methodName: string,
  ) => (this: any, ...args: any[]) => unknown,
  methodName: string,
): PropertyDescriptor {
  descriptor.value = make(descriptor.value, methodName);
  return descriptor;
}

/**
 * Reject an **async** method if it doesn't settle within `ms`. Returns a
 * `Promise` that rejects with {@link TimeoutError}. Synchronous methods can't be
 * interrupted in JS, so this only applies to promise-returning methods.
 *
 * @example
 * class Api {
 *   \@Timeout(5000)
 *   async fetch() { ... } // rejects with TimeoutError after 5s
 * }
 */
export function Timeout(ms: number, options: { message?: string } = {}): MethodDecorator {
  return (_t, methodName, descriptor) =>
    wrap(
      descriptor,
      (original) =>
        function (this: unknown, ...args: any[]) {
          const result = original.apply(this, args);
          if (!isPromise(result)) return result; // sync: cannot time out
          let timer: ReturnType<typeof setTimeout>;
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new TimeoutError(
                    options.message ?? `${methodName} timed out after ${ms}ms`,
                  ),
                ),
              ms,
            );
          });
          return Promise.race([
            result.finally(() => clearTimeout(timer)),
            timeout,
          ]);
        },
      methodName,
    );
}

/**
 * Run the method at most once per instance; cache and return that first result
 * forever. (Unlike `@Memoize`, arguments are ignored — a single slot.)
 */
export function Once(
  _t: any,
  methodName: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const slots = new WeakMap<object, { value: unknown }>();
  return wrap(
    descriptor,
    (original) =>
      function (this: object, ...args: any[]) {
        let slot = slots.get(this);
        if (!slot) {
          slot = { value: original.apply(this, args) };
          slots.set(this, slot);
        }
        return slot.value;
      },
    methodName,
  );
}

/**
 * Memoize results with a time-to-live, per instance, keyed by the JSON of the
 * arguments. (Use `@Memoize` for a permanent cache; `@Cache(ttl)` expires.)
 */
export function Cache(ttlMs: number): MethodDecorator {
  return (_t, methodName, descriptor) => {
    const caches = new WeakMap<object, Map<string, { value: unknown; expires: number }>>();
    return wrap(
      descriptor,
      (original) =>
        function (this: object, ...args: any[]) {
          let cache = caches.get(this);
          if (!cache) {
            cache = new Map();
            caches.set(this, cache);
          }
          const key = JSON.stringify(args);
          const hit = cache.get(key);
          if (hit && hit.expires > Date.now()) return hit.value;
          const value = original.apply(this, args);
          cache.set(key, { value, expires: Date.now() + ttlMs });
          return value;
        },
      methodName,
    );
  };
}

/**
 * Coalesce concurrent identical async calls (single-flight). While a call with
 * the same arguments is in flight, callers share the same promise instead of
 * starting another. Great for de-duplicating bursts of identical requests.
 */
export function Dedupe(
  _t: any,
  methodName: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const inflight = new WeakMap<object, Map<string, Promise<unknown>>>();
  return wrap(
    descriptor,
    (original) =>
      function (this: object, ...args: any[]) {
        let byKey = inflight.get(this);
        if (!byKey) {
          byKey = new Map();
          inflight.set(this, byKey);
        }
        const key = JSON.stringify(args);
        const existing = byKey.get(key);
        if (existing) return existing;
        const result = original.apply(this, args);
        if (!isPromise(result)) return result; // only async calls dedupe
        const tracked = result.finally(() => byKey!.delete(key));
        byKey.set(key, tracked);
        return tracked;
      },
    methodName,
  );
}

/**
 * On error, return a fallback instead of throwing. `fallback` may be a value or
 * a function `(error) => value`. Handles sync throws and async rejections.
 *
 * Place `@Fallback` **outermost** (top of the stack) so it catches only after
 * `@Retry`/`@CircuitBreaker`/`@Timeout` have run. Putting it inside them swallows
 * the error first, so those never see a failure and never retry/trip.
 */
export function Fallback(
  fallback: unknown | ((error: unknown) => unknown),
): MethodDecorator {
  const resolve = (error: unknown) =>
    typeof fallback === 'function'
      ? (fallback as (e: unknown) => unknown)(error)
      : fallback;
  return (_t, methodName, descriptor) =>
    wrap(
      descriptor,
      (original) =>
        function (this: unknown, ...args: any[]) {
          try {
            const result = original.apply(this, args);
            if (isPromise(result)) return result.catch(resolve);
            return result;
          } catch (error) {
            return resolve(error);
          }
        },
      methodName,
    );
}

/**
 * Throttle the call **rate**: allow at most `limit` calls per rolling
 * `intervalMs`, per instance. Excess calls throw {@link RateLimitError}.
 */
export function RateLimit(limit: number, intervalMs: number): MethodDecorator {
  return (_t, methodName, descriptor) => {
    const state = new WeakMap<object, { hits: number[]; async: boolean }>();
    return wrap(
      descriptor,
      (original) =>
        function (this: object, ...args: any[]) {
          let s = state.get(this);
          if (!s) {
            s = { hits: [], async: false };
            state.set(this, s);
          }
          const now = Date.now();
          s.hits = s.hits.filter((t) => t > now - intervalMs);
          if (s.hits.length >= limit) {
            const error = new RateLimitError(
              `@RateLimit: "${methodName}" exceeded ${limit} calls per ${intervalMs}ms.`,
            );
            // Reject (don't sync-throw) when the method is async, so callers can
            // .catch() consistently.
            if (s.async) return Promise.reject(error);
            throw error;
          }
          s.hits.push(now);
          const result = original.apply(this, args);
          if (isPromise(result)) s.async = true;
          return result;
        },
      methodName,
    );
  };
}

/**
 * Limit concurrent executions of an **async** method to `max` per instance;
 * queue the rest (FIFO). The decorated method always returns a promise.
 */
export function Concurrency(max: number): MethodDecorator {
  return (_t, methodName, descriptor) => {
    const state = new WeakMap<object, { active: number; queue: (() => void)[] }>();
    return wrap(
      descriptor,
      (original) =>
        async function (this: object, ...args: any[]) {
          let s = state.get(this);
          if (!s) {
            s = { active: 0, queue: [] };
            state.set(this, s);
          }
          if (s.active >= max) {
            await new Promise<void>((res) => s!.queue.push(res));
          }
          s.active++;
          try {
            return await original.apply(this, args);
          } finally {
            s.active--;
            s.queue.shift()?.();
          }
        },
      methodName,
    );
  };
}

/**
 * Circuit breaker: after `failureThreshold` consecutive failures, "open" the
 * circuit and fail fast with {@link CircuitOpenError} for `resetMs`. After that
 * one trial call is allowed (half-open); success closes the circuit. Per instance.
 */
export function CircuitBreaker(
  options: { failureThreshold?: number; resetMs?: number } = {},
): MethodDecorator {
  const threshold = options.failureThreshold ?? 5;
  const resetMs = options.resetMs ?? 30_000;
  return (_t, methodName, descriptor) => {
    const state = new WeakMap<
      object,
      { failures: number; openedAt: number; async: boolean }
    >();
    return wrap(
      descriptor,
      (original) =>
        function (this: object, ...args: any[]) {
          let s = state.get(this);
          if (!s) {
            s = { failures: 0, openedAt: 0, async: false };
            state.set(this, s);
          }
          if (s.openedAt && Date.now() - s.openedAt < resetMs) {
            const error = new CircuitOpenError(
              `@CircuitBreaker: circuit for "${methodName}" is open.`,
            );
            // Reject (don't sync-throw) when the method is async.
            if (s.async) return Promise.reject(error);
            throw error;
          }
          const onSuccess = (value: unknown) => {
            s!.failures = 0;
            s!.openedAt = 0;
            return value;
          };
          const onFailure = (error: unknown) => {
            s!.failures++;
            if (s!.failures >= threshold) s!.openedAt = Date.now();
            throw error;
          };
          try {
            const result = original.apply(this, args);
            if (isPromise(result)) {
              s.async = true;
              return result.then(onSuccess, onFailure);
            }
            return onSuccess(result);
          } catch (error) {
            return onFailure(error);
          }
        },
      methodName,
    );
  };
}

/**
 * Debounce a **void / fire-and-forget** method: collapse rapid calls and invoke
 * once, `ms` after the last call (trailing edge). The return value is discarded,
 * so use this only on methods whose result you don't consume (event handlers).
 */
export function Debounce(ms: number): MethodDecorator {
  return (_t, methodName, descriptor) => {
    const timers = new WeakMap<object, ReturnType<typeof setTimeout>>();
    return wrap(
      descriptor,
      (original) =>
        function (this: object, ...args: any[]): void {
          const prev = timers.get(this);
          if (prev) clearTimeout(prev);
          timers.set(
            this,
            setTimeout(() => original.apply(this, args), ms),
          );
        },
      methodName,
    );
  };
}

/**
 * Throttle a **void / fire-and-forget** method: invoke immediately, then ignore
 * further calls for `ms` (leading edge). The return value is discarded.
 */
export function Throttle(ms: number): MethodDecorator {
  return (_t, methodName, descriptor) => {
    const last = new WeakMap<object, number>();
    return wrap(
      descriptor,
      (original) =>
        function (this: object, ...args: any[]): void {
          const now = Date.now();
          if (now - (last.get(this) ?? 0) >= ms) {
            last.set(this, now);
            original.apply(this, args);
          }
        },
      methodName,
    );
  };
}
