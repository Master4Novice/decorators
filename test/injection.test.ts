import { jest } from '@jest/globals';

// Deterministic config source for @Value / @Config.
const mockGet = jest.fn();
const mockHas = jest.fn();
jest.mock('config', () => ({
  __esModule: true,
  default: {
    get: (key: string) => mockGet(key),
    has: (key: string) => mockHas(key),
  },
}));

import {
  Value,
  Env,
  Secret,
  Config,
  Default,
  Configured,
  MissingConfigError,
  getSecretKeys,
} from '../src/services/injection.js';

beforeEach(() => {
  mockGet.mockReset();
  delete process.env.PORT;
  delete process.env.DEBUG;
  delete process.env.TAGS;
  delete process.env.JWT_SECRET;
});

describe('@Value', () => {
  it('reads a config key', () => {
    mockGet.mockReturnValue('postgres://db');
    class C {
      @Value('db.url') url!: string;
    }
    expect(new C().url).toBe('postgres://db');
  });

  it('uses the default when the key is missing', () => {
    mockGet.mockImplementation(() => {
      throw new Error('missing');
    });
    class C {
      @Value('db.url', 'sqlite://memory') url!: string;
    }
    expect(new C().url).toBe('sqlite://memory');
  });

  it('throws MissingConfigError when required and absent', () => {
    mockGet.mockImplementation(() => {
      throw new Error('missing');
    });
    class C {
      @Value('db.url') url!: string;
    }
    expect(() => new C().url).toThrow(MissingConfigError);
  });
});

describe('@Env', () => {
  it('coerces to number when the default is a number', () => {
    process.env.PORT = '5432';
    class C {
      @Env('PORT', 3000) port!: number;
    }
    expect(new C().port).toBe(5432);
  });

  it('coerces to boolean when the default is a boolean', () => {
    process.env.DEBUG = 'true';
    class C {
      @Env('DEBUG', false) debug!: boolean;
    }
    expect(new C().debug).toBe(true);
  });

  it('comma-splits to an array when the default is an array', () => {
    process.env.TAGS = 'a, b ,c';
    class C {
      @Env('TAGS', [] as string[]) tags!: string[];
    }
    expect(new C().tags).toEqual(['a', 'b', 'c']);
  });

  it('falls back to the default when unset', () => {
    class C {
      @Env('PORT', 3000) port!: number;
    }
    expect(new C().port).toBe(3000);
  });

  it('throws when required and unset', () => {
    class C {
      @Env('PORT') port!: string;
    }
    expect(() => new C().port).toThrow(MissingConfigError);
  });
});

describe('@Secret', () => {
  it('reads from env and registers the property as a secret', () => {
    process.env.JWT_SECRET = 's3cr3t';
    class C {
      @Secret('JWT_SECRET') jwtSecret!: string;
    }
    expect(new C().jwtSecret).toBe('s3cr3t');
    expect(getSecretKeys()).toContain('jwtSecret');
  });
});

describe('@Default', () => {
  it('injects a literal value', () => {
    class C {
      @Default(42) answer!: number;
    }
    expect(new C().answer).toBe(42);
  });
});

describe('@Config', () => {
  it('injects a config subtree', () => {
    mockGet.mockReturnValue({ host: 'localhost', port: 6379 });
    class C {
      @Config('redis') redis!: { host: string; port: number };
    }
    expect(new C().redis).toEqual({ host: 'localhost', port: 6379 });
  });

  it('throws when the path is missing', () => {
    mockGet.mockImplementation(() => {
      throw new Error('missing');
    });
    class C {
      @Config('redis') redis!: unknown;
    }
    expect(() => new C().redis).toThrow(MissingConfigError);
  });
});

describe('@Configured', () => {
  it('materializes own instance properties', () => {
    mockGet.mockReturnValue('app');
    process.env.PORT = '8080';
    @Configured
    class App {
      @Value('app.name') name!: string;
      @Env('PORT', 3000) port!: number;
    }
    const app = new App();
    expect(app.name).toBe('app');
    expect(app.port).toBe(8080);
    expect(Object.prototype.hasOwnProperty.call(app, 'port')).toBe(true);
  });

  it('preserves the original class name', () => {
    @Configured
    class AppConfig {
      @Default(1) x!: number;
    }
    expect(AppConfig.name).toBe('AppConfig');
  });

  it('fails loud at construction when a required value is missing', () => {
    mockGet.mockImplementation(() => {
      throw new Error('missing');
    });
    @Configured
    class App {
      @Value('app.name') name!: string;
    }
    expect(() => new App()).toThrow(MissingConfigError);
  });
});
