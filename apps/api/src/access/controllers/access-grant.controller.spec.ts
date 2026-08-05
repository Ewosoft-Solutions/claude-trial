import 'reflect-metadata';
import { AccessGrantController } from './access-grant.controller';
import { STEP_UP_OPERATION_KEY } from '../../auth/guards/step-up.guard';

/**
 * The grant + approve routes MUST carry the step-up requirement — the WB1-6
 * follow-up review found the panel couldn't complete a grant because the server
 * (correctly) requires a step-up the UI never performed. This pins the server
 * side: the guard's operation metadata is present, so the StepUpGuard enforces
 * it. (StepUpGuard's own spec proves a missing challenge → 403.)
 */
describe('AccessGrantController — step-up metadata', () => {
  it('requires step-up (users.role.assign) to request a grant', () => {
    const op = Reflect.getMetadata(
      STEP_UP_OPERATION_KEY,
      AccessGrantController.prototype.request,
    );
    expect(op).toBe('users.role.assign');
  });

  it('requires step-up (users.role.assign) to approve a grant', () => {
    const op = Reflect.getMetadata(
      STEP_UP_OPERATION_KEY,
      AccessGrantController.prototype.approve,
    );
    expect(op).toBe('users.role.assign');
  });
});
