import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export const EXPORT_FORMATS = ['pdf', 'csv', 'xlsx', 'json'] as const;

export class AcademicPerformanceReportDto {
  @ApiPropertyOptional({ description: 'Class ID to filter' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Assessment ID to filter' })
  @IsOptional()
  @IsString()
  assessmentId?: string;

  @ApiPropertyOptional({ description: 'Academic year ID to filter' })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Term ID to filter' })
  @IsOptional()
  @IsString()
  termId?: string;
}

export class DashboardQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Optional academic year filter' })
  @IsOptional()
  @IsString()
  academicYearId?: string;
}

export class ExportReportDto {
  @ApiProperty({ description: 'Report type (e.g., academic-performance, attendance)' })
  @IsString()
  @MaxLength(100)
  reportType: string;

  @ApiPropertyOptional({ description: 'Report parameters (JSON)' })
  @IsOptional()
  params?: Record<string, any>;

  @ApiProperty({
    description: 'Export format',
    enum: EXPORT_FORMATS,
    default: 'pdf',
  })
  @IsString()
  @IsIn(EXPORT_FORMATS)
  format: (typeof EXPORT_FORMATS)[number] = 'pdf';
}

export class ScheduleReportDto {
  @ApiProperty({ description: 'Cron expression or simple schedule string' })
  @IsString()
  schedule: string;

  @ApiProperty({ description: 'Report type' })
  @IsString()
  @MaxLength(100)
  reportType: string;

  @ApiPropertyOptional({ description: 'Report parameters' })
  @IsOptional()
  params?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: EXPORT_FORMATS,
    default: 'pdf',
  })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: (typeof EXPORT_FORMATS)[number];

  @ApiPropertyOptional({ description: 'Send to recipients (userTenant IDs)' })
  @IsOptional()
  @IsArray()
  recipients?: string[];
}

export class CustomReportDto {
  @ApiProperty({ description: 'Report name' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Source entity/table (e.g., grades, attendance)' })
  @IsString()
  @MaxLength(100)
  source: string;

  @ApiPropertyOptional({ description: 'Filters (JSON)' })
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Fields to select' })
  @IsOptional()
  @IsArray()
  fields?: string[];
}

