import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TRANSPORT_STATUSES = ['assigned', 'waitlist', 'unassigned'] as const;
export type TransportStatus = (typeof TRANSPORT_STATUSES)[number];

export class CreateAssignmentDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000000' })
  @IsString() @IsNotEmpty() studentId!: string;

  @ApiPropertyOptional({ example: 'Route A — Ikoyi' })
  @IsOptional() @IsString() routeName?: string;

  @ApiPropertyOptional({ example: 'Awolowo Rd' })
  @IsOptional() @IsString() stop?: string;

  @ApiPropertyOptional({ example: '06:45' })
  @IsOptional() @IsString() pickupTime?: string;

  @ApiPropertyOptional({ example: 'Bus 4' })
  @IsOptional() @IsString() vehicleLabel?: string;

  @ApiPropertyOptional({ enum: TRANSPORT_STATUSES, example: 'assigned' })
  @IsOptional() @IsIn(TRANSPORT_STATUSES) status?: TransportStatus;
}

export class UpdateAssignmentDto {
  @ApiPropertyOptional({ example: 'Route B — Lekki' })
  @IsOptional() @IsString() routeName?: string;

  @ApiPropertyOptional({ example: 'Admiralty Way' })
  @IsOptional() @IsString() stop?: string;

  @ApiPropertyOptional({ example: '06:40' })
  @IsOptional() @IsString() pickupTime?: string;

  @ApiPropertyOptional({ example: 'Bus 2' })
  @IsOptional() @IsString() vehicleLabel?: string;

  @ApiPropertyOptional({ enum: TRANSPORT_STATUSES, example: 'waitlist' })
  @IsOptional() @IsIn(TRANSPORT_STATUSES) status?: TransportStatus;
}

export class ListAssignmentsDto {
  @ApiPropertyOptional({ enum: TRANSPORT_STATUSES, example: 'assigned' })
  @IsOptional() @IsIn(TRANSPORT_STATUSES) status?: TransportStatus;

  @ApiPropertyOptional({ example: 'Route A — Ikoyi' })
  @IsOptional() @IsString() routeName?: string;

  @ApiPropertyOptional({ example: 'Okafor', description: 'Free-text search across student name/number' })
  @IsOptional() @IsString() query?: string;
}
