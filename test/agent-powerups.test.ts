import { jest } from '@jest/globals';

import {
  Validate,
  Guardrail,
  Idempotent,
  Meter,
  getMetrics,
  resetMetrics,
} from '../src/services/ai.js';
import { ValidationError, GuardrailError } from '../src/services/errors.js';

beforeEach(() => resetMetrics());

describe('@Validate', () => {
  it('rejects invalid arguments before the method runs', () => {
    let ran = false;
    class S {
      @Validate((args) => typeof args[0] === 'string' && args[0].length > 0)
      search(_q: string) {
        ran = true;
        return 'ok';
      }
    }
    expect(new S().search('hi')).toBe('ok');
    expect(() => new S().search('')).toThrow(ValidationError);
    ran = false;
    try {
      new S().search('');
    } catch {
      /* ignore */
    }
    expect(ran).toBe(false);
  });
});

describe('@Guardrail', () => {
  it('throws GuardrailError when output fails the check', () => {
    class S {
      @Guardrail((out: number) => out > 0)
      compute() {
        return -1;
      }
    }
    expect(() => new S().compute()).toThrow(GuardrailError);
  });

  it('retries until the output passes', async () => {
    class S {
      tries = 0;
      @Guardrail((out: number) => out >= 3, { retries: 5 })
      async grow() {
        this.tries++;
        return this.tries;
      }
    }
    const s = new S();
    await expect(s.grow()).resolves.toBe(3);
  });
});

describe('@Idempotent', () => {
  it('returns the cached result for the same key', async () => {
    class S {
      calls = 0;
      @Idempotent((req: { id: string }) => req.id)
      async charge(req: { id: string }) {
        this.calls++;
        return `charged:${req.id}`;
      }
    }
    const s = new S();
    const a = await s.charge({ id: 'x' });
    const b = await s.charge({ id: 'x' });
    expect(a).toBe(b);
    expect(s.calls).toBe(1);
    await s.charge({ id: 'y' });
    expect(s.calls).toBe(2);
  });

  it('does not cache failed async calls', async () => {
    class S {
      calls = 0;
      @Idempotent()
      async run() {
        this.calls++;
        throw new Error('fail');
      }
    }
    const s = new S();
    await expect(s.run()).rejects.toThrow('fail');
    await expect(s.run()).rejects.toThrow('fail');
    expect(s.calls).toBe(2);
  });
});

describe('@Meter', () => {
  it('records calls, errors and timing', async () => {
    class S {
      @Meter('work')
      ok() {
        return 1;
      }
      @Meter('work')
      async bad() {
        throw new Error('x');
      }
    }
    const s = new S();
    s.ok();
    s.ok();
    await expect(s.bad()).rejects.toThrow('x');
    const m = getMetrics().work;
    expect(m.calls).toBe(3);
    expect(m.errors).toBe(1);
    expect(m.avgMs).toBeGreaterThanOrEqual(0);
  });
});
