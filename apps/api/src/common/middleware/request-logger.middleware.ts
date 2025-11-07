import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../logger/logger.service';

/**
 * Request Logger Middleware
 *
 * Logs all incoming requests and outgoing responses with timing information.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';

    // Log request
    this.logger.logRequest(method, originalUrl, ip, userAgent);

    // Capture response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // Log response
      this.logger.logResponse(method, originalUrl, statusCode, duration);

      // Log slow requests
      if (duration > 1000) {
        this.logger.logWarning(
          `Slow request detected: ${method} ${originalUrl} took ${duration}ms`,
          'RequestLoggerMiddleware',
        );
      }
    });

    next();
  }
}
