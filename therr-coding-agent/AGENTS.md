# Project Instructions for therr-agent

This file is loaded into the agent's system prompt when it runs in this repo.

## Conventions
- TypeScript, ESM, strict mode. Keep the agent loop provider- and UI-agnostic.
- One source of truth for tool schemas: define them with zod via `defineTool`.
- Add unit tests for new tools, providers, and loop behavior (Vitest).
- Run `npm run lint && npm run typecheck && npm test` before considering a change done.

## Boundaries
- No business logic. This is a general-purpose tool.
- Don't add a second state paradigm or heavy dependencies without a clear reason.
- New deferred features go in `TODO.md` with a rationale and rough approach.
