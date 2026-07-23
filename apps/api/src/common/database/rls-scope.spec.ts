import type { PrismaClient } from '@workspace/database';
import { withTenantScope, withUserScope } from '@workspace/database/rls';

/**
 * Covers the property the deployed environment depends on and local dev cannot
 * demonstrate: that a scoped read sets its GUC on the SAME connection as the
 * query, before the query runs.
 *
 * Worth pinning explicitly because the failure mode is silent — an unscoped
 * read returns zero rows rather than raising — so "the callback ran" would not
 * catch a regression. Each test asserts ordering and the client identity, which
 * is what actually makes the GUC apply.
 *
 * Lives here rather than in packages/database because this is where a test
 * runner is wired and CI executes it.
 */
type Recorder = { client: PrismaClient; calls: string[] };

function makeClient(): Recorder {
  const calls: string[] = [];

  const tx = {
    $executeRaw: jest.fn(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        calls.push(`set:${strings.join('?')}|${values.join(',')}`);
        return Promise.resolve(1);
      },
    ),
    marker: 'tx',
  };

  const client = {
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => {
      calls.push('begin');
      const result = await fn(tx);
      calls.push('commit');
      return result;
    }),
  };

  return { client: client as unknown as PrismaClient, calls };
}

describe('withTenantScope', () => {
  it('sets the tenant GUC inside the transaction, before the callback runs', async () => {
    const { client, calls } = makeClient();

    await withTenantScope(client, 'tenant-1', undefined, async (tx) => {
      calls.push('query');
      // The callback must receive the transaction client. A query issued on the
      // outer client would run on a different pooled connection, where the GUC
      // was never set — the exact mistake that makes a scope silently useless.
      expect((tx as unknown as { marker: string }).marker).toBe('tx');
      return null;
    });

    expect(calls[0]).toBe('begin');
    expect(calls[1]).toContain('app.current_tenant_id');
    expect(calls[1]).toContain('tenant-1');
    expect(calls[2]).toBe('query');
    expect(calls.at(-1)).toBe('commit');
  });

  it('also sets the user GUC when a userId is supplied', async () => {
    const { client, calls } = makeClient();

    await withTenantScope(client, 'tenant-1', 'user-9', async () => null);

    const settings = calls.filter((c) => c.startsWith('set:'));
    expect(settings).toHaveLength(2);
    expect(settings[1]).toContain('app.current_user_id');
    expect(settings[1]).toContain('user-9');
  });

  it('inherits the caller scope when handed a transaction client', async () => {
    // A Prisma.TransactionClient has no $transaction. Nesting is impossible, so
    // the helper runs inline — and must NOT re-set the GUC, which would change
    // the scope of the caller's remaining statements in that transaction.
    const alreadyScoped = { $executeRaw: jest.fn() } as unknown as PrismaClient;

    const result = await withTenantScope(
      alreadyScoped,
      'tenant-1',
      undefined,
      async (tx) => {
        expect(tx).toBe(alreadyScoped);
        return 'ran';
      },
    );

    expect(result).toBe('ran');
    expect(alreadyScoped.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('withUserScope', () => {
  it('sets only the user GUC, leaving tenant unset', async () => {
    const { client, calls } = makeClient();

    await withUserScope(client, 'user-9', async () => null);

    const settings = calls.filter((c) => c.startsWith('set:'));
    expect(settings).toHaveLength(1);
    expect(settings[0]).toContain('app.current_user_id');
    expect(settings[0]).not.toContain('app.current_tenant_id');
  });

  it('inherits the caller scope when handed a transaction client', async () => {
    const alreadyScoped = { $executeRaw: jest.fn() } as unknown as PrismaClient;

    await expect(
      withUserScope(alreadyScoped, 'user-9', async (tx) => {
        expect(tx).toBe(alreadyScoped);
        return 'ran';
      }),
    ).resolves.toBe('ran');
    expect(alreadyScoped.$executeRaw).not.toHaveBeenCalled();
  });
});
