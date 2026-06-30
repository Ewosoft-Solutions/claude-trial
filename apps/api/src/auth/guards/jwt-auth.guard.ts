/**
 * JWT Auth Guard
 *
 * Validates JWT tokens with school-specific secrets.
 * Part of multi-layer validation (3.9).
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
// import { JwtService } from '@nestjs/jwt';
// import { JWTSecretService } from '@workspace/api';
import { AuthJWTService } from '../services/jwt.service';
import { RequestUser } from '../types/request-user';
import { DatabaseService, extractBearerToken } from '../../common';

/**
 * JWT Auth Guard
 *
 * Validates JWT access tokens and extracts tenant context.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    // private readonly jwtService: JwtService,
    private readonly authJWTService: AuthJWTService,
    private readonly dbService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Decode token to get tenant ID (without verification)
    const decoded = this.authJWTService.decodeToken(token);
    if (!decoded?.tenantId) {
      // A pre-auth token (issued by POST /auth/login before school
      // selection) decodes fine but never carries a tenantId — surface
      // that distinctly instead of a generic "invalid format", since
      // it's the #1 cause of this guard rejecting an otherwise-real token.
      if (decoded?.type === 'pre_auth') {
        throw new UnauthorizedException(
          'This is a pre-auth token (no school selected yet). Exchange it via POST /auth/select-school for an access token first.',
        );
      }
      throw new UnauthorizedException('Invalid token format');
    }

    const prisma = this.dbService.client;

    // Validate token with school-specific secret (3.7)
    const payload = await this.authJWTService.validateAccessToken(
      prisma,
      token,
      decoded.tenantId,
    );

    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Attach user and tenant context to request
    request.user = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      profileId: payload.profileId,
      roleId: payload.roleId,
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    return extractBearerToken(request.headers.authorization);
  }
}
