import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { IsOptional, IsString } from 'class-validator';

import { PaginationDto } from './base.dto';

class ListQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  courseId?: string;
}

describe('PaginationDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });

  const metadata: ArgumentMetadata = {
    type: 'query',
    metatype: ListQueryDto,
    data: '',
  };

  it('allows inherited pagination query parameters with strict validation', async () => {
    const result = await pipe.transform(
      {
        courseId: 'edb739ef-11fa-4a12-a07d-c0ca5a028231',
        page: '2',
        limit: '50',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      metadata,
    );

    expect(result).toBeInstanceOf(ListQueryDto);
    expect(result).toMatchObject({
      courseId: 'edb739ef-11fa-4a12-a07d-c0ca5a028231',
      page: 2,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });
});
