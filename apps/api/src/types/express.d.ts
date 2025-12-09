import { RequestUser } from '../auth/types/request-user';
import { UserPermissionContext } from '../auth/services/permission.service';

declare module 'express-serve-static-core' {
  interface Request {
    user?: RequestUser;
    userContext?: UserPermissionContext;
  }
}
