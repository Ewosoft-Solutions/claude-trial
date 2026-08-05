import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';

import {
  CreateCustomRoleDto,
  ExplainAccessDto,
  PreviewRoleDto,
  UpdateRoleClearanceDto,
} from './role-management.controller';

/**
 * Guards the WB1-5 role DTOs against the global ValidationPipe. `main.ts` runs
 * the pipe with `whitelist` + `forbidNonWhitelisted`, so a DTO with NO
 * class-validator decorators makes every property non-whitelisted and the
 * request 400s before the handler — which is exactly how the role-editor
 * effective-access preview shipped broken (the service-level e2e bypassed the
 * pipe). This mirrors that pipe and asserts the real request bodies pass.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const meta = (metatype: unknown): ArgumentMetadata => ({
  type: 'body',
  metatype: metatype as ArgumentMetadata['metatype'],
  data: '',
});

const POOL = '11111111-1111-1111-1111-111111111111';

describe('Role management DTO validation (global pipe: whitelist + forbidNonWhitelisted)', () => {
  it('accepts the effective-access PREVIEW body (was 400 before decorators)', async () => {
    await expect(
      pipe.transform(
        {
          clearanceLevel: 5,
          poolIds: [POOL],
          scope: { type: 'campus', value: 'campus-a', label: 'Campus A' },
          templateKey: 'bursar',
          name: 'Bursar (Campus A)',
        },
        meta(PreviewRoleDto),
      ),
    ).resolves.toMatchObject({ clearanceLevel: 5, templateKey: 'bursar' });
  });

  it('accepts a global-scope preview (scope null)', async () => {
    await expect(
      pipe.transform(
        { clearanceLevel: 3, poolIds: [POOL], scope: null },
        meta(PreviewRoleDto),
      ),
    ).resolves.toBeDefined();
  });

  it('accepts a valid CreateCustomRoleDto', async () => {
    await expect(
      pipe.transform(
        {
          name: 'Bursar (Campus A)',
          clearanceLevel: 5,
          permissionPoolIds: [POOL],
          scope: { type: 'campus', value: 'campus-a' },
          templateKey: 'bursar',
        },
        meta(CreateCustomRoleDto),
      ),
    ).resolves.toBeDefined();
  });

  it('accepts ExplainAccessDto + UpdateRoleClearanceDto', async () => {
    await expect(
      pipe.transform({ permission: 'fees.view' }, meta(ExplainAccessDto)),
    ).resolves.toBeDefined();
    await expect(
      pipe.transform({ clearanceLevel: 5 }, meta(UpdateRoleClearanceDto)),
    ).resolves.toBeDefined();
  });

  it('still rejects an unknown property (forbidNonWhitelisted intact)', async () => {
    await expect(
      pipe.transform(
        { clearanceLevel: 5, poolIds: [POOL], bogus: 'x' },
        meta(PreviewRoleDto),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an out-of-range clearance', async () => {
    await expect(
      pipe.transform(
        { clearanceLevel: 99, poolIds: [POOL] },
        meta(PreviewRoleDto),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
