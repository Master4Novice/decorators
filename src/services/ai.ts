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
