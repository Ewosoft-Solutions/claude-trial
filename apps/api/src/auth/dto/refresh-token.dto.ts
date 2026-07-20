import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNCJ9.dGhpc2lzbm90YXJlYWxzaWduYXR1cmU' })
  @IsString()
  refreshToken: string;
}
