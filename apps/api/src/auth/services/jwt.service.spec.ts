/**
 * JWT Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthJWTService, JWTPayload } from './jwt.service';
import { JWTSecretService } from '@workspace/api';
import {
  createMockContext,
  createPrismaClientProvider,
} from '../../common/__tests__/test-utils';
import { PrismaClient } from '@workspace/database';
import { DeepMockProxy } from 'jest-mock-extended';

// Mock JWTSecretService
jest.mock('@workspace/api', () => ({
  ...(jest.requireActual('@workspace/api') as Record<string, unknown>),
  JWTSecretService: {
    getTenantJWTSecretInternal: jest.fn(),
  },
}));

describe('AuthJWTService', () => {
  let service: AuthJWTService;
  let jwtService: jest.Mocked<JwtService>;
  let module: TestingModule;
  let mockPrisma: DeepMockProxy<PrismaClient>;
  const mockJWTSecretService = JWTSecretService as jest.Mocked<
    typeof JWTSecretService
  >;

  beforeEach(async () => {
    const mockCtx = createMockContext();
    mockPrisma = mockCtx.prisma;
    mockJWTSecretService.getTenantJWTSecretInternal.mockResolvedValue(
      'test-secret-key',
    );

    const mockJwtService = {
      signAsync: jest.fn<JwtService['signAsync']>(),
      verifyAsync: jest.fn<JwtService['verifyAsync']>(),
      decode: jest.fn<JwtService['decode']>(),
    };

    module = await Test.createTestingModule({
      providers: [
        AuthJWTService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        createPrismaClientProvider(mockPrisma),
      ],
    }).compile();

    service = module.get<AuthJWTService>(AuthJWTService);
    jwtService = module.get<JwtService>(JwtService) as jest.Mocked<JwtService>;
  });

  afterEach(async () => {
    await module.close();
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload', async () => {
      const payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'> = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: ['role1', 'role2'],
      };

      jwtService.signAsync.mockResolvedValue('access-token');

      const token = await service.generateAccessToken(
        mockPrisma as PrismaClient,
        payload,
        'tenant-id',
        3600,
      );

      expect(token).toBe('access-token');
      expect(
        mockJWTSecretService.getTenantJWTSecretInternal,
      ).toHaveBeenCalledWith(mockPrisma, 'tenant-id');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...payload,
          type: 'access',
        }),
        {
          secret: 'test-secret-key',
          expiresIn: 3600,
        },
      );
    });

    it('should use default expiration when not provided', async () => {
      const payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'> = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: [],
      };

      jwtService.signAsync.mockResolvedValue('access-token');

      await service.generateAccessToken(
        mockPrisma as PrismaClient,
        payload,
        'tenant-id',
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          expiresIn: 3600, // Default 1 hour
        }),
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload', async () => {
      const payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'> = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: ['role1'],
      };

      jwtService.signAsync.mockResolvedValue('refresh-token');

      const token = await service.generateRefreshToken(
        mockPrisma as PrismaClient,
        payload,
        'tenant-id',
        604800,
      );

      expect(token).toBe('refresh-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...payload,
          type: 'refresh',
        }),
        {
          secret: 'test-secret-key',
          expiresIn: 604800,
        },
      );
    });

    it('should use default expiration when not provided', async () => {
      const payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'> = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: [],
      };

      jwtService.signAsync.mockResolvedValue('refresh-token');

      await service.generateRefreshToken(
        mockPrisma as PrismaClient,
        payload,
        'tenant-id',
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          expiresIn: 604800, // Default 7 days
        }),
      );
    });
  });

  describe('validateAccessToken', () => {
    it('should validate valid access token', async () => {
      const token = 'valid-access-token';
      const payload: JWTPayload = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: ['role1'],
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.validateAccessToken(
        mockPrisma as PrismaClient,
        token,
        'tenant-id',
      );

      expect(result).toEqual(payload);
      expect(
        mockJWTSecretService.getTenantJWTSecretInternal,
      ).toHaveBeenCalledWith(mockPrisma, 'tenant-id');
    });

    it('should return null for refresh token type', async () => {
      const token = 'refresh-token';
      const payload: JWTPayload = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: [],
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      jwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.validateAccessToken(
        mockPrisma as PrismaClient,
        token,
        'tenant-id',
      );

      expect(result).toBeNull();
    });

    it('should return null when tenant ID does not match', async () => {
      const token = 'access-token';
      const payload: JWTPayload = {
        sub: 'user-id',
        tenantId: 'different-tenant-id',
        profileId: 'profile-id',
        roles: [],
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.validateAccessToken(
        mockPrisma as PrismaClient,
        token,
        'tenant-id',
      );

      expect(result).toBeNull();
    });

    it('should return null for invalid token', async () => {
      const token = 'invalid-token';

      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      const result = await service.validateAccessToken(
        mockPrisma as PrismaClient,
        token,
        'tenant-id',
      );

      expect(result).toBeNull();
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate valid refresh token', async () => {
      const token = 'valid-refresh-token';
      const payload: JWTPayload = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: ['role1'],
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      jwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.validateRefreshToken(
        mockPrisma as PrismaClient,
        token,
        'tenant-id',
      );

      expect(result).toEqual(payload);
    });

    it('should return null for access token type', async () => {
      const token = 'access-token';
      const payload: JWTPayload = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: [],
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.validateRefreshToken(
        mockPrisma as PrismaClient,
        token,
        'tenant-id',
      );

      expect(result).toBeNull();
    });

    it('should return null when tenant ID does not match', async () => {
      const token = 'refresh-token';
      const payload: JWTPayload = {
        sub: 'user-id',
        tenantId: 'different-tenant-id',
        profileId: 'profile-id',
        roles: [],
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      jwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.validateRefreshToken(
        mockPrisma as PrismaClient,
        token,
        'tenant-id',
      );

      expect(result).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = 'token';
      const payload: Partial<JWTPayload> = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        type: 'access',
      };

      jwtService.decode.mockReturnValue(payload);

      const result = service.decodeToken(token);

      expect(result).toEqual(payload);
      expect(jwtService.decode).toHaveBeenCalledWith(token);
    });

    it('should return null for invalid token', () => {
      const token = 'invalid-token';

      (jwtService.decode as jest.Mock).mockReturnValue(null);

      const result = service.decodeToken(token);

      expect(result).toBeNull();
    });
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', async () => {
      const payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'> = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: ['role1'],
      };

      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.generateTokens(
        mockPrisma as PrismaClient,
        payload,
        'tenant-id',
        3600,
        604800,
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('should use default expirations when not provided', async () => {
      const payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'> = {
        sub: 'user-id',
        tenantId: 'tenant-id',
        profileId: 'profile-id',
        roles: [],
      };

      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.generateTokens(
        mockPrisma as PrismaClient,
        payload,
        'tenant-id',
      );

      expect(result.expiresIn).toBe(3600); // Default access token expiration
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });
});
