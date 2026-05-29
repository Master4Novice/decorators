import { jest } from '@jest/globals';

// Mock the winston logger so we can assert on error/info calls without noise.
const mockError = jest.fn();
const mockInfo = jest.fn();
jest.mock('../src/utilities/logger.js', () => ({
  __esModule: true,
  logger: {
    error: (msg: string) => mockError(msg),
    info: (msg: string) => mockInfo(msg),
  },
}));

import {
  GenerateID,
  NotNull,
  ValidDate,
  Counter,
  Log,
} from '../src/services/property.js';
import { ValidationError } from '../src/services/errors.js';

beforeEach(() => {
  mockError.mockReset();
  mockInfo.mockReset();
});

describe('@GenerateID', () => {
  it('assigns a uuid and keeps it stable across reads', () => {
    class Entity {
      @GenerateID
      id!: string;
    }
    const e = new Entity();
    const first = e.id;
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(e.id).toBe(first);
  });
});

describe('@Counter', () => {
  it('increments on every access', () => {
    class Hits {
      @Counter
      static count: number;
    }
    expect((Hits as any).count).toBe(1);
    expect((Hits as any).count).toBe(2);
    expect((Hits as any).count).toBe(3);
  });
});

describe('@NotNull', () => {
  it('runs the method normally for valid arguments', () => {
    class Svc {
      @NotNull
      greet(name: string) {
        return `hi ${name}`;
      }
    }
    expect(new Svc().greet('a')).toBe('hi a');
  });

  it('throws ValidationError for null/undefined args (1.3.0: now throws)', () => {
    class Svc {
      @NotNull
      greet(name: string | null) {
        return `hi ${name}`;
      }
    }
    expect(() => new Svc().greet(null)).toThrow(ValidationError);
  });
});

describe('@ValidDate', () => {
  it('runs and returns the result for a valid date', () => {
    class Svc {
      @ValidDate
      check(_d: { DD: string; MM: string; YYYY: string }) {
        return 'ok';
      }
    }
    expect(new Svc().check({ DD: '15', MM: '06', YYYY: '2024' })).toBe('ok');
  });

  it('throws ValidationError for an invalid date (1.3.0: bug fixed)', () => {
    class Svc {
      @ValidDate
      check(_d: { DD: string; MM: string; YYYY: string }) {
        return 'ran';
      }
    }
    expect(() => new Svc().check({ DD: '32', MM: '13', YYYY: '2024' })).toThrow(
      ValidationError,
    );
  });

  it('allows an undefined first argument', () => {
    class Svc {
      @ValidDate
      check(_d?: { DD: string; MM: string; YYYY: string }) {
        return 'ok';
      }
    }
    expect(new Svc().check()).toBe('ok');
  });
});

describe('@Log', () => {
  it('logs entry/exit and returns the original result (no options)', () => {
    class Svc {
      @Log()
      add(a: number, b: number) {
        return a + b;
      }
    }
    expect(new Svc().add(2, 3)).toBe(5);
    expect(mockInfo).toHaveBeenCalledWith('Entering add');
    expect(mockInfo).toHaveBeenCalledWith('Exiting add');
  });

  it('logs redacted arguments when args: true', () => {
    class Svc {
      @Log({ args: true })
      charge(card: { number: string; cvv: string }) {
        return 'ok';
      }
    }
    new Svc().charge({ number: '4111', cvv: '999' });
    const entry = mockInfo.mock.calls
      .map((c) => String(c[0]))
      .find((m) => m.startsWith('Entering'))!;
    expect(entry).toContain('"cvv":"[REDACTED]"');
    expect(entry).not.toContain('999');
  });

  it('logs the result when result: true', () => {
    class Svc {
      @Log({ result: true })
      add(a: number, b: number) {
        return a + b;
      }
    }
    new Svc().add(2, 3);
    expect(mockInfo).toHaveBeenCalledWith('Exiting add result=5');
  });

  it('awaits and logs async results', async () => {
    class Svc {
      @Log({ result: true })
      async fetch() {
        return { token: 'abc', ok: true };
      }
    }
    await new Svc().fetch();
    const exit = mockInfo.mock.calls
      .map((c) => String(c[0]))
      .find((m) => m.startsWith('Exiting'))!;
    expect(exit).toContain('"token":"[REDACTED]"');
    expect(exit).toContain('"ok":true');
  });
});
