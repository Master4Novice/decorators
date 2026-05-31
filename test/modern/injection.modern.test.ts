import { jest } from '@jest/globals';

// This suite is compiled with useDefineForClassFields: true (target ES2022) —
// the modern default. Under this setting, class fields become OWN instance data
// properties that shadow prototype accessors. @Configured must still work
// because it defines own instance properties AFTER the field initializers run.

const mockGet = jest.fn();
jest.mock('config', () => ({
  __esModule: true,
  default: { get: (key: string) => mockGet(key) },
}));

import { Env, Default, Configured } from '../../src/services/injection.js';
import { Value } from '../../src/config.js';

beforeEach(() => {
  mockGet.mockReset();
  delete process.env.PORT;
});

describe('@Configured under useDefineForClassFields: true', () => {
  it('still injects @Value / @Env / @Default correctly', () => {
    mockGet.mockReturnValue('modern-app');
    process.env.PORT = '9090';

    @Configured
    class AppConfig {
      @Value('app.name') name!: string;
      @Env('PORT', 3000) port!: number;
      @Default('v1') apiVersion!: string;
    }

    const cfg = new AppConfig();
    expect(cfg.name).toBe('modern-app');
    expect(cfg.port).toBe(9090);
    expect(cfg.apiVersion).toBe('v1');
  });

  it('documents the footgun: a bare property decorator (no @Configured) is shadowed', () => {
    mockGet.mockReturnValue('should-be-shadowed');

    class NotConfigured {
      @Value('app.name') name!: string;
    }

    // Under useDefineForClassFields:true, the own field initializer shadows the
    // prototype accessor, so injection silently yields undefined. This is
    // exactly why @Configured exists; pinned here so the contract is explicit.
    expect(new NotConfigured().name).toBeUndefined();
  });
});
