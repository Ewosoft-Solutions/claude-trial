import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@workspace/database';

/**
 * HTTP Exception Filter
 *
 * Global exception filter that catches and formats all HTTP exceptions
 * and unhandled errors before sending them to the client.
 *
 * Error hygiene: the client only ever receives a toast-ready `message` —
 * internals (exception details, Prisma codes/meta, stack traces, raw
 * unhandled-error messages) are logged server-side and included in the
 * response ONLY when `API_DEBUG_ERRORS=true` is set explicitly. Unset
 * principle: absent the flag, debug payloads are never emitted regardless
 * of NODE_ENV.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /** Opt-in debug payloads. Read per request so tests can toggle it. */
  private get debugErrors(): boolean {
    return process.env.API_DEBUG_ERRORS === 'true';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let details: any = null;
    /** Server-side context for the log line (never sent unless debugging). */
    let internalMessage: string | null = null;

    // Handle known error types
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      // HttpException messages are thrown deliberately (guards, validation
      // pipes…) and are safe for the client — validation errors arrive as a
      // message array the frontend renders per field.
      message =
        typeof errorResponse === 'string'
          ? errorResponse
          : (errorResponse as any).message || message;
      details =
        typeof errorResponse === 'object' && typeof errorResponse !== 'string'
          ? errorResponse
          : null;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma errors — friendly message; code/meta are debug-only.
      status = this.getPrismaErrorStatus(exception);
      message = this.getPrismaErrorMessage(exception);
      details = {
        code: exception.code,
        meta: exception.meta,
      };
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database validation error';
      details = { message: exception.message };
    } else if (exception instanceof Error) {
      // Unhandled error: its raw message may name tables, files, or hosts.
      // Keep the generic message for the client; log the real one.
      internalMessage = exception.message;
    }

    // Log error (always carries the full internal message + stack)
    this.logger.error(
      `Error ${status} on ${request.method} ${request.path}: ${internalMessage ?? String(message)}`,
      exception instanceof Error ? exception.stack : undefined,
      'HttpExceptionFilter',
    );

    // Build error response
    const errorResponse: any = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
    };

    // Debug payloads are opt-in only (API_DEBUG_ERRORS=true).
    if (this.debugErrors) {
      if (details) {
        errorResponse.details = details;
      }
      if (internalMessage) {
        errorResponse.internalMessage = internalMessage;
      }
      if (exception instanceof Error && exception.stack) {
        errorResponse.stack = exception.stack;
      }
    }

    response.status(status).json(errorResponse);
  }

  private getPrismaErrorStatus(
    error: Prisma.PrismaClientKnownRequestError,
  ): HttpStatus {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return HttpStatus.CONFLICT;
      case 'P2025': // Record not found
        return HttpStatus.NOT_FOUND;
      case 'P2003': // Foreign key constraint violation
        return HttpStatus.BAD_REQUEST;
      case 'P2014': // Required relation violation
        return HttpStatus.BAD_REQUEST;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  private getPrismaErrorMessage(
    error: Prisma.PrismaClientKnownRequestError,
  ): string {
    switch (error.code) {
      case 'P2002':
        const target = (error.meta?.target as string[]) || [];
        return `A record with this ${target.join(', ')} already exists`;
      case 'P2025':
        return 'Record not found';
      case 'P2003':
        return 'Invalid reference to related record';
      case 'P2014':
        return 'Required relation is missing';
      default:
        return 'Database operation failed';
    }
  }
}
