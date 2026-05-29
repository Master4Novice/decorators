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
    expect(mockError).not.toHaveBeenCalled();
  });

  // NOTE: current behavior is "log, then still run" — it does NOT guard/throw.
  // Pinned here intentionally; changing to throw is a Phase-3 decision.
  it('logs an error for null/undefined args but still executes', () => {
    class Svc {
      @NotNull
      greet(name: string | null) {
        return `hi ${name}`;
      }
    }
    expect(new Svc().greet(null)).toBe('hi null');
    expect(mockError).toHaveBeenCalled();
  });
});

describe('@ValidDate', () => {
  // KNOWN BUG (pinned, see KNOWN_ISSUES.md): @ValidDate assigns `target[key]`
  // directly instead of returning/mutating the method descriptor. TypeScript's
  // __decorate re-applies the original descriptor afterwards, clobbering the
  // wrapper — so in published v1.x @ValidDate performs NO validation. These
  // tests pin that real (no-op) behavior; fixing it is a Phase-3 change that
  // requires sign-off because it alters published behavior.
  it('does not throw and returns the original result for a valid date', () => {
    class Svc {
      @ValidDate
      check(_d: { DD: string; MM: string; YYYY: string }) {
        return 'ok';
      }
    }
    expect(new Svc().check({ DD: '15', MM: '06', YYYY: '2024' })).toBe('ok');
    expect(mockError).not.toHaveBeenCalled();
  });

  it('currently does NOT validate: no error is logged even for an invalid date', () => {
    class Svc {
      @ValidDate
      check(_d: { DD: string; MM: string; YYYY: string }) {
        return 'ran';
      }
    }
    expect(new Svc().check({ DD: '32', MM: '13', YYYY: '2024' })).toBe('ran');
    // No error logged — the decorator is a no-op in v1.x (known bug).
    expect(mockError).not.toHaveBeenCalled();
  });
});

describe('@Log', () => {
  it('logs entry/exit and returns the original result', () => {
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
});
