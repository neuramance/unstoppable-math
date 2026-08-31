# AGENTS.md

## Verify

- After editing a file: `scripts/agent-verify <file>` — prettier + eslint on that file (~0.5s).
- Before declaring any task done: `scripts/agent-verify` — format, lint, unit tests, production build in parallel, then typecheck (~3.5s warm). Exit 0 or the task is not done; report the failing check's output, never claim success past a red gate.
- On push: the pre-push hook (`.githooks/pre-push`, wired by `bun run setup`) runs the gate plus Supabase db tests and Playwright e2e, starting services if needed (~60s warm). Never push with `--no-verify`; a failed hook means the push does not happen.

## Complexity budget (enforced by eslint.config.mjs)

- Global ceilings: complexity 20, max-depth 4, 150 lines/function, 500 lines/file.
- The per-file overrides at the bottom of eslint.config.mjs are grandfathered debt pins, a one-way ratchet:
  - Never raise a pin. Never add a new file to the overrides.
  - When you refactor a pinned file below its pin, lower or delete its override in the same change.
  - When no file needs a looser global, tighten the global (20 → 15 → 10).
- New code meets the globals. If a change would breach a ceiling, extract along a real seam (component, hook, module function) — never restructure solely to game the number, and never nest another level where a table, map, or early return works.
- Prefer deleting and reusing over adding: search for an existing component, hook, or lib function before writing a new one. Match local style (no semicolons, single quotes, no comments).

## The verification loop itself (scripts/agent-verify)

- Contract: `$1` = one file → fast check (unknown file types exit 0, a false block is worse than none); no argument → full check.
- Budgets: fast path ≤ 1s, full path ≤ 10s wall warm. A check that cannot fit moves to `bun run check`, not into the gate.
- typecheck must never run concurrently with build — both write `.next/` and the race makes the gate flaky.
- Improving the loop is welcome; any edit to it requires evidence in the same change: `time scripts/agent-verify` before and after, plus a planted failure proving non-zero exit with a legible error tail.

## Layout

- `app/app/learn/` — session UI. `session.tsx` orchestrates; `session-stack/smash/done/dev` render; `use-session-log/phase`, `use-lesson-voice/answer` hold state machines.
- `lib/session.ts` — the pure session engine; heavily tested in `lib/session*.test.ts`, keep it side-effect free.
- `scripts/extract-docx.ts` → `content/transcription/` — lesson source pipeline; refactors must leave output byte-identical.
