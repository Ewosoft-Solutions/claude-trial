/**
 * Public status portal — `/status/[token]`. The token (an F5 SecureLink) is the
 * only capability; the client fetches + acts against the public API.
 */
import { StatusClient } from './status-client';

export const dynamic = 'force-dynamic';

export default async function StatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <StatusClient token={token} />;
}
