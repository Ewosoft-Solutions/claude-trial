import { Injectable, Logger } from '@nestjs/common';

/**
 * Logger Service
 *
 * Application-wide logging service with structured logging capabilities.
 */
@Injectable()
export class LoggerService extends Logger {
  /**
   * Log request information
   */
  logRequest(method: string, url: string, ip?: string, userAgent?: string) {
    this.log(`[REQUEST] ${method} ${url}`, {
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log response information
   */
  logResponse(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
  ) {
    this.log(`[RESPONSE] ${method} ${url} ${statusCode} ${duration}ms`, {
      statusCode,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log error with context
   */
  logError(message: string, trace?: string, context?: string) {
    super.error(message, trace, context);
  }

  /**
   * Log warning with context
   */
  logWarning(message: string, context?: string) {
    super.warn(message, context);
  }

  /**
   * Log debug information
   */
  logDebug(message: string, context?: string) {
    super.debug(message, context);
  }
}
