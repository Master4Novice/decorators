import { jest } from '@jest/globals';

jest.mock('config', () => ({
  __esModule: true,
  default: { get: () => undefined },
}));

import {
  Trim,
  Lowercase,
  Uppercase,
  Coerce,
  Clamp,
} from '../src/services/transform.js';
import { Min } from '../src/services/constraints.js';
import {
  Email,
  URL,
  UUID,
  Enum,
  NonEmpty,
  Integer,
  Positive,
} from '../src/services/format-validators.js';
import { ValidationError } from '../src/services/errors.js';

describe('transforms', () => {
  it('@Trim trims strings', () => {
    class C {
      @Trim name!: string;
    }
    const c = new C();
    c.name = '  hi  ';
    expect(c.name).toBe('hi');
  });

  it('@Lowercase / @Uppercase normalize case', () => {
    class C {
      @Lowercase a!: string;
      @Uppercase b!: string;
    }
    const c = new C();
    c.a = 'ABC';
    c.b = 'abc';
    expect(c.a).toBe('abc');
    expect(c.b).toBe('ABC');
  });

  it('@Coerce converts types', () => {
    class C {
      @Coerce('number') n!: number;
      @Coerce('boolean') b!: boolean;
    }
    const c = new C();
    (c as { n: unknown }).n = '42';
    (c as { b: unknown }).b = 'true';
    expect(c.n).toBe(42);
    expect(c.b).toBe(true);
  });

  it('@Clamp bounds numbers', () => {
    class C {
      @Clamp(0, 100) v!: number;
    }
    const c = new C();
    c.v = 150;
    expect(c.v).toBe(100);
    c.v = -5;
    expect(c.v).toBe(0);
  });

  it('runs transforms before validators regardless of stacking order', () => {
    class C {
      @Min(3) // length checked AFTER trim
      @Trim
      name!: string;
    }
    const c = new C();
    c.name = '  abcd  ';
    expect(c.name).toBe('abcd');
    expect(() => {
      c.name = '  ab  '; // trims to "ab", length 2 < 3
    }).toThrow(ValidationError);
  });
});

describe('format validators', () => {
  it('@Email', () => {
    class C {
      @Email() email!: string;
    }
    const c = new C();
    c.email = 'a@b.co';
    expect(() => {
      c.email = 'nope';
    }).toThrow(ValidationError);
  });

  it('@URL', () => {
    class C {
      @URL() site!: string;
    }
    const c = new C();
    c.site = 'https://example.com';
    expect(() => {
      c.site = 'not a url';
    }).toThrow(ValidationError);
  });

  it('@UUID', () => {
    class C {
      @UUID() id!: string;
    }
    const c = new C();
    c.id = '550e8400-e29b-41d4-a716-446655440000';
    expect(() => {
      c.id = '123';
    }).toThrow(ValidationError);
  });

  it('@Enum', () => {
    class C {
      @Enum(['queued', 'running', 'done']) status!: string;
    }
    const c = new C();
    c.status = 'running';
    expect(() => {
      c.status = 'paused';
    }).toThrow(ValidationError);
  });

  it('@NonEmpty rejects empty, null, and undefined', () => {
    class C {
      @NonEmpty() name!: string;
    }
    const c = new C();
    c.name = 'x';
    expect(() => {
      c.name = '';
    }).toThrow(ValidationError);
    expect(() => {
      (c as { name?: string }).name = undefined;
    }).toThrow(ValidationError);
  });

  it('@Integer and @Positive', () => {
    class C {
      @Integer() count!: number;
      @Positive() amount!: number;
    }
    const c = new C();
    c.count = 3;
    c.amount = 0.5;
    expect(() => {
      c.count = 1.5;
    }).toThrow(ValidationError);
    expect(() => {
      c.amount = 0;
    }).toThrow(ValidationError);
  });
});
