import { jest } from '@jest/globals';

jest.mock('config', () => ({
  __esModule: true,
  default: { get: () => undefined },
}));

import {
  NotBlank,
  Size,
  Negative,
  PositiveOrZero,
  NegativeOrZero,
  Past,
  Future,
  AssertTrue,
  AssertFalse,
  Digits,
} from '../src/services/value-guards.js';
import { ValidationError } from '../src/services/errors.js';

describe('@NotBlank', () => {
  it('rejects blank/whitespace/null', () => {
    class C {
      @NotBlank() name!: string;
    }
    const c = new C();
    c.name = 'ok';
    expect(() => {
      c.name = '   ';
    }).toThrow(ValidationError);
    expect(() => {
      (c as { name?: string }).name = undefined;
    }).toThrow(ValidationError);
  });
});

describe('@Size', () => {
  it('checks string/array length bounds', () => {
    class C {
      @Size(2, 4) tag!: string;
    }
    const c = new C();
    c.tag = 'abc';
    expect(() => {
      c.tag = 'a';
    }).toThrow(ValidationError);
    expect(() => {
      c.tag = 'abcde';
    }).toThrow(ValidationError);
  });
});

describe('number sign constraints', () => {
  it('@Negative / @PositiveOrZero / @NegativeOrZero', () => {
    class C {
      @Negative() a!: number;
      @PositiveOrZero() b!: number;
      @NegativeOrZero() c!: number;
    }
    const o = new C();
    o.a = -1;
    o.b = 0;
    o.c = 0;
    expect(() => {
      o.a = 0;
    }).toThrow(ValidationError);
    expect(() => {
      o.b = -1;
    }).toThrow(ValidationError);
    expect(() => {
      o.c = 1;
    }).toThrow(ValidationError);
  });
});

describe('date constraints', () => {
  it('@Past and @Future', () => {
    class C {
      @Past() born!: Date;
      @Future() expires!: Date;
    }
    const o = new C();
    o.born = new Date(Date.now() - 100000);
    o.expires = new Date(Date.now() + 100000);
    expect(() => {
      o.born = new Date(Date.now() + 100000);
    }).toThrow(ValidationError);
    expect(() => {
      o.expires = new Date(Date.now() - 100000);
    }).toThrow(ValidationError);
  });
});

describe('boolean assertions', () => {
  it('@AssertTrue / @AssertFalse', () => {
    class C {
      @AssertTrue() agreed!: boolean;
      @AssertFalse() banned!: boolean;
    }
    const o = new C();
    o.agreed = true;
    o.banned = false;
    expect(() => {
      o.agreed = false;
    }).toThrow(ValidationError);
    expect(() => {
      o.banned = true;
    }).toThrow(ValidationError);
  });
});

describe('@Digits', () => {
  it('limits integer and fraction digits', () => {
    class C {
      @Digits(3, 2) price!: number;
    }
    const o = new C();
    o.price = 123.45;
    o.price = 7;
    expect(() => {
      o.price = 1234;
    }).toThrow(ValidationError);
    expect(() => {
      o.price = 1.234;
    }).toThrow(ValidationError);
  });
});
