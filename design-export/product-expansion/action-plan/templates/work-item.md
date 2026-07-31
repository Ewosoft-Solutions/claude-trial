# <ID> — <Title>

- **Phase / matrix row:** <phase> · [#N](../../plan/07-capability-parity-matrix.md)
- **Owner / Status:** <agent> · <state>
- **Depends on:** <IDs> · **Blocks:** <IDs>
- **Effort:** S | M | L | XL

## Job

<The school job this completes, in one sentence. Who does it, how often.>

## Incumbent evidence

<Cxxx screenshot IDs from the register that this replaces/absorbs.>

## Current state (repo)

<Exact models/routes/services that exist today, and what's missing.>

## Scope

**In:** <what this item delivers.>
**Out:** <explicitly deferred, with the item ID that will pick it up.>

## Domain / data

<New or changed Prisma models; ownership; invariants; `tenant_id`; effective-dating.>

## API / commands

<Endpoints / command transitions; step-up/approval triggers; outbox events emitted.>

## Permissions & scope

<`resource.action.context` used/added; clearance; separation-of-duties; who can/can't.>

## UI (Aurora)

<Workspace + components/tokens from the design bridge (Directory/Workbench/StatusBadge/Meter/states…). Empty/error/permission states.>

## Migration / import

<How historical data lands (source fields, mapping, reconciliation), if any.>

## Acceptance test

<Concrete scenario(s) an operator completes end-to-end for this to be "done".>

## Definition of Done

Copy the checklist from [`/AGENTS.md`](../../../../AGENTS.md) §5 and check each box in the PR.

## Validation run

<Paste the output of `pnpm ci:quick` + any domain gate (`db:rls:check`, `db:verify`).>
