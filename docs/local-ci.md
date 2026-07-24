# Local checks and CI

GitHub Actions runs the full CI workflow (`.github/workflows/ci.yml`) on every
pull request to `main` and after changes land on `main`. That workflow is the
**authoritative** check — a PR cannot merge until it passes.

There is no automatic pre-push gate. A previous setup ran the entire workflow
locally through Docker and `act` on every `git push`; it was removed because the
full e2e suite is slow and unreliable under local Docker resource limits — its
Postgres service intermittently timed out and blocked pushes for reasons
unrelated to the change being pushed. GitHub Actions runs the same suite in a
clean, dedicated environment, so that is where it belongs.

## Before pushing

Run the fast local check — lint, type-check, build, and unit tests, no Docker:

```bash
pnpm ci:quick
```

It mirrors the non-e2e parts of the GitHub workflow and catches the common
failures in seconds rather than minutes. It is a convenience, not a gate;
nothing blocks a push if you skip it.

## GitHub workflow events

CI runs once when a pull request targets `main`, and once after changes land on
`main`. Working branches such as `claude` are intentionally not in the `push`
trigger, so one commit does not produce duplicate push and pull-request jobs.

## Local secrets

The CI workflow uses test-only environment values and needs no secrets file.
