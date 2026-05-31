/**
 * Optional `node-config` integration for `@master4n/decorators`.
 *
 * Import from `@master4n/decorators/config`. This module is the **only** place
 * that imports `config` (node-config), declared as an optional peer dependency —
 * so the main entry point neither requires node-config nor triggers its eager
 * filesystem scan on import.
 *
 * `@Value`/`@Config` register against the same singleton injection registry as
 * `@Configured` (a shared rollup chunk), so they compose exactly as before:
 *
 * @example
 * import { Configured, Env } from '@master4n/decorators';
 * import { Value } from '@master4n/decorators/config';
 *
 * \@Configured
 * class DbConfig {
 *   \@Value('db.url', 'sqlite://memory') url!: string;
 *   \@Env('PORT', 3000) port!: number;
 * }
 */
import config from 'config';
import { makeDecorator, MissingConfigError } from './services/injection.js';

export { MissingConfigError } from './services/injection.js';

/**
 * Inject a value read from your config files (YAML/JSON via `node-config`).
 *
 * Replaces a manual `config.get(...)` + try/catch + default-fallback block.
 *
 * @param key   dotted config path, e.g. `"db.url"`.
 * @param fallback default used when the key is missing. If omitted entirely,
 *   a missing key throws {@link MissingConfigError} (fail loud at startup).
 */
export function Value(key: string, fallback?: unknown) {
  const hasFallback = arguments.length > 1;
  return makeDecorator(() => {
    try {
      return config.get(key);
    } catch {
      if (hasFallback) return fallback;
      throw new MissingConfigError(
        `@Value: config key "${key}" is missing and no default was provided.`,
      );
    }
  });
}

/**
 * Inject a config subtree/object by path (required). Useful for grabbing a
 * whole section, e.g. `@Config('redis') redis!: RedisOptions`.
 */
export function Config(path: string) {
  return makeDecorator(() => {
    try {
      return config.get(path);
    } catch {
      throw new MissingConfigError(`@Config: config path "${path}" is missing.`);
    }
  });
}
