export class MessagingError extends Error {
  readonly code: string;
  readonly isRetryable: boolean;

  constructor(message: string, code: string, isRetryable = false) {
    super(message);
    this.name = 'MessagingError';
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

export class MessagingConfigurationError extends MessagingError {
  constructor(message: string) {
    super(message, 'MESSAGING_CONFIGURATION_ERROR', false);
    this.name = 'MessagingConfigurationError';
  }
}

export class MessagingConnectionError extends MessagingError {
  constructor(message: string) {
    super(message, 'MESSAGING_CONNECTION_ERROR', true);
    this.name = 'MessagingConnectionError';
  }
}

export class MessagingPublishError extends MessagingError {
  constructor(message: string, isRetryable = true) {
    super(message, 'MESSAGING_PUBLISH_ERROR', isRetryable);
    this.name = 'MessagingPublishError';
  }
}

export class MessagingValidationError extends MessagingError {
  constructor(message: string) {
    super(message, 'MESSAGING_VALIDATION_ERROR', false);
    this.name = 'MessagingValidationError';
  }
}

export class MessagingScheduleError extends MessagingError {
  constructor(message: string, isRetryable = true) {
    super(message, 'MESSAGING_SCHEDULE_ERROR', isRetryable);
    this.name = 'MessagingScheduleError';
  }
}
