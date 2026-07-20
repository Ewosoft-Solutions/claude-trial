/**
 * Passwordless passkey-login DTOs (Biometrics Phase 2).
 */

import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request WebAuthn authentication options for a passwordless login.
 *
 * `email` is optional: omit it for a usernameless / discoverable login where
 * the user is resolved from the chosen passkey.
 */
export class PasskeyLoginOptionsDto {
  @ApiPropertyOptional({ example: 'jane.doe@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

/**
 * Complete a passwordless login with a WebAuthn assertion.
 */
export class PasskeyLoginVerifyDto {
  @ApiProperty({ description: 'Challenge id from passkey/login/options' })
  @IsString()
  challengeId: string;

  @ApiProperty({ description: 'WebAuthn assertion from the client' })
  @IsObject()
  authenticationResponse: Record<string, unknown>;
}
