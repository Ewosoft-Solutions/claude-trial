import { IsDateString, IsIn, IsOptional, IsString, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export class MarkAttendanceDto {
  @ApiProperty() @IsString() @IsNotEmpty() studentId!: string;
  @ApiProperty({ enum: ATTENDANCE_STATUSES }) @IsIn(ATTENDANCE_STATUSES) status!: AttendanceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class BulkMarkAttendanceDto {
  @ApiProperty() @IsString() @IsNotEmpty() classId!: string;
  @ApiProperty({ description: 'ISO date string (YYYY-MM-DD)' }) @IsDateString() date!: string;
  @ApiProperty({ type: [MarkAttendanceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceDto)
  records!: MarkAttendanceDto[];
}

export class ListAttendanceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() classId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() studentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
