/** Thrown by validation decorators (`@NotNull`, `@ValidDate`) on invalid input. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Thrown by access decorators (`@Role`, `@Authorize`) when access is denied. */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Thrown by `@Timeout` when a method exceeds its time budget. */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Thrown by `@RateLimit` when the call rate exceeds the configured limit. */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Thrown by `@CircuitBreaker` while the circuit is open. */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
