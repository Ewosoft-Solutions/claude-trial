/**
 * Passwordless passkey-login DTOs (Biometrics Phase 2).
 */

import { IsEmail, IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request WebAuthn authentication options for a passwordless login.
 */
export class PasskeyLoginOptionsDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;
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
