/* ============================================================
   /assistant — Analytics AI assistant (server component)

   Fetches the caller's chat sessions from the NestJS backend
   (server-side, cookie-authenticated) and hands them to the client
   island. Empty API responses render as an empty chat history.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { AssistantClient, type SessionSummary } from './assistant-client';

export default async function AssistantPage() {
  const sessions = await serverApiGet<SessionSummary[]>('/ai/analytics/sessions');
  return <AssistantClient initialSessions={sessions ?? []} />;
}
