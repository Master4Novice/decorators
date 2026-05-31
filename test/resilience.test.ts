import { jest } from '@jest/globals';
import {
  Timeout,
  Once,
  Cache,
  Dedupe,
  Fallback,
  RateLimit,
  Concurrency,
  CircuitBreaker,
  Debounce,
  Throttle,
} from '../src/services/resilience.js';
import {
  TimeoutError,
  RateLimitError,
  CircuitOpenError,
} from '../src/services/errors.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('@Timeout', () => {
  // Generous margins (real timers) so this never flakes under CI load.
  it('rejects a slow async method with TimeoutError', async () => {
    class Api {
      @Timeout(30)
      async slow() {
        await sleep(300);
        return 'done';
      }
    }
    await expect(new Api().slow()).rejects.toBeInstanceOf(TimeoutError);
  });

  it('resolves a fast async method normally', async () => {
    class Api {
      @Timeout(300)
      async fast() {
        await sleep(10);
        return 'ok';
      }
    }
    await expect(new Api().fast()).resolves.toBe('ok');
  });
});

describe('@Once', () => {
  it('runs once and caches the result', () => {
    class C {
      calls = 0;
      @Once
      init() {
        this.calls++;
        return this.calls;
      }
    }
    const c = new C();
    expect(c.init()).toBe(1);
    expect(c.init()).toBe(1);
    expect(c.calls).toBe(1);
  });
});

describe('@Cache', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('caches within the TTL and recomputes after it expires', () => {
    class C {
      calls = 0;
      @Cache(30)
      now() {
        this.calls++;
        return this.calls;
      }
    }
    const c = new C();
    expect(c.now()).toBe(1);
    expect(c.now()).toBe(1);
    jest.advanceTimersByTime(45);
    expect(c.now()).toBe(2);
  });

  it('uses a stable key: argument-object key order does not matter', () => {
    class C {
      calls = 0;
      @Cache(1000)
      lookup(opts: { a: number; b: number }) {
        this.calls++;
        return this.calls;
      }
    }
    const c = new C();
    expect(c.lookup({ a: 1, b: 2 })).toBe(1);
    expect(c.lookup({ b: 2, a: 1 })).toBe(1); // same logical args → cache hit
    expect(c.calls).toBe(1);
  });

  it('does not cache a rejected promise (failure is not replayed for the TTL)', async () => {
    jest.useRealTimers();
    class C {
      calls = 0;
      @Cache(10_000)
      async load() {
        this.calls++;
        if (this.calls === 1) throw new Error('boom');
        return 'ok';
      }
    }
    const c = new C();
    await expect(c.load()).rejects.toThrow('boom');
    await expect(c.load()).resolves.toBe('ok'); // retried, not the cached rejection
    expect(c.calls).toBe(2);
  });

  it('evicts the least-recently-used entry when maxSize is exceeded', () => {
    class C {
      calls = 0;
      @Cache(10_000, { maxSize: 2 })
      sq(n: number) {
        this.calls++;
        return n * n;
      }
    }
    const c = new C();
    c.sq(1); // {1}
    c.sq(2); // {1,2}
    c.sq(1); // touch 1 → LRU order now [2,1]
    c.sq(3); // size>2 → evict 2 → {1,3}
    expect(c.calls).toBe(3);
    c.sq(1); // still cached
    expect(c.calls).toBe(3);
    c.sq(2); // was evicted → recompute
    expect(c.calls).toBe(4);
  });
});

describe('@Dedupe', () => {
  it('shares one in-flight promise for identical concurrent calls', async () => {
    class C {
      calls = 0;
      @Dedupe
      async load(id: string) {
        this.calls++;
        await sleep(50);
        return `${id}:${this.calls}`;
      }
    }
    const c = new C();
    const [a, b] = await Promise.all([c.load('x'), c.load('x')]);
    expect(a).toBe(b);
    expect(c.calls).toBe(1);
    await c.load('x'); // after settling, a fresh call runs again
    expect(c.calls).toBe(2);
  });
});

describe('@Fallback', () => {
  it('returns the fallback on a sync throw', () => {
    class C {
      @Fallback('safe')
      run(): string {
        throw new Error('boom');
      }
    }
    expect(new C().run()).toBe('safe');
  });

  it('returns the fallback on an async rejection, with the error', async () => {
    class C {
      @Fallback((err: unknown) => `caught:${(err as Error).message}`)
      async run() {
        throw new Error('nope');
      }
    }
    await expect(new C().run()).resolves.toBe('caught:nope');
  });
});

describe('@RateLimit', () => {
  it('throws once the limit is exceeded in the window', () => {
    class C {
      @RateLimit(2, 1000)
      ping() {
        return 'ok';
      }
    }
    const c = new C();
    expect(c.ping()).toBe('ok');
    expect(c.ping()).toBe('ok');
    expect(() => c.ping()).toThrow(RateLimitError);
  });
});

describe('@Concurrency', () => {
  it('never runs more than max at once', async () => {
    let active = 0;
    let maxActive = 0;
    class C {
      @Concurrency(2)
      async task() {
        active++;
        maxActive = Math.max(maxActive, active);
        await sleep(50);
        active--;
      }
    }
    const c = new C();
    await Promise.all([c.task(), c.task(), c.task(), c.task()]);
    expect(maxActive).toBe(2);
  });
});

describe('@CircuitBreaker', () => {
  it('opens after the failure threshold then fails fast', async () => {
    class C {
      @CircuitBreaker({ failureThreshold: 2, resetMs: 200 })
      async call() {
        throw new Error('fail');
      }
    }
    const c = new C();
    await expect(c.call()).rejects.toThrow('fail');
    await expect(c.call()).rejects.toThrow('fail');
    await expect(c.call()).rejects.toBeInstanceOf(CircuitOpenError);
  });
});

describe('@Debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('collapses rapid calls into one trailing invocation', () => {
    class C {
      calls = 0;
      @Debounce(20)
      onInput() {
        this.calls++;
      }
    }
    const c = new C();
    c.onInput();
    c.onInput();
    c.onInput();
    expect(c.calls).toBe(0);
    jest.advanceTimersByTime(40);
    expect(c.calls).toBe(1);
  });
});

describe('@Throttle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('invokes on the leading edge and ignores calls within the window', () => {
    class C {
      calls = 0;
      @Throttle(30)
      onScroll() {
        this.calls++;
      }
    }
    const c = new C();
    c.onScroll();
    c.onScroll();
    expect(c.calls).toBe(1);
    jest.advanceTimersByTime(40);
    c.onScroll();
    expect(c.calls).toBe(2);
  });
});
