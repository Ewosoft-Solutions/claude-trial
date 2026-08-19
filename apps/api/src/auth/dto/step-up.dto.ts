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
  // The default `@IsIn` message lists every allowed value — which here is the
  // whole catalogue of sensitive operations the platform supports (role
  // deletion, breach response, tenant suspension…). That is a map of the
  // product's most dangerous capabilities, returned to anyone who sends a
  // wrong value, and it ends up rendered in a dialog. The message says what
  // the caller needs and nothing more; the allowed values stay in the Swagger
  // schema, which is authenticated documentation rather than an error body.
  @ApiProperty({ enum: STEP_UP_OPERATION_VALUES })
  @IsString()
  @IsIn(STEP_UP_OPERATION_VALUES, {
    message:
      'Unsupported operation. This usually means the app and the API are running different versions — reload, and if it persists the API needs restarting.',
  })
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
