---
name: doc-drift
description: Check whether recent commits have made the root CLAUDE.md, docs/README.md, or key docs stale — new packages not listed, changed build commands, dependency version drift, new brand variants, or product changes that invalidate documented strategy. Run deliberately after a batch of work or before a release, not on every session.
user-invocable: true
allowed-tools: Bash(git log*), Bash(git diff*), Bash(git status*), Bash(ls*), Bash(wc*), Read, Glob, Grep, Edit
argument-hint: [check|fix] [--since <ref>]
---

# Doc Drift

## Why this is a skill and not a session hook

This ran as a `SessionStart` hook, spending two `git` calls plus reasoning on **every
session** — including the many that never touch a documented surface. Documentation drift
accrues over weeks, not over single sessions, so paying that cost per-session bought very
little. It is now invoked when it is actually likely to find something: after a batch of
work, before a release, or when a package or dependency has moved.

## Outcome

- A short list of specific doc sections that no longer match the code, each with the
  evidence that contradicts them
- With `fix`: those sections updated
- Silence when nothing has drifted — do not manufacture findings

## Steps

### 1. Establish what changed

```bash
git log --oneline -30 --no-merges
git diff --name-only HEAD~30 HEAD
```

Use `--since <ref>` if the user supplies one (e.g. `--since origin/stage`). Prefer the
last release tag or the last merge to `stage` over a fixed commit count when one exists.

### 2. Check each claim that is cheap to falsify

Only these — this is a drift check, not a documentation review.

| Claim in docs | How to falsify it |
|---|---|
| Package list in `CLAUDE.md` "Monorepo Structure" | `ls -d */ therr-services/*/ therr-public-library/*/` |
| Node / npm versions | `cat .nvmrc`, `engines` in root `package.json` |
| React / RN / TypeScript versions | `package.json` and `TherrMobile/package.json` |
| Build/lint/test commands | `scripts` in root `package.json` — do the documented ones still exist? |
| `BrandVariations` enum members | `therr-public-library/therr-js-utilities/src/constants/enums/Branding.ts` |
| Locale list (`en-us`, `es`, `fr-ca`) | `scripts/locale-check/package-targets.json` |
| Ports in "Monorepo Structure" | `docker-compose.dev.yml` |
| Every `docs/*.md` is linked from `docs/README.md` | compare `ls docs/*.md` against links in the index |
| Skills referenced by `CLAUDE.md` exist | `ls .claude/skills/` |
| CI job names cited in docs | `.circleci/config.yml` |

### 3. Check strategy docs only if the product moved

If commits touched pricing, onboarding, the claim funnel, or a brand's status, re-read
`docs/GROWTH_STRATEGY.md`, `docs/TARGET_MARKETS.md`, and the relevant
`docs/niche-sub-apps/*_PROJECT_BRIEF.md` for assumptions the change invalidates.

Skip this entirely for routine code changes.

### 4. Report

For each finding, give the doc, the line or section, the claim, and the contradicting
evidence. Keep it to the 1–3 that matter. Example:

> `CLAUDE.md` "Key Dependencies" says React Native 0.83.6, but
> `TherrMobile/package.json` now pins 0.84.1 (commit `abc1234`).

If invoked as `fix`, apply the edits. Otherwise stop at the report.

### 5. Say nothing when nothing drifted

A clean result is one line: "No drift found across N commits." Do not pad it.

## Guardrails

- **Do not rewrite prose you merely dislike.** Only factual contradictions count.
- **Do not grow `CLAUDE.md`.** It is deliberately ~250 lines; long always-on context
  measurably degrades agent performance. If a section needs more detail, move it to a
  doc or a skill and leave a pointer.
- Corrections to package-level `CLAUDE.md` files must respect branch rules — those under
  `therr-services/`, `therr-api-gateway/`, and `therr-public-library/` belong on `general`.
