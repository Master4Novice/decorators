import { jest } from '@jest/globals';

const mockInfo = jest.fn();
const mockWarn = jest.fn();
jest.mock('../src/utilities/logger.js', () => ({
  __esModule: true,
  logger: {
    info: (msg: string) => mockInfo(msg),
    warn: (msg: string) => mockWarn(msg),
  },
}));

import { Retry, Memoize, Deprecated, Measure } from '../src/services/utility.js';

beforeEach(() => {
  mockInfo.mockReset();
  mockWarn.mockReset();
});

describe('@Retry', () => {
  it('retries a sync method until it succeeds', () => {
    class Flaky {
      attempts = 0;
      @Retry(3)
      run() {
        this.attempts++;
        if (this.attempts < 3) throw new Error('fail');
        return 'ok';
      }
    }
    const f = new Flaky();
    expect(f.run()).toBe('ok');
    expect(f.attempts).toBe(3);
  });

  it('re-throws after exhausting sync attempts', () => {
    class AlwaysFails {
      attempts = 0;
      @Retry(2)
      run() {
        this.attempts++;
        throw new Error('boom');
      }
    }
    const f = new AlwaysFails();
    expect(() => f.run()).toThrow('boom');
    expect(f.attempts).toBe(2);
  });

  it('retries an async method', async () => {
    class FlakyAsync {
      attempts = 0;
      @Retry(3)
      async run() {
        this.attempts++;
        if (this.attempts < 2) throw new Error('fail');
        return 'ok';
      }
    }
    const f = new FlakyAsync();
    await expect(f.run()).resolves.toBe('ok');
    expect(f.attempts).toBe(2);
  });
});

describe('@Memoize', () => {
  it('computes once per argument key', () => {
    class Calc {
      calls = 0;
      @Memoize
      square(n: number) {
        this.calls++;
        return n * n;
      }
    }
    const c = new Calc();
    expect(c.square(4)).toBe(16);
    expect(c.square(4)).toBe(16);
    expect(c.square(5)).toBe(25);
    expect(c.calls).toBe(2);
  });

  it('keys stably regardless of argument-object key order', () => {
    class Calc {
      calls = 0;
      @Memoize
      area(o: { w: number; h: number }) {
        this.calls++;
        return o.w * o.h;
      }
    }
    const c = new Calc();
    expect(c.area({ w: 2, h: 3 })).toBe(6);
    expect(c.area({ h: 3, w: 2 })).toBe(6); // same logical args → memo hit
    expect(c.calls).toBe(1);
  });

  it('does not memoize a rejected promise', async () => {
    class Calc {
      calls = 0;
      @Memoize
      async load() {
        this.calls++;
        if (this.calls === 1) throw new Error('boom');
        return 'ok';
      }
    }
    const c = new Calc();
    await expect(c.load()).rejects.toThrow('boom');
    await expect(c.load()).resolves.toBe('ok'); // slot cleared after rejection
    expect(c.calls).toBe(2);
  });
});

describe('@Deprecated', () => {
  it('warns once and still runs the method', () => {
    class Api {
      @Deprecated('Use v2.')
      old() {
        return 'old';
      }
    }
    const a = new Api();
    expect(a.old()).toBe('old');
    a.old();
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][0]).toContain('Use v2.');
  });
});

describe('@Measure', () => {
  it('logs duration and returns the result (sync)', () => {
    class Job {
      @Measure
      run() {
        return 42;
      }
    }
    expect(new Job().run()).toBe(42);
    expect(mockInfo).toHaveBeenCalled();
    expect(mockInfo.mock.calls[0][0]).toMatch(/run took \d+ms/);
  });

  it('measures async methods to settlement', async () => {
    class Job {
      @Measure
      async run() {
        return 'done';
      }
    }
    await expect(new Job().run()).resolves.toBe('done');
    expect(mockInfo).toHaveBeenCalled();
  });
});
