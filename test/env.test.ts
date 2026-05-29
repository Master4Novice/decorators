import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock('config', () => ({
  __esModule: true,
  default: { get: () => undefined },
}));

import { parseEnv, loadEnv } from '../src/utilities/env.js';

describe('parseEnv', () => {
  it('parses keys, quotes, comments, blank lines and export prefixes', () => {
    const parsed = parseEnv(
      [
        '# a comment',
        '',
        'PLAIN=hello',
        'QUOTED="with spaces"',
        "SINGLE='single quoted'",
        'export EXPORTED=value',
        'EMPTY=',
        'not a valid line',
      ].join('\n'),
    );
    expect(parsed).toEqual({
      PLAIN: 'hello',
      QUOTED: 'with spaces',
      SINGLE: 'single quoted',
      EXPORTED: 'value',
      EMPTY: '',
    });
  });
});

describe('loadEnv', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dec-env-'));
    delete process.env.FROM_FILE;
    delete process.env.PRESET;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads variables from a file into process.env', () => {
    const path = join(dir, '.env');
    writeFileSync(path, 'FROM_FILE=loaded\n');
    loadEnv({ path });
    expect(process.env.FROM_FILE).toBe('loaded');
  });

  it('does not overwrite already-set vars by default', () => {
    process.env.PRESET = 'original';
    const path = join(dir, '.env');
    writeFileSync(path, 'PRESET=fromfile\n');
    loadEnv({ path });
    expect(process.env.PRESET).toBe('original');
    loadEnv({ path, override: true });
    expect(process.env.PRESET).toBe('fromfile');
  });

  it('is a no-op when the file is missing', () => {
    expect(() => loadEnv({ path: join(dir, 'does-not-exist.env') })).not.toThrow();
  });
});
