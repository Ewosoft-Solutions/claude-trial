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
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;

    // Handle known error types
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      message =
        typeof errorResponse === 'string'
          ? errorResponse
          : (errorResponse as any).message || message;
      details =
        typeof errorResponse === 'object' && typeof errorResponse !== 'string'
          ? errorResponse
          : null;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma errors
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
      message = exception.message;
    }

    // Log error
    this.logger.error(
      `Error ${status} on ${request.method} ${request.path}: ${message}`,
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

    if (details) {
      errorResponse.details = details;
    }

    // Include stack trace in development
    if (
      process.env.NODE_ENV === 'development' &&
      exception instanceof Error &&
      exception.stack
    ) {
      errorResponse.stack = exception.stack;
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
