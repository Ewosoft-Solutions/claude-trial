import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { apiClient, ApiError } from '@/lib/api-client';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_SESSION_RESUME,
  clearAuthCookie,
} from '@/lib/auth-cookies';
import { resolveResumeTarget } from '@/lib/resume-routes';
import { verifyResumeState } from '@/lib/resume-state';

interface MeResponse {
  permissions: string[];
  scope: 'school' | 'platform';
  defaultSchoolId?: string;
  activeProfileId?: string;
}

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [me, state] = await Promise.all([
      apiClient.get<MeResponse>('/auth/me', {
        Authorization: `Bearer ${accessToken}`,
      }),
      verifyResumeState(cookieStore.get(COOKIE_SESSION_RESUME)?.value),
    ]);
    const result = resolveResumeTarget(state, me);
    const response = NextResponse.json(result);
    clearAuthCookie(response, COOKIE_SESSION_RESUME);
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: 'Resume failed' }, { status: 500 });
  }
}
