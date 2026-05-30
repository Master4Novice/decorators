import { jest } from '@jest/globals';

jest.mock('config', () => ({
  __esModule: true,
  default: { get: () => undefined },
}));

import { Pattern } from '../src/services/pattern.js';
import { Configured } from '../src/services/injection.js';
import { ValidationError } from '../src/services/errors.js';

describe('@Pattern (standalone)', () => {
  it('accepts a matching assignment', () => {
    class User {
      @Pattern(/^[a-z]+$/) name!: string;
    }
    const u = new User();
    u.name = 'alice';
    expect(u.name).toBe('alice');
  });

  it('throws ValidationError on a non-matching assignment and keeps the old value', () => {
    class User {
      @Pattern(/^[a-z]+$/) name!: string;
    }
    const u = new User();
    u.name = 'alice';
    expect(() => {
      u.name = 'Bob123';
    }).toThrow(ValidationError);
    expect(u.name).toBe('alice');
  });

  it('allows null/undefined (optional field)', () => {
    class User {
      @Pattern(/^[a-z]+$/) name!: string;
    }
    const u = new User();
    expect(u.name).toBeUndefined();
    expect(() => {
      (u as { name?: string }).name = undefined;
    }).not.toThrow();
  });

  it('uses a custom message', () => {
    class User {
      @Pattern(/^\d+$/, { message: 'digits only' }) code!: string;
    }
    expect(() => {
      new User().code = 'x';
    }).toThrow('digits only');
  });

  it('coerces non-strings when coerce: true', () => {
    class User {
      @Pattern(/^\d{6}$/, { coerce: true }) pin!: number;
    }
    const u = new User();
    u.pin = 560001;
    expect(u.pin).toBe(560001);
    expect(() => {
      u.pin = 12;
    }).toThrow(ValidationError);
  });

  it('rejects non-string values without coerce', () => {
    class User {
      @Pattern(/^\d+$/) code!: string;
    }
    expect(() => {
      (new User() as { code: unknown }).code = 123;
    }).toThrow(ValidationError);
  });
});

describe('@Pattern under @Configured', () => {
  it('validates assignments on the materialized instance accessor', () => {
    @Configured
    class User {
      @Pattern(/^[a-z]+$/) name!: string;
    }
    const u = new User();
    u.name = 'carol';
    expect(u.name).toBe('carol');
    expect(() => {
      u.name = 'NOPE';
    }).toThrow(ValidationError);
  });

  it('preserves and re-validates a value set in the constructor', () => {
    @Configured
    class Ok {
      @Pattern(/^[a-z]+$/) name: string;
      constructor() {
        this.name = 'dave';
      }
    }
    expect(new Ok().name).toBe('dave');

    @Configured
    class Bad {
      @Pattern(/^[a-z]+$/) name: string;
      constructor() {
        this.name = 'BAD1';
      }
    }
    expect(() => new Bad()).toThrow(ValidationError);
  });
});
