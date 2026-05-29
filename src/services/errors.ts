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
