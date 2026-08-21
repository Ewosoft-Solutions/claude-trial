import 'server-only';
import { cache } from 'react';

import { serverApiGet } from '@/lib/server-api';
import type { PersonDetail } from '../person-detail.types';

/**
 * Fetch the governed person detail, `cache`d so the profile LAYOUT and the
 * active tab page dedupe to a single upstream call within one request.
 *
 * No `type`: the server resolves person-or-prospect from the id. The layout
 * that renders the chrome cannot read a query string, and splitting the fetch
 * on something only the pages could see is what forced the chrome into every
 * page in the first place.
 */
export const getPersonDetail = cache(
  (id: string): Promise<PersonDetail | null> =>
    serverApiGet<PersonDetail>(`/directory/people/${encodeURIComponent(id)}`),
);
