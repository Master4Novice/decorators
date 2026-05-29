import { ForbiddenError } from './errors.js';

/** Context handed to resolvers/predicates so the app can locate the principal. */
export interface AccessContext {
  /** The instance the method was called on (`this`). */
  instance: unknown;
  /** The method name being guarded. */
  methodName: string;
  /** The arguments the method was called with. */
  args: unknown[];
}

type RoleResolver = (ctx: AccessContext) => string[] | Promise<string[]>;

let roleResolver: RoleResolver | undefined;

/**
 * Register how `@Role` discovers the current principal's roles. Call once at
 * startup. The library is auth-agnostic: derive roles from `ctx.instance`
 * (e.g. `this.request.user`), `ctx.args`, or any ambient context you keep.
 *
 * @example
 * setRoleResolver((ctx) => (ctx.instance as any).user?.roles ?? []);
 */
export function setRoleResolver(resolver: RoleResolver): void {
  roleResolver = resolver;
}

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Method decorator: allows the call only if the principal has at least one of
 * the given roles. Throws {@link ForbiddenError} otherwise. Requires
 * {@link setRoleResolver} to be configured.
 *
 * Works with sync or async resolvers; with an async resolver the guarded call
 * resolves to a promise.
 *
 * @example
 * class AdminApi {
 *   \@Role('admin', 'owner')
 *   deleteUser(id: string) { ... }
 * }
 */
export function Role(...allowed: string[]) {
  return function (
    _target: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      if (!roleResolver) {
        throw new ForbiddenError(
          `@Role: no role resolver configured. Call setRoleResolver(...) at startup.`,
        );
      }
      const ctx: AccessContext = { instance: this, methodName, args };
      const decide = (roles: string[]) => {
        if (!roles.some((r) => allowed.includes(r))) {
          throw new ForbiddenError(
            `@Role: access to "${methodName}" denied. Requires one of: ${allowed.join(
              ', ',
            )}.`,
          );
        }
        return original.apply(this, args);
      };

      const resolved = roleResolver(ctx);
      return isPromise(resolved) ? resolved.then(decide) : decide(resolved);
    };

    return descriptor;
  };
}

/**
 * Method decorator: allows the call only if `predicate(ctx)` is truthy. A
 * flexible escape hatch for permission checks, ownership checks, feature flags,
 * etc. Throws {@link ForbiddenError} when the predicate is falsy.
 *
 * @example
 * class DocApi {
 *   \@Authorize((ctx) => (ctx.instance as any).user?.can('edit'))
 *   edit(docId: string) { ... }
 * }
 */
export function Authorize(
  predicate: (ctx: AccessContext) => boolean | Promise<boolean>,
  message = 'Access denied.',
) {
  return function (
    _target: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      const ctx: AccessContext = { instance: this, methodName, args };
      const decide = (ok: boolean) => {
        if (!ok) throw new ForbiddenError(`@Authorize: ${message}`);
        return original.apply(this, args);
      };

      const result = predicate(ctx);
      return isPromise(result) ? result.then(decide) : decide(result);
    };

    return descriptor;
  };
}
