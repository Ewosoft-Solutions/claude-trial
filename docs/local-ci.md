# Local CI and pre-push enforcement

The repository runs the GitHub Actions CI workflow locally before allowing a
normal `git push`. GitHub Actions still runs after the push and remains the
authoritative merge check.

## Flow

```text
Code changes
     ↓
pnpm ci:quick
     ↓
Failed? ── yes ──→ Fix the issue ──→ Run again
     ↓ no
git push
     ↓
Tracked pre-push hook
     ↓
Docker and act available?
     ├── no ──→ Block the push with setup instructions
     └── yes
           ↓
act runs .github/workflows/ci.yml locally
           ↓
     Failed? ── yes ──→ Block the push ──→ Fix and retry
           ↓ no
Push proceeds to GitHub
           ↓
GitHub Actions runs the same workflow as the authoritative remote check
```

## Prerequisites

- Node.js 20.19 or newer
- pnpm 10.34.5
- Docker Desktop or Docker Engine
- [act](https://nektosact.com/installation/)

The configuration does not hardcode a CPU architecture. Docker selects the
native image for Apple Silicon, Intel macOS, Linux, and Git for Windows hosts.

## Setup

Run the normal dependency installation:

```bash
pnpm install
```

The `prepare` script configures this checkout to use `.githooks`. Existing
checkouts can install the hook directly:

```bash
pnpm hooks:install
```

Confirm the installation with:

```bash
git config --local --get core.hooksPath
```

The expected output is `.githooks`.

## Commands

During development, build the shared packages and run the same type-check and
application lint commands used by GitHub Actions without starting Docker:

```bash
pnpm ci:quick
```

Before a push, the hook automatically runs the complete workflow. It can also
be run directly:

```bash
pnpm ci:local
```

The full run starts the workflow's PostgreSQL service and requires local port
5432 to be available. It performs all builds, database gates, tests, and e2e
tests from the authoritative workflow.

## Local secrets

The current CI workflow uses test-only environment values and does not require
a secrets file. If future workflow steps need secrets, copy
`.act.secrets.example` to `.act.secrets`. The local file is gitignored and is
loaded automatically when present. Never place production secrets in it.

## Emergency bypass

Git supports `git push --no-verify`, which bypasses all pre-push hooks. Use it
only when the local CI tooling itself is broken and the push is urgently
required. It must never be used to bypass a known code or test failure. GitHub
Actions remains required before merge.

## GitHub workflow events

CI runs once when a pull request targets `main`, and once after changes land on
`main`. Working branches such as `claude` are intentionally not included in the
`push` trigger, preventing duplicate push and pull-request jobs for one commit.
