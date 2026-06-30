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
  @ApiProperty({ example: 'Ngozi Achebe' })
  @IsString() @IsNotEmpty() applicantName!: string;

  @ApiProperty({ example: 'JSS 1', description: 'Target class/grade' })
  @IsString() @IsNotEmpty() applyingFor!: string;

  @ApiProperty({ example: 'Mrs. E. Achebe' })
  @IsString() @IsNotEmpty() guardianName!: string;

  @ApiPropertyOptional({ example: 'e.achebe@example.com' })
  @IsOptional() @IsEmail() guardianEmail?: string;

  @ApiPropertyOptional({ example: '+234-801-234-5678' })
  @IsOptional() @IsString() guardianPhone?: string;

  @ApiPropertyOptional({ example: '2025-03-12' })
  @IsOptional() @IsDateString() submittedDate?: string;

  @ApiPropertyOptional({ example: 'Sibling already enrolled in SSS 2' })
  @IsOptional() @IsString() notes?: string;
}

export class UpdateApplicationDto {
  @ApiPropertyOptional({ enum: APPLICATION_STAGES, example: 'interview' })
  @IsOptional() @IsIn(APPLICATION_STAGES) stage?: ApplicationStage;

  @ApiPropertyOptional({ enum: APPLICATION_DECISIONS, example: 'accepted' })
  @IsOptional() @IsIn(APPLICATION_DECISIONS) decision?: ApplicationDecision;

  @ApiPropertyOptional({ example: 'Strong interview, recommended for admission' })
  @IsOptional() @IsString() notes?: string;
}

export class ListApplicationsDto {
  @ApiPropertyOptional({ enum: APPLICATION_STAGES, example: 'interview' })
  @IsOptional() @IsIn(APPLICATION_STAGES) stage?: ApplicationStage;

  @ApiPropertyOptional({ enum: APPLICATION_DECISIONS, example: 'pending' })
  @IsOptional() @IsIn(APPLICATION_DECISIONS) decision?: ApplicationDecision;

  @ApiPropertyOptional({ example: 'JSS 1' })
  @IsOptional() @IsString() applyingFor?: string;

  @ApiPropertyOptional({ example: 'Achebe', description: 'Free-text search across applicant + guardian name' })
  @IsOptional() @IsString() query?: string;
}
