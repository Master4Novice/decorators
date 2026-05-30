import { jest } from '@jest/globals';

// Compiled with useDefineForClassFields: true. @Pattern alone would be shadowed
// here (like any property decorator); @Configured restores validation by
// installing an own instance accessor after field initialization.

jest.mock('config', () => ({
  __esModule: true,
  default: { get: () => undefined },
}));

import { Pattern } from '../../src/services/pattern.js';
import { Configured } from '../../src/services/injection.js';
import { ValidationError } from '../../src/services/errors.js';

describe('@Pattern under @Configured (useDefineForClassFields: true)', () => {
  it('validates assignments on the materialized accessor', () => {
    @Configured
    class User {
      @Pattern(/^[a-z]+$/) name!: string;
    }
    const u = new User();
    u.name = 'erin';
    expect(u.name).toBe('erin');
    expect(() => {
      u.name = 'NOPE1';
    }).toThrow(ValidationError);
  });

  it('throws for an invalid value assigned in the constructor', () => {
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
