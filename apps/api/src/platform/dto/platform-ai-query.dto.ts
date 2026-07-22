import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PlatformAiQueryDto {
  @ApiProperty({
    example: 'Which schools are at risk, and how many students in total?',
    description: 'A question about the platform estate (aggregate data only).',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  question: string;
}
