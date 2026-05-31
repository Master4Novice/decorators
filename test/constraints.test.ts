import { jest } from '@jest/globals';

jest.mock('config', () => ({
  __esModule: true,
  default: { get: () => undefined },
}));

import { Min, Max, Range } from '../src/services/constraints.js';
import { Pattern } from '../src/services/pattern.js';
import { ValidationError } from '../src/services/errors.js';

describe('@Min', () => {
  it('checks string length', () => {
    class U {
      @Min(3) name!: string;
    }
    const u = new U();
    u.name = 'abc';
    expect(u.name).toBe('abc');
    expect(() => {
      u.name = 'ab';
    }).toThrow(ValidationError);
    expect(u.name).toBe('abc'); // keeps previous value
  });

  it('checks numeric value', () => {
    class U {
      @Min(18) age!: number;
    }
    const u = new U();
    u.age = 18;
    expect(u.age).toBe(18);
    expect(() => {
      u.age = 17;
    }).toThrow(ValidationError);
  });

  it('rejects NaN across @Min/@Max/@Range (no silent accept)', () => {
    class U {
      @Min(0) a!: number;
      @Max(10) b!: number;
      @Range(0, 10) c!: number;
    }
    const u = new U();
    expect(() => {
      u.a = NaN;
    }).toThrow(ValidationError);
    expect(() => {
      u.b = NaN;
    }).toThrow(ValidationError);
    expect(() => {
      u.c = NaN;
    }).toThrow(ValidationError);
  });

  it('checks array length and allows null/undefined', () => {
    class U {
      @Min(2) tags!: string[];
    }
    const u = new U();
    u.tags = ['a', 'b'];
    expect(u.tags).toEqual(['a', 'b']);
    expect(() => {
      u.tags = ['a'];
    }).toThrow(ValidationError);
    expect(() => {
      (u as { tags?: string[] }).tags = undefined;
    }).not.toThrow();
  });
});

describe('@Max', () => {
  it('checks string length and number value', () => {
    class U {
      @Max(5) code!: string;
      @Max(100) score!: number;
    }
    const u = new U();
    u.code = 'abcde';
    u.score = 100;
    expect(() => {
      u.code = 'abcdef';
    }).toThrow(ValidationError);
    expect(() => {
      u.score = 101;
    }).toThrow(ValidationError);
  });
});

describe('@Range', () => {
  it('enforces inclusive bounds on string length', () => {
    class U {
      @Range(3, 6) username!: string;
    }
    const u = new U();
    u.username = 'abc';
    u.username = 'abcdef';
    expect(u.username).toBe('abcdef');
    expect(() => {
      u.username = 'ab';
    }).toThrow(ValidationError);
    expect(() => {
      u.username = 'abcdefg';
    }).toThrow(ValidationError);
  });

  it('uses a custom message', () => {
    class U {
      @Range(1, 2, { message: 'out of range' }) v!: number;
    }
    expect(() => {
      new U().v = 5;
    }).toThrow('out of range');
  });
});

describe('composition (@Min + @Max + @Pattern on one property)', () => {
  it('applies every validator', () => {
    class U {
      @Pattern(/^[a-z]+$/)
      @Min(3)
      @Max(6)
      username!: string;
    }
    const u = new U();
    u.username = 'alice';
    expect(u.username).toBe('alice');

    expect(() => {
      u.username = 'ab';
    }).toThrow(ValidationError); // too short
    expect(() => {
      u.username = 'abcdefg';
    }).toThrow(ValidationError); // too long
    expect(() => {
      u.username = 'Alice';
    }).toThrow(ValidationError); // pattern (uppercase)

    expect(u.username).toBe('alice'); // unchanged after failures
  });
});
