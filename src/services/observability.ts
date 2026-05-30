import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { logger } from '../utilities/logger.js';
import { redact, type RedactOptions } from '../utilities/redact.js';

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

const traceStore = new AsyncLocalStorage<{ traceId: string }>();

/** The correlation id of the current `@Trace` scope, if any. */
export function getTraceId(): string | undefined {
  return traceStore.getStore()?.traceId;
}

export interface TraceOptions {
  /** Log the (redacted) arguments on entry. Default true. */
  args?: boolean;
  /** Log the (redacted) result on exit. Default false. */
  result?: boolean;
  /** Redaction options for logged args/result. */
  redact?: RedactOptions;
}

/**
 * Method decorator: structured entry/exit/error tracing with a **correlation id**
 * threaded through nested calls (via AsyncLocalStorage). All nested `@Trace`d
 * calls share the outermost trace id, so an agent can follow one request through
 * the call tree. Args/results are redacted. Use `getTraceId()` to tag your own
 * logs with the same id.
 *
 * @example
 * class Service {
 *   \@Trace({ result: true })
 *   async handle(req: Request) { ... }
 * }
 * // [3f9a1c2b] -> handle args=[...]
 * // [3f9a1c2b] <- handle (12ms) result=...
 *
 * @remarks Redaction is **key-based**: object fields named like secrets
 * (`@Secret` names + {@link DEFAULT_SENSITIVE_KEYS}) are masked. Positional
 * **primitive** arguments (e.g. a raw token string) and **error messages** are
 * logged as-is — do not pass raw secrets positionally, and avoid embedding them
 * in thrown error messages. Set `args: false` to omit argument logging entirely.
 */
export function Trace(options: TraceOptions = {}) {
  const logArgs = options.args ?? true;
  const logResult = options.result ?? false;

  return function (
    _t: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value;

    descriptor.value = function (this: unknown, ...args: any[]) {
      const parent = traceStore.getStore();
      const traceId = parent?.traceId ?? randomUUID().slice(0, 8);
      const safe = (v: unknown) => JSON.stringify(redact(v, options.redact));

      const run = (): unknown => {
        const start = Date.now();
        logger.info(
          `[${traceId}] -> ${methodName}${logArgs ? ` args=${safe(args)}` : ''}`,
        );
        const settled = (ok: boolean, payload: unknown) => {
          const ms = Date.now() - start;
          if (ok) {
            logger.info(
              `[${traceId}] <- ${methodName} (${ms}ms)${
                logResult ? ` result=${safe(payload)}` : ''
              }`,
            );
          } else {
            logger.error(
              `[${traceId}] x ${methodName} (${ms}ms): ${
                (payload as Error)?.message ?? String(payload)
              }`,
            );
          }
        };
        try {
          const result = original.apply(this, args);
          if (isPromise(result)) {
            return result.then(
              (v) => {
                settled(true, v);
                return v;
              },
              (e) => {
                settled(false, e);
                throw e;
              },
            );
          }
          settled(true, result);
          return result;
        } catch (e) {
          settled(false, e);
          throw e;
        }
      };

      // Inherit the parent trace scope, or open a new one.
      return parent ? run() : traceStore.run({ traceId }, run);
    };

    return descriptor;
  };
}

export interface AuditContext {
  instance: unknown;
  methodName: string;
  args: unknown[];
}

type AuditResolver = (ctx: AuditContext) => string;

let auditResolver: AuditResolver | undefined;

/**
 * Register how `@Audit` resolves the acting principal (the "who"). Without it,
 * audited actions are logged with actor `unknown`.
 *
 * @example
 * setAuditResolver((ctx) => (ctx.instance as any).user?.id ?? 'system');
 */
export function setAuditResolver(resolver: AuditResolver): void {
  auditResolver = resolver;
}

/**
 * Method decorator: emit an audit log line (actor, action, redacted args) when
 * the method is called. Provide a `setAuditResolver` to capture *who*.
 *
 * @example
 * class Admin {
 *   \@Audit('user.delete')
 *   deleteUser(id: string) { ... }
 * }
 *
 * @remarks Argument redaction is key-based (object fields only); positional
 * primitive arguments are logged as-is — don't pass raw secrets positionally.
 */
export function Audit(action?: string, options: { redact?: RedactOptions } = {}) {
  return function (
    _t: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value;

    descriptor.value = function (this: unknown, ...args: any[]) {
      const actor = auditResolver
        ? auditResolver({ instance: this, methodName, args })
        : 'unknown';
      logger.info(
        `AUDIT actor=${actor} action=${action ?? methodName} args=${JSON.stringify(
          redact(args, options.redact),
        )}`,
      );
      return original.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Method decorator: log errors (with redacted args and the stack) and **rethrow**
 * — observability without swallowing. Handles sync and async. Pair with
 * `@Fallback` if you also want to recover.
 *
 * @remarks Argument redaction is key-based (object fields only). The error
 * **stack/message is logged as-is** (its diagnostic value depends on it) — if
 * your code may put secrets in error messages, scrub them at the throw site.
 */
export function LogErrors(options: { redact?: RedactOptions } = {}) {
  return function (
    _t: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value;

    descriptor.value = function (this: unknown, ...args: any[]) {
      const onError = (error: unknown): never => {
        logger.error(
          `Error in ${methodName} args=${JSON.stringify(
            redact(args, options.redact),
          )}: ${(error as Error)?.stack ?? String(error)}`,
        );
        throw error;
      };
      try {
        const result = original.apply(this, args);
        if (isPromise(result)) return result.catch(onError);
        return result;
      } catch (error) {
        return onError(error);
      }
    };

    return descriptor;
  };
}
