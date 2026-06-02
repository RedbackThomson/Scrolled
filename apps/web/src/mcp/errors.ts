// Structured error types thrown from tool implementations. The dispatcher
// catches these and serializes them into the `ToolError` envelope shape; any
// other thrown value becomes `InternalError` with the stringified message,
// so a tool's runtime bug surfaces as a typed wire error rather than a
// transport-level crash.

import type { ErrorCode } from '@scrolled/mcp-protocol';

export class ToolExecutionError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ToolExecutionError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ToolExecutionError {
  constructor(message: string, details?: unknown) {
    super('ValidationError', message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ToolExecutionError {
  constructor(message: string, details?: unknown) {
    super('NotFoundError', message, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ToolExecutionError {
  constructor(message: string, details?: unknown) {
    super('ConflictError', message, details);
    this.name = 'ConflictError';
  }
}

export class OperationError extends ToolExecutionError {
  constructor(message: string, details?: unknown) {
    super('OperationError', message, details);
    this.name = 'OperationError';
  }
}

export class UnsupportedError extends ToolExecutionError {
  constructor(message: string, details?: unknown) {
    super('UnsupportedError', message, details);
    this.name = 'UnsupportedError';
  }
}

export function isToolExecutionError(value: unknown): value is ToolExecutionError {
  return value instanceof ToolExecutionError;
}
