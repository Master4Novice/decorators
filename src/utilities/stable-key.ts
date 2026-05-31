/**
 * Build a deterministic cache key from a method's argument list.
 *
 * Used by `@Cache`, `@Memoize`, `@Dedupe`, and `@Idempotent` (default key).
 * Plain `JSON.stringify(args)` has three problems this avoids:
 *
 *  - **Key-order sensitivity:** `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` are the
 *    same value but stringify differently, causing silent cache misses. Object
 *    keys are sorted here so logically-equal args collide correctly.
 *  - **Throws on `BigInt`** and on **circular references** — both are encoded
 *    instead of throwing.
 *  - **`undefined` collapses** (dropped from objects, becomes `null` in arrays).
 *    It is encoded distinctly so `f(1, undefined)` and `f(1, null)` differ.
 *
 * The result is opaque — only equality matters, not its shape.
 */
export function stableKey(args: readonly unknown[]): string {
  const seen = new WeakSet<object>();

  const norm = (v: unknown): unknown => {
    if (v === null) return null;
    const t = typeof v;
    if (t === 'bigint') return { __t: 'bigint', v: (v as bigint).toString() };
    if (t === 'function')
      return { __t: 'fn', v: (v as { name?: string }).name || 'anonymous' };
    if (t === 'symbol') return { __t: 'sym', v: String(v) };
    if (t === 'undefined') return { __t: 'undefined' };
    if (t !== 'object') return v; // string | number | boolean

    const obj = v as object;
    if (obj instanceof Date) return { __t: 'date', v: obj.getTime() };
    if (obj instanceof RegExp) return { __t: 'regexp', v: obj.toString() };
    if (seen.has(obj)) return { __t: 'circular' };
    seen.add(obj);

    if (Array.isArray(obj)) return obj.map(norm);

    const record = obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = norm(record[key]);
    return out;
  };

  return JSON.stringify(norm(args));
}
