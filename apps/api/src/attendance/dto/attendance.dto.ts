import { IsDateString, IsIn, IsOptional, IsString, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export class MarkAttendanceDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678', description: 'Student ID' })
  @IsString() @IsNotEmpty() studentId!: string;

  @ApiProperty({ enum: ATTENDANCE_STATUSES, example: 'present' })
  @IsIn(ATTENDANCE_STATUSES) status!: AttendanceStatus;

  @ApiPropertyOptional({ example: 'Arrived 10 minutes late due to transport delay' })
  @IsOptional() @IsString() notes?: string;
}

export class BulkMarkAttendanceDto {
  @ApiProperty({ example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789', description: 'Class ID' })
  @IsString() @IsNotEmpty() classId!: string;

  @ApiProperty({ example: '2025-03-12', description: 'ISO date string (YYYY-MM-DD)' })
  @IsDateString() date!: string;

  @ApiProperty({
    type: [MarkAttendanceDto],
    example: [
      { studentId: 'a1b2c3d4-e5f6-4789-9abc-def012345678', status: 'present' },
      { studentId: 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789', status: 'absent', notes: 'Called in sick' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceDto)
  records!: MarkAttendanceDto[];
}

export class ListAttendanceDto {
  @ApiPropertyOptional({ example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789' })
  @IsOptional() @IsString() classId?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsOptional() @IsString() studentId?: string;

  @ApiPropertyOptional({ example: '2025-03-12' })
  @IsOptional() @IsDateString() date?: string;

  @ApiPropertyOptional({ example: '2025-03-01' })
  @IsOptional() @IsDateString() from?: string;

  @ApiPropertyOptional({ example: '2025-03-31' })
  @IsOptional() @IsDateString() to?: string;
}
