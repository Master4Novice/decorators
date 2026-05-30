import { ValidationError, GuardrailError } from './errors.js';

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * A JSON-Schema-style description of a tool's input. Shaped to drop straight
 * into LLM tool/function-calling APIs (OpenAI `parameters`, Anthropic
 * `input_schema`).
 */
export interface ToolParameters {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolOptions {
  /** What the tool does — shown to the LLM. Required. */
  description: string;
  /** Tool name exposed to the LLM. Defaults to the method name. */
  name?: string;
  /**
   * Explicit input schema. **Not** inferred from the method signature (TypeScript
   * parameter types are erased at runtime), so provide it yourself.
   */
  parameters?: ToolParameters;
}

/** The LLM-facing manifest entry for a registered tool. */
export interface ToolManifest {
  name: string;
  description: string;
  parameters: ToolParameters;
}

interface ToolEntry extends ToolManifest {
  methodName: string;
}

const tools = new Map<string, ToolEntry>();

/**
 * Mark a method as an **AI tool** an agent/LLM can call. Registers its name,
 * description, and (explicit) input schema; the method itself is unchanged and
 * still callable normally. Use {@link getTools} to build the LLM tool list and
 * {@link invokeTool} to dispatch a tool call back to the method.
 *
 * The method should accept a single arguments object matching `parameters`.
 *
 * Tool names are registered in a **process-global** registry and must be unique:
 * a duplicate name (including two classes relying on the same default method
 * name) overwrites the earlier entry, so `invokeTool` would dispatch to the
 * last-registered method. Give colliding tools explicit, unique `name`s.
 *
 * @example
 * class Weather {
 *   \@Tool({
 *     description: 'Get the current temperature for a city',
 *     parameters: {
 *       type: 'object',
 *       properties: { city: { type: 'string' } },
 *       required: ['city'],
 *     },
 *   })
 *   getTemperature(args: { city: string }) { ... }
 * }
 *
 * // const tools = getTools();            // -> pass to the LLM
 * // invokeTool(new Weather(), 'getTemperature', { city: 'Pune' });
 */
export function Tool(options: ToolOptions) {
  return function (
    _t: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const name = options.name ?? methodName;
    tools.set(name, {
      name,
      description: options.description,
      parameters: options.parameters ?? { type: 'object', properties: {} },
      methodName,
    });
    return descriptor;
  };
}

/**
 * The manifest of all registered `@Tool`s — `{ name, description, parameters }`
 * — ready to pass to an LLM's tool/function-calling API.
 */
export function getTools(): ToolManifest[] {
  return [...tools.values()].map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

/**
 * Dispatch a tool call to its method on `instance`, passing `args` as the single
 * argument. Throws if the tool name is unknown or the method is missing.
 *
 * @example
 * // From an LLM tool_call:
 * const result = invokeTool(service, call.name, call.arguments);
 */
export function invokeTool(
  instance: any,
  name: string,
  args?: unknown,
): unknown {
  const entry = tools.get(name);
  if (!entry) throw new Error(`invokeTool: unknown tool "${name}".`);
  const fn = instance?.[entry.methodName];
  if (typeof fn !== 'function') {
    throw new Error(
      `invokeTool: method "${entry.methodName}" for tool "${name}" not found on the instance.`,
    );
  }
  return fn.call(instance, args);
}

/** Clear the tool registry (primarily for tests). */
export function clearTools(): void {
  tools.clear();
}

// ---------------------------------------------------------------------------
// Agent power-ups — guardrails, idempotency, input validation, and metering for
// the methods an agent calls.
// ---------------------------------------------------------------------------

/**
 * Method decorator: validate the **arguments** before the method runs. `check`
 * receives the argument array and returns a boolean (or throws); a falsy result
 * throws {@link ValidationError}. Perfect for guarding LLM-tool inputs.
 *
 * @example
 * \@Validate((args) => typeof args[0] === 'string' && args[0].length > 0)
 * search(query: string) { ... }
 */
export function Validate(
  check: (args: unknown[]) => boolean,
  options: { message?: string } = {},
) {
  return function (
    _t: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value;
    descriptor.value = function (this: unknown, ...args: any[]) {
      let ok: boolean;
      try {
        ok = check(args);
      } catch (error) {
        if (error instanceof ValidationError) throw error;
        ok = false;
      }
      if (!ok) {
        throw new ValidationError(
          options.message ?? `@Validate: arguments to "${methodName}" are invalid.`,
        );
      }
      return original.apply(this, args);
    };
    return descriptor;
  };
}

/**
 * Method decorator: validate the **output** with `check`. On a falsy/throwing
 * result it retries up to `retries` times, then throws {@link GuardrailError}.
 * Ideal for asserting an LLM produced well-formed output. Sync/async aware.
 *
 * @example
 * \@Guardrail((out: { json: unknown }) => out.json !== undefined, { retries: 2 })
 * async ask(prompt: string) { ... }
 */
export function Guardrail<R = unknown>(
  check: (result: R) => boolean,
  options: { retries?: number; message?: string } = {},
) {
  const retries = options.retries ?? 0;
  return function (
    _t: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value;
    descriptor.value = function (this: unknown, ...args: any[]) {
      const verify = (value: unknown, attempt: number): unknown => {
        let ok: boolean;
        try {
          ok = check(value as R);
        } catch {
          ok = false;
        }
        if (ok) return value;
        if (attempt < retries) return run(attempt + 1);
        throw new GuardrailError(
          options.message ?? `@Guardrail: output of "${methodName}" failed validation.`,
        );
      };
      const run = (attempt: number): unknown => {
        const result = original.apply(this, args);
        return isPromise(result)
          ? result.then((v) => verify(v, attempt))
          : verify(result, attempt);
      };
      return run(0);
    };
    return descriptor;
  };
}

/**
 * Method decorator: cache the result by an **idempotency key** (per instance).
 * Repeat calls with the same key return the stored result without re-running —
 * unlike `@Cache` there's no TTL, and unlike `@Dedupe` it persists past the
 * in-flight window. Failed async calls are not cached.
 *
 * @param keyFn derive the key from the args (default: JSON of the args).
 *
 * @example
 * \@Idempotent((req) => req.requestId)
 * async charge(req: { requestId: string; amount: number }) { ... }
 */
export function Idempotent(keyFn?: (...args: any[]) => string) {
  return function (
    _t: any,
    _methodName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value;
    const stores = new WeakMap<object, Map<string, unknown>>();
    descriptor.value = function (this: object, ...args: any[]) {
      let store = stores.get(this);
      if (!store) {
        store = new Map();
        stores.set(this, store);
      }
      const key = keyFn ? String(keyFn.apply(this, args)) : JSON.stringify(args);
      if (store.has(key)) return store.get(key);
      const result = original.apply(this, args);
      store.set(key, result);
      if (isPromise(result)) result.catch(() => store!.delete(key));
      return result;
    };
    return descriptor;
  };
}

interface MeterStat {
  calls: number;
  errors: number;
  totalMs: number;
  avgMs: number;
}

const meters = new Map<string, { calls: number; errors: number; totalMs: number }>();

/**
 * Method decorator: record call count, error count, and timing under `name`
 * (default: the method name). Read it back with {@link getMetrics} — handy for
 * an agent to see how often and how expensively each tool is used. Sync/async.
 */
export function Meter(name?: string) {
  return function (
    _t: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const original = descriptor.value;
    const id = name ?? methodName;
    descriptor.value = function (this: unknown, ...args: any[]) {
      let m = meters.get(id);
      if (!m) {
        m = { calls: 0, errors: 0, totalMs: 0 };
        meters.set(id, m);
      }
      m.calls++;
      const start = Date.now();
      const stop = () => {
        m!.totalMs += Date.now() - start;
      };
      const fail = () => {
        m!.errors++;
        stop();
      };
      try {
        const result = original.apply(this, args);
        if (isPromise(result)) {
          return result.then(
            (v) => {
              stop();
              return v;
            },
            (e) => {
              fail();
              throw e;
            },
          );
        }
        stop();
        return result;
      } catch (e) {
        fail();
        throw e;
      }
    };
    return descriptor;
  };
}

/** Snapshot of all `@Meter` metrics, keyed by meter name. */
export function getMetrics(): Record<string, MeterStat> {
  const out: Record<string, MeterStat> = {};
  for (const [id, m] of meters) {
    out[id] = {
      calls: m.calls,
      errors: m.errors,
      totalMs: m.totalMs,
      avgMs: m.calls ? m.totalMs / m.calls : 0,
    };
  }
  return out;
}

/** Reset all `@Meter` metrics (primarily for tests). */
export function resetMetrics(): void {
  meters.clear();
}
