import 'server-only';
import { cache } from 'react';

import { serverApiGet } from '@/lib/server-api';
import { parseType } from '../people-config';
import type { PersonDetail } from '../person-detail.types';

/**
 * Fetch the governed person detail, `cache`d so the shell + the active tab page
 * dedupe to a single upstream call within one request.
 */
export const getPersonDetail = cache(
  (id: string, rawType: string | undefined): Promise<PersonDetail | null> =>
    serverApiGet<PersonDetail>(
      `/directory/people/${encodeURIComponent(id)}?type=${parseType(rawType)}`,
    ),
);
