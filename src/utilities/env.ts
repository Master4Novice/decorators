import { readFileSync } from 'node:fs';

/** Parse `.env`-style content into key/value pairs. */
export function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    // Strip an optional leading `export ` (common in shell-sourced .env files).
    const line = rawLine.replace(/^\s*export\s+/, '');
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue; // blank line, comment (#...), or malformed
    const key = match[1];
    let value = match[2] ?? '';
    // Strip a single pair of surrounding quotes.
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

let loadedOnce = false;

/**
 * Load variables from a `.env` file into `process.env`. Zero-dependency: it does
 * not pull in `dotenv`. By default it only fills variables that are not already
 * set, and is a no-op when the file is missing.
 *
 * `@Configured` calls this once automatically (with defaults) before resolving
 * `@Env`/`@Secret` properties, so `.env` files "just work". Call it explicitly
 * if you need a custom path, override semantics, or earlier loading.
 *
 * @param options.path     path to the env file (default `.env`).
 * @param options.override overwrite already-set `process.env` values (default false).
 */
export function loadEnv(options?: { path?: string; override?: boolean }): void {
  const path = options?.path ?? '.env';
  const override = options?.override ?? false;
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return; // no .env file — rely on the existing process.env
  }
  for (const [key, value] of Object.entries(parseEnv(content))) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Idempotent default-load used by `@Configured`; runs at most once per process. */
export function ensureEnvLoaded(): void {
  if (loadedOnce) return;
  loadedOnce = true;
  loadEnv();
}
