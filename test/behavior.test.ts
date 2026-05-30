import { jest } from '@jest/globals';

jest.mock('config', () => ({
  __esModule: true,
  default: { get: () => undefined },
}));

import { Bind, Lazy, Sealed, Mixin, OnChange } from '../src/services/behavior.js';
import { Configured } from '../src/services/injection.js';

describe('@Bind', () => {
  it('keeps `this` when the method is detached', () => {
    class C {
      value = 42;
      @Bind
      get() {
        return this.value;
      }
    }
    const c = new C();
    const fn = c.get;
    expect(fn()).toBe(42);
  });
});

describe('@Lazy', () => {
  it('computes once on first access and caches', () => {
    let calls = 0;
    class C {
      @Lazy(() => {
        calls++;
        return 'value';
      })
      heavy!: string;
    }
    const c = new C();
    expect(c.heavy).toBe('value');
    expect(c.heavy).toBe('value');
    expect(calls).toBe(1);
  });

  it('works under @Configured', () => {
    let calls = 0;
    @Configured
    class C {
      @Lazy(() => {
        calls++;
        return 7;
      })
      n!: number;
    }
    const c = new C();
    expect(c.n).toBe(7);
    expect(c.n).toBe(7);
    expect(calls).toBe(1);
  });
});

describe('@Sealed', () => {
  it('prevents adding new properties', () => {
    @Sealed
    class C {
      x = 1;
    }
    const c = new C() as any;
    expect(Object.isSealed(c)).toBe(true);
    c.x = 2; // existing stays writable
    expect(c.x).toBe(2);
    expect(() => {
      'use strict';
      c.y = 9; // adding throws in strict mode
    }).toThrow();
  });
});

describe('@Mixin', () => {
  it('copies members from sources onto the class', () => {
    const Timestamped = {
      touch(this: any) {
        this.updatedAt = 'now';
        return this;
      },
    };
    @Mixin(Timestamped)
    class Entity {
      updatedAt = '';
    }
    const e = new Entity() as Entity & { touch(): Entity };
    e.touch();
    expect(e.updatedAt).toBe('now');
  });
});

describe('@OnChange', () => {
  it('fires the handler on a real change', () => {
    const seen: Array<[unknown, unknown]> = [];
    class Form {
      @OnChange((n, o) => seen.push([o, n]))
      draft = '';
    }
    const f = new Form();
    f.draft = 'a';
    f.draft = 'a'; // no change -> no fire
    f.draft = 'b';
    expect(seen).toEqual([
      ['', 'a'],
      ['a', 'b'],
    ]);
  });

  it('does not re-fire for the constructor value under @Configured', () => {
    const seen: unknown[] = [];
    @Configured
    class Form {
      @OnChange((n) => seen.push(n))
      name: string;
      constructor() {
        this.name = 'init';
      }
    }
    const f = new Form();
    expect(f.name).toBe('init');
    // The 'init' assignment happened before materialization; the seed must not
    // re-fire the handler.
    const beforeChange = seen.length;
    f.name = 'changed';
    expect(seen[seen.length - 1]).toBe('changed');
    expect(seen.length).toBe(beforeChange + 1);
  });
});
