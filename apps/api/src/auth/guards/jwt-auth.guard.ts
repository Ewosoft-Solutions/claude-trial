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
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@workspace/database';
import { JWTSecretService } from '@workspace/api/tenant/jwt';
import { AuthJWTService, JWTPayload } from '../services/jwt.service';

/**
 * JWT Auth Guard
 *
 * Validates JWT access tokens and extracts tenant context.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authJWTService: AuthJWTService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Decode token to get tenant ID (without verification)
    const decoded = this.authJWTService.decodeToken(token);
    if (!decoded || !decoded.tenantId) {
      throw new UnauthorizedException('Invalid token format');
    }

    // Get Prisma client (should be injected via module)
    // For now, we'll need to get it from the request or context
    // This is a simplified version - in production, inject PrismaService
    const prisma = this.getPrismaFromContext(context);

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
      roles: payload.roles,
    };

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private getPrismaFromContext(context: ExecutionContext): PrismaClient {
    // This is a simplified version
    // In production, inject PrismaService via NestJS dependency injection
    // For now, we'll need to get it from the request or module
    const request = context.switchToHttp().getRequest();
    return request.prisma || (global as any).prisma;
  }
}
