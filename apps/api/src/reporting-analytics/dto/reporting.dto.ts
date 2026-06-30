import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export const EXPORT_FORMATS = ['pdf', 'csv', 'xlsx', 'json'] as const;

export class AcademicPerformanceReportDto {
  @ApiPropertyOptional({ description: 'Class ID to filter', example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Assessment ID to filter', example: 'e3f4a5b6-c7d8-4901-9bcd-ef0123456789' })
  @IsOptional()
  @IsString()
  assessmentId?: string;

  @ApiPropertyOptional({ description: 'Academic year ID to filter', example: 'f4a5b6c7-d8e9-4012-9bcd-ef0123456789' })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Term ID to filter', example: 'a5b6c7d8-e9f0-4123-9bcd-ef0123456789' })
  @IsOptional()
  @IsString()
  termId?: string;
}

export class DashboardQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Optional academic year filter', example: 'f4a5b6c7-d8e9-4012-9bcd-ef0123456789' })
  @IsOptional()
  @IsString()
  academicYearId?: string;
}

export class ExportReportDto {
  @ApiProperty({ description: 'Report type (e.g., academic-performance, attendance)', example: 'academic-performance' })
  @IsString()
  @MaxLength(100)
  reportType: string;

  @ApiPropertyOptional({ description: 'Report parameters (JSON)', example: { classId: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789', termId: 'a5b6c7d8-e9f0-4123-9bcd-ef0123456789' } })
  @IsOptional()
  params?: Record<string, any>;

  @ApiProperty({
    description: 'Export format',
    enum: EXPORT_FORMATS,
    default: 'pdf',
    example: 'pdf',
  })
  @IsString()
  @IsIn(EXPORT_FORMATS)
  format: (typeof EXPORT_FORMATS)[number] = 'pdf';
}

export class ScheduleReportDto {
  @ApiProperty({ description: 'Cron expression or simple schedule string', example: '0 7 * * MON' })
  @IsString()
  schedule: string;

  @ApiProperty({ description: 'Report type', example: 'attendance-summary' })
  @IsString()
  @MaxLength(100)
  reportType: string;

  @ApiPropertyOptional({ description: 'Report parameters', example: { classId: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789' } })
  @IsOptional()
  params?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: EXPORT_FORMATS,
    default: 'pdf',
    example: 'xlsx',
  })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: (typeof EXPORT_FORMATS)[number];

  @ApiPropertyOptional({ description: 'Send to recipients (userTenant IDs)', example: ['d57a414c-9991-4181-b6b2-929f4d2137aa'] })
  @IsOptional()
  @IsArray()
  recipients?: string[];
}

export class CustomReportDto {
  @ApiProperty({ description: 'Report name', example: 'Term 1 Fee Collection by Class' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Breaks down fee collection totals per class for the current term' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Source entity/table (e.g., grades, attendance)', example: 'fee_invoices' })
  @IsString()
  @MaxLength(100)
  source: string;

  @ApiPropertyOptional({ description: 'Filters (JSON)', example: { status: 'paid', termName: 'Spring Term' } })
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Fields to select', example: ['studentId', 'amountDue', 'amountPaid', 'status'] })
  @IsOptional()
  @IsArray()
  fields?: string[];
}
