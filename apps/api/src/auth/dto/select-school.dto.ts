import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SelectSchoolDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsUUID()
  tenantId: string;

  @ApiProperty({ example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789' })
  @IsUUID()
  profileId: string;
}
