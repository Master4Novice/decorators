import { Role, Authorize, setRoleResolver } from '../src/services/access.js';
import { ForbiddenError } from '../src/services/errors.js';

describe('@Role', () => {
  it('allows the call when the principal has an allowed role', () => {
    setRoleResolver(() => ['admin']);
    class Api {
      @Role('admin', 'owner')
      remove() {
        return 'removed';
      }
    }
    expect(new Api().remove()).toBe('removed');
  });

  it('throws ForbiddenError when the principal lacks the role', () => {
    setRoleResolver(() => ['user']);
    class Api {
      @Role('admin')
      remove() {
        return 'removed';
      }
    }
    expect(() => new Api().remove()).toThrow(ForbiddenError);
  });

  it('reads roles from the instance via the resolver context', () => {
    setRoleResolver((ctx) => (ctx.instance as { roles: string[] }).roles);
    class Api {
      roles = ['editor'];
      @Role('editor')
      edit() {
        return 'edited';
      }
    }
    expect(new Api().edit()).toBe('edited');
  });

  it('supports async resolvers (returns a promise)', async () => {
    setRoleResolver(async () => ['admin']);
    class Api {
      @Role('admin')
      async remove() {
        return 'removed';
      }
    }
    await expect(new Api().remove()).resolves.toBe('removed');
  });

  it('throws when no resolver is configured', () => {
    setRoleResolver(undefined as never);
    class Api {
      @Role('admin')
      remove() {
        return 'removed';
      }
    }
    expect(() => new Api().remove()).toThrow(ForbiddenError);
  });
});

describe('@Authorize', () => {
  it('allows when the predicate is truthy', () => {
    class Api {
      @Authorize(() => true)
      read() {
        return 'data';
      }
    }
    expect(new Api().read()).toBe('data');
  });

  it('throws ForbiddenError when the predicate is falsy', () => {
    class Api {
      @Authorize(() => false, 'nope')
      read() {
        return 'data';
      }
    }
    expect(() => new Api().read()).toThrow(ForbiddenError);
  });

  it('supports async predicates', async () => {
    class Api {
      @Authorize(async () => true)
      async read() {
        return 'data';
      }
    }
    await expect(new Api().read()).resolves.toBe('data');
  });
});
