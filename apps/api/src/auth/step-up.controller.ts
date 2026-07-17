import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUDIT_ACTION, AUDIT_EVENT, DatabaseService } from '../common';
import { AuthUser } from './decorators';
import { BeginStepUpDto, VerifyStepUpDto } from './dto/step-up.dto';
import { JwtAuthGuard } from './guards';
import { StepUpService } from './services/step-up.service';
import type { RequestUser } from './types/request-user';

@ApiTags('Step-up')
@Controller('auth/step-up')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StepUpController {
  private readonly logger = new Logger(StepUpController.name);

  constructor(
    private readonly stepUpService: StepUpService,
    private readonly dbService: DatabaseService,
  ) {}

  @Post('options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Begin step-up verification for a sensitive action',
  })
  async options(@Body() dto: BeginStepUpDto, @AuthUser() user: RequestUser) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.stepUpService.begin(
      this.dbService.client,
      user.userId,
      dto.operation,
    );
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a sensitive-action step-up challenge' })
  async verify(@Body() dto: VerifyStepUpDto, @AuthUser() user: RequestUser) {
    if (!user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const method = dto.password ? 'password' : 'passkey';
    let challengeId: string;
    try {
      if (dto.password) {
        challengeId = await this.stepUpService.verifyPassword(
          this.dbService.client,
          user.userId,
          dto.operation,
          dto.password,
        );
      } else if (dto.challengeId && dto.webauthnResponse) {
        challengeId = await this.stepUpService.verifyPasskey(
          this.dbService.client,
          user.userId,
          dto.operation,
          dto.challengeId,
          dto.webauthnResponse,
        );
      } else {
        throw new BadRequestException(
          'Provide either a passkey response or your current password.',
        );
      }
    } catch (error) {
      await this.recordAudit(user, dto.operation, method, 'failure', error);
      throw error;
    }

    await this.recordAudit(
      user,
      dto.operation,
      method,
      'success',
      undefined,
      challengeId,
    );
    return { verified: true, challengeId };
  }

  /** Audit must never turn a valid identity confirmation into a failure. */
  private async recordAudit(
    user: RequestUser,
    operation: string,
    method: 'password' | 'passkey',
    status: 'success' | 'failure',
    error?: unknown,
    challengeId?: string,
  ): Promise<void> {
    try {
      await this.dbService.client.auditLog.create({
        data: {
          tenantId: user.tenantId || null,
          eventType: AUDIT_EVENT.AUTHENTICATION,
          action:
            status === 'success'
              ? AUDIT_ACTION.AUTHENTICATION.STEP_UP_VERIFIED
              : AUDIT_ACTION.AUTHENTICATION.STEP_UP_FAILED,
          resource: 'sensitive_operation',
          resourceId: operation,
          actorId: user.userId,
          actorProfileId: user.profileId || null,
          actorEmail: user.email || null,
          description:
            status === 'success'
              ? 'Sensitive-operation identity confirmation succeeded'
              : 'Sensitive-operation identity confirmation failed',
          metadata: { operation, method, challengeId: challengeId ?? null },
          status,
          errorMessage:
            status === 'failure' && error instanceof Error
              ? error.message
              : null,
        },
      });
    } catch (auditError) {
      this.logger.error('Failed to audit step-up verification', auditError);
    }
  }
}
