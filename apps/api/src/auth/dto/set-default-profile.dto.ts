import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetDefaultProfileDto {
  @ApiProperty({ example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789' })
  @IsUUID()
  profileId: string;
}
