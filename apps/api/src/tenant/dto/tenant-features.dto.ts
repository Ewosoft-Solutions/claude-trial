import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/** A partial patch of feature-key → enabled. Unknown keys and non-boolean
 *  values are rejected by the service. */
export class UpdateFeaturesDto {
  @ApiProperty({
    example: { transport: false, library: true },
    description: 'Feature keys to toggle; only the provided keys are changed.',
  })
  @IsObject()
  features!: Record<string, boolean>;
}
