import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const HEALTH_RECORD_STATUSES = ['normal', 'monitoring', 'urgent'] as const;
export type HealthRecordStatus = (typeof HEALTH_RECORD_STATUSES)[number];

export class UpsertHealthRecordDto {
  @ApiPropertyOptional({ example: 'O+' })
  @IsOptional() @IsString() bloodType?: string;

  @ApiPropertyOptional({ example: 'Penicillin, peanuts' })
  @IsOptional() @IsString() allergies?: string;

  @ApiPropertyOptional({ example: 'Mild asthma' })
  @IsOptional() @IsString() conditions?: string;

  @ApiPropertyOptional({ example: 'Ventolin inhaler as needed' })
  @IsOptional() @IsString() medications?: string;

  @ApiPropertyOptional({ example: 'Mrs. E. Achebe' })
  @IsOptional() @IsString() emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+234-801-234-5678' })
  @IsOptional() @IsString() emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional() @IsDateString() lastCheckup?: string;

  @ApiPropertyOptional({ enum: HEALTH_RECORD_STATUSES, example: 'monitoring' })
  @IsOptional() @IsIn(HEALTH_RECORD_STATUSES) status?: HealthRecordStatus;

  @ApiPropertyOptional({ example: 'Carries inhaler at all times' })
  @IsOptional() @IsString() notes?: string;
}

export class ListHealthRecordsDto {
  @ApiPropertyOptional({ enum: HEALTH_RECORD_STATUSES, example: 'monitoring' })
  @IsOptional() @IsIn(HEALTH_RECORD_STATUSES) status?: HealthRecordStatus;

  @ApiPropertyOptional({ example: 'Achebe', description: 'Free-text search across student name' })
  @IsOptional() @IsString() query?: string;
}
