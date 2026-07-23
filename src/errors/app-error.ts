/**
 * Base operational error for HTTP responses.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational = true;
  readonly errors?: Array<{ field: string; message: string }> | undefined;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Resource was not found.
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * Request failed validation.
 */
export class ValidationError extends AppError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(message, 400, 'VALIDATION_ERROR', errors);
  }
}

/**
 * Caller is not authenticated.
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}
