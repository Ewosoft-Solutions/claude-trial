/**
 * Pre-Auth Guard
 *
 * Validates pre-authentication JWT tokens issued after login
 * but before school selection. These tokens are signed with the
 * global JWT_SECRET and contain only the user ID.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthJWTService } from '../services/jwt.service';
import { extractBearerToken } from '../../common';

interface PreAuthRequestUser {
  userId: string;
}

@Injectable()
export class PreAuthGuard implements CanActivate {
  constructor(private readonly authJWTService: AuthJWTService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: PreAuthRequestUser }>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const payload = await this.authJWTService.validatePreAuthToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid or expired pre-auth token');
    }

    request.user = { userId: payload.sub };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    return extractBearerToken(request.headers.authorization);
  }
}
