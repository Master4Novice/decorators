import { jest } from '@jest/globals';

jest.mock('config', () => ({
  __esModule: true,
  default: { get: () => undefined },
}));

import {
  ToString,
  Equals,
  With,
  Data,
  Immutable,
  Readonly,
  Synchronized,
  Builder,
  builder,
} from '../src/services/model.js';
import { Secret, Configured } from '../src/services/injection.js';
import { ValidationError } from '../src/services/errors.js';

describe('@ToString', () => {
  it('lists fields and redacts secrets', () => {
    @Configured
    @ToString()
    class User {
      name = 'alice';
      @Secret('PW', 'x') password!: string;
    }
    const s = String(new User());
    expect(s).toMatch(/^User\(/);
    expect(s).toContain('name=alice');
    expect(s).toContain('password=[REDACTED]');
    expect(s).not.toContain('"x"');
  });

  it('honors only/exclude', () => {
    @ToString({ only: ['a'] })
    class C {
      a = 1;
      b = 2;
    }
    expect(String(new C())).toBe('C(a=1)');
  });
});

describe('@Equals', () => {
  it('compares fields of same-constructor instances', () => {
    @Equals()
    class P {
      constructor(
        public x: number,
        public y: number,
      ) {}
      equals!: (o: unknown) => boolean;
    }
    expect(new P(1, 2).equals(new P(1, 2))).toBe(true);
    expect(new P(1, 2).equals(new P(1, 3))).toBe(false);
    expect(new P(1, 2).equals({ x: 1, y: 2 })).toBe(false);
  });
});

describe('@With + @Immutable', () => {
  it('produces a frozen copy with overrides', () => {
    @Immutable
    @With
    class Point {
      constructor(public x = 0, public y = 0) {}
      with!: (p: Partial<Point>) => Point;
    }
    const a = new Point(1, 2);
    expect(Object.isFrozen(a)).toBe(true);
    const b = a.with({ y: 9 });
    expect(b.x).toBe(1);
    expect(b.y).toBe(9);
    expect(Object.isFrozen(b)).toBe(true);
    expect(a.y).toBe(2); // original untouched
  });
});

describe('@Data', () => {
  it('adds toString, equals, and with', () => {
    @Data
    class Box {
      value = 1;
      equals!: (o: unknown) => boolean;
      with!: (p: Partial<Box>) => Box;
    }
    const a = new Box();
    expect(String(a)).toBe('Box(value=1)');
    expect(a.equals(new Box())).toBe(true);
    expect(a.with({ value: 2 }).value).toBe(2);
  });
});

describe('@Readonly', () => {
  it('allows one assignment then throws', () => {
    class C {
      @Readonly id!: string;
    }
    const c = new C();
    c.id = 'first';
    expect(c.id).toBe('first');
    expect(() => {
      c.id = 'second';
    }).toThrow(ValidationError);
  });

  it('works under @Configured with a constructor-set value', () => {
    @Configured
    class C {
      @Readonly id: string;
      constructor() {
        this.id = 'init';
      }
    }
    const c = new C();
    expect(c.id).toBe('init');
    expect(() => {
      c.id = 'again';
    }).toThrow(ValidationError);
  });
});

describe('@Synchronized', () => {
  it('serializes concurrent async calls', async () => {
    const order: string[] = [];
    class Svc {
      @Synchronized
      async task(label: string, ms: number) {
        order.push(`start:${label}`);
        await new Promise((r) => setTimeout(r, ms));
        order.push(`end:${label}`);
      }
    }
    const s = new Svc();
    await Promise.all([s.task('a', 30), s.task('b', 5)]);
    // b cannot start until a ends.
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });
});

describe('builder', () => {
  it('builds via the typed standalone helper', () => {
    class User {
      name = '';
      age = 0;
    }
    const u = builder(User).name('alice').age(30).build();
    expect(u).toBeInstanceOf(User);
    expect(u.name).toBe('alice');
    expect(u.age).toBe(30);
  });

  it('@Builder adds a runtime static builder()', () => {
    @Builder
    class Widget {
      label = '';
    }
    const w = (Widget as any).builder().label('ok').build();
    expect(w.label).toBe('ok');
  });
});
