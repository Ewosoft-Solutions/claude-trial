import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const APPLICATION_STAGES = ['application', 'interview', 'decision'] as const;
export const APPLICATION_DECISIONS = ['pending', 'accepted', 'waitlisted', 'rejected'] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];
export type ApplicationDecision = (typeof APPLICATION_DECISIONS)[number];

export class CreateApplicationDto {
  @ApiProperty() @IsString() @IsNotEmpty() applicantName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() applyingFor!: string;
  @ApiProperty() @IsString() @IsNotEmpty() guardianName!: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() guardianEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() guardianPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() submittedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateApplicationDto {
  @ApiPropertyOptional({ enum: APPLICATION_STAGES })
  @IsOptional() @IsIn(APPLICATION_STAGES) stage?: ApplicationStage;
  @ApiPropertyOptional({ enum: APPLICATION_DECISIONS })
  @IsOptional() @IsIn(APPLICATION_DECISIONS) decision?: ApplicationDecision;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ListApplicationsDto {
  @ApiPropertyOptional({ enum: APPLICATION_STAGES })
  @IsOptional() @IsIn(APPLICATION_STAGES) stage?: ApplicationStage;
  @ApiPropertyOptional({ enum: APPLICATION_DECISIONS })
  @IsOptional() @IsIn(APPLICATION_DECISIONS) decision?: ApplicationDecision;
  @ApiPropertyOptional() @IsOptional() @IsString() applyingFor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() query?: string;
}
