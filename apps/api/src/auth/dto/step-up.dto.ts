import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import {
  STEP_UP_OPERATION_VALUES,
  type StepUpOperation,
} from '../step-up.operations';

export class BeginStepUpDto {
  @ApiProperty({ enum: STEP_UP_OPERATION_VALUES })
  @IsString()
  @IsIn(STEP_UP_OPERATION_VALUES)
  operation: StepUpOperation;
}

export class VerifyStepUpDto extends BeginStepUpDto {
  @ApiPropertyOptional({ description: 'Passkey challenge being verified' })
  @IsOptional()
  @IsString()
  challengeId?: string;

  @ApiPropertyOptional({ description: 'WebAuthn assertion response' })
  @IsOptional()
  @IsObject()
  webauthnResponse?: AuthenticationResponseJSON;

  @ApiPropertyOptional({ description: 'Current password fallback' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password?: string;

  @ApiPropertyOptional({ description: 'Six-digit authenticator-app code' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  totpCode?: string;

  @ApiPropertyOptional({ description: 'One-time account recovery code' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  recoveryCode?: string;
}
