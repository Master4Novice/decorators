import { jest } from '@jest/globals';

jest.mock('config', () => ({
  __esModule: true,
  default: { get: () => undefined },
}));

import {
  redact,
  redactFormat,
  DEFAULT_SENSITIVE_KEYS,
} from '../src/utilities/redact.js';
import { Secret, Configured } from '../src/services/injection.js';

describe('redact', () => {
  it('masks default sensitive keys at any depth', () => {
    const out = redact({
      user: 'alice',
      password: 'hunter2',
      nested: { apiKey: 'abc', ok: 1 },
    });
    expect(out).toEqual({
      user: 'alice',
      password: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', ok: 1 },
    });
  });

  it('redacts compound/camelCase secret names via stem matching', () => {
    const out = redact({
      jwtSecret: 'a',
      apiToken: 'b',
      userPassword: 'c',
      refreshToken: 'd',
      label: 'keep',
    });
    expect(out).toEqual({
      jwtSecret: '[REDACTED]',
      apiToken: '[REDACTED]',
      userPassword: '[REDACTED]',
      refreshToken: '[REDACTED]',
      label: 'keep',
    });
  });

  it('matches case- and separator-insensitively', () => {
    const out = redact({ API_KEY: 'x', AccessToken: 'y', normal: 'z' });
    expect(out).toEqual({
      API_KEY: '[REDACTED]',
      AccessToken: '[REDACTED]',
      normal: 'z',
    });
  });

  it('redacts @Secret-marked property names', () => {
    @Configured
    class Auth {
      @Secret('SOME_SECRET', 'fallback') mySpecialToken2!: string;
    }
    // Register the secret name, then redact an arbitrary object using it.
    new Auth();
    const out = redact({ mySpecialToken2: 'leaked', keep: 'ok' });
    expect(out.mySpecialToken2).toBe('[REDACTED]');
    expect(out.keep).toBe('ok');
  });

  it('honors custom keys and mask', () => {
    const out = redact({ ssnLike: '123' }, { keys: ['ssnLike'], mask: '***' });
    expect(out).toEqual({ ssnLike: '***' });
  });

  it('handles arrays and circular references', () => {
    const obj: any = { items: [{ token: 't' }, { ok: 2 }] };
    obj.self = obj;
    const out = redact(obj);
    expect(out.items[0].token).toBe('[REDACTED]');
    expect(out.items[1].ok).toBe(2);
    expect(out.self).toBe('[Circular]');
  });

  it('truncates beyond maxDepth instead of leaking deep secrets', () => {
    let deep: any = { password: 'LEAKED' };
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    const out = JSON.stringify(redact(deep));
    expect(out).not.toContain('LEAKED');
    expect(out).toContain('[Truncated]');
  });

  it('redacts secret keys inside a Map', () => {
    const m = new Map<string, string>([
      ['password', 'secret'],
      ['ok', 'visible'],
    ]);
    const out = redact({ data: m }) as unknown as {
      data: Record<string, unknown>;
    };
    expect(out.data.password).toBe('[REDACTED]');
    expect(out.data.ok).toBe('visible');
  });

  it('passes primitives and Dates through', () => {
    const d = new Date('2024-01-01');
    expect(redact(d)).toBe(d);
    expect(redact('plain')).toBe('plain');
    expect(redact(42)).toBe(42);
  });

  it('exposes a non-empty default key list', () => {
    expect(DEFAULT_SENSITIVE_KEYS).toContain('password');
    expect(DEFAULT_SENSITIVE_KEYS.length).toBeGreaterThan(5);
  });
});

describe('redactFormat', () => {
  it('masks sensitive fields on a winston log info object', () => {
    const fmt = redactFormat();
    const info: any = {
      level: 'info',
      message: 'login',
      password: 'hunter2',
      meta: { token: 'abc', user: 'bob' },
    };
    const result = fmt.transform(info) as any;
    expect(result.password).toBe('[REDACTED]');
    expect(result.meta.token).toBe('[REDACTED]');
    expect(result.meta.user).toBe('bob');
    // Reserved keys are untouched.
    expect(result.level).toBe('info');
    expect(result.message).toBe('login');
  });
});
