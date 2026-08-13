import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * WB3-3 · the admissions application form is now a generic Form (Form engine).
 * The DTO carries a full `FormDefinition` (sections → items + settings); the
 * engine (@workspace/forms) does the real structural validation server-side.
 */
export class SaveFormDefinitionDto {
  @ApiProperty({
    description:
      'The full FormDefinition — { title, description?, sections[], settings? }.',
  })
  @IsObject()
  definition!: Record<string, unknown>;
}

/** An application's typed answers to the current published form. */
export class SubmitFormResponseDto {
  @ApiProperty({
    description: 'Answers keyed by item key, e.g. { previous_school: "…" }.',
    example: { previous_school: 'Sunrise Primary', siblings_here: true },
  })
  @IsObject()
  answers!: Record<string, unknown>;
}
