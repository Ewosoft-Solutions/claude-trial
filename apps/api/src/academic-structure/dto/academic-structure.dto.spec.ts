import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { ListClassesDto } from './academic-structure.dto';

/**
 * `ListClassesDto` raises the inherited `PaginationDto` limit cap from 100 to
 * 500 so the "fetch all classes" pages (analytics capacity, timetable, subjects
 * matrix) are not rejected. This pins that the override actually takes effect —
 * class-validator merges metadata up the prototype chain, so a future upgrade
 * that re-stacked the parent's `@Max(100)` would silently re-break those pages.
 */
describe('ListClassesDto limit cap', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const metadata: ArgumentMetadata = {
    type: 'query',
    metatype: ListClassesDto,
    data: '',
  };

  it('accepts limit up to 500', async () => {
    const result = await pipe.transform({ limit: '500' }, metadata);
    expect(result).toBeInstanceOf(ListClassesDto);
    expect(result.limit).toBe(500);
  });

  it('rejects limit above 500', async () => {
    const error = await pipe
      .transform({ limit: '501' }, metadata)
      .then(() => null)
      .catch((e) => e);

    expect(error).toBeTruthy();
    const response = error.getResponse() as { message: string[] };
    expect(response.message).toContain('limit must not be greater than 500');
  });
});
