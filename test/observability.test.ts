import { jest } from '@jest/globals';

const mockInfo = jest.fn();
const mockError = jest.fn();
jest.mock('../src/utilities/logger.js', () => ({
  __esModule: true,
  logger: {
    info: (msg: string) => mockInfo(msg),
    error: (msg: string) => mockError(msg),
    warn: jest.fn(),
  },
}));

import {
  Trace,
  Audit,
  LogErrors,
  getTraceId,
  setAuditResolver,
} from '../src/services/observability.js';

beforeEach(() => {
  mockInfo.mockReset();
  mockError.mockReset();
});

const lines = () => mockInfo.mock.calls.map((c) => String(c[0]));

describe('@Trace', () => {
  it('logs entry/exit and shares one correlation id across nested calls', async () => {
    class Svc {
      @Trace()
      async outer() {
        const id = getTraceId();
        await this.inner();
        return id;
      }
      @Trace()
      async inner() {
        return getTraceId();
      }
    }
    const id = await new Svc().outer();
    expect(id).toBeDefined();
    // Every emitted trace line carries the same id.
    const ids = lines()
      .map((l) => l.match(/^\[([0-9a-f]+)\]/)?.[1])
      .filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(id);
  });

  it('redacts logged args', async () => {
    class Svc {
      @Trace({ args: true })
      async login(creds: { user: string; password: string }) {
        return 'ok';
      }
    }
    await new Svc().login({ user: 'a', password: 'secret' });
    const entry = lines().find((l) => l.includes('-> login'))!;
    expect(entry).toContain('[REDACTED]');
    expect(entry).not.toContain('secret');
  });

  it('logs an error line and rethrows', async () => {
    class Svc {
      @Trace()
      async boom() {
        throw new Error('kaboom');
      }
    }
    await expect(new Svc().boom()).rejects.toThrow('kaboom');
    expect(mockError).toHaveBeenCalled();
  });
});

describe('@Audit', () => {
  it('logs actor + action, resolved via setAuditResolver', () => {
    setAuditResolver((ctx) => (ctx.instance as { userId: string }).userId);
    class Admin {
      userId = 'u-42';
      @Audit('user.delete')
      remove(id: string) {
        return `removed ${id}`;
      }
    }
    expect(new Admin().remove('x')).toBe('removed x');
    const line = lines().find((l) => l.startsWith('AUDIT'))!;
    expect(line).toContain('actor=u-42');
    expect(line).toContain('action=user.delete');
  });
});

describe('@LogErrors', () => {
  it('logs and rethrows on sync error', () => {
    class Svc {
      @LogErrors()
      run(): string {
        throw new Error('fail');
      }
    }
    expect(() => new Svc().run()).toThrow('fail');
    expect(mockError).toHaveBeenCalled();
  });

  it('logs and rethrows on async rejection', async () => {
    class Svc {
      @LogErrors()
      async run() {
        throw new Error('nope');
      }
    }
    await expect(new Svc().run()).rejects.toThrow('nope');
    expect(mockError).toHaveBeenCalled();
  });
});
