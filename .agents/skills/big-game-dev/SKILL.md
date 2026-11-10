---
name: big-game-dev
description: Develop and verify the Chinese online city-property board game in this repository, including authoritative rules, multiplayer flows, and project continuity.
---

# Big Game Development

Use this skill for implementation, debugging, or review work in this repository.

## Orient

- Read `.planning/monopoly-online/progress.md` first. Read `docs/game-rules-v1.md` or `docs/deployment.md` only when relevant to the task.
- Search the narrowest relevant package or app. Use the `codebase` skill when an index is available; otherwise use `rg`.
- Keep changes within the owning package. `packages/game-rules` owns authoritative game rules; the server owns dice, money, events, and turn adjudication; clients submit actions and render state.

## Implement and verify

- Follow existing TypeScript, pnpm workspace, and test patterns. Avoid unrelated refactors.
- For rule changes, add or update focused tests in `packages/game-rules`; for browser behavior, use `playwright` when available.
- Run the narrowest relevant checks, then `pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check` when the change warrants full validation.

## Preserve continuity

- For multi-stage work or before ending a long session, update `.planning/monopoly-online/progress.md` with completed work, checks, blockers, and the next concrete step. Update `docs/continue-at-home-prompt.md` only when the project's overall handoff context changes.
- If remote compaction disconnects, do not loop retries. Record the current state in the progress file and continue in a fresh conversation using this same workspace.
- Never write live credentials or secrets into project files.
