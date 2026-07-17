import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
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
}
