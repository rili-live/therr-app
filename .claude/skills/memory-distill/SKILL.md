---
name: memory-distill
description: >
  Turns past execution logs into durable memory. Aggregates the per-session digests
  (failed commands and what fixed them, permission refusals, hook errors, user
  corrections) and the daily logs since the last run, finds what repeats, and proposes
  promoting each lesson one rung up a ladder — MEMORY.md / USER.md → a package
  CLAUDE.md gotcha → a skill's known-failure section → a permission rule → a lint rule
  or test. Every promotion is shown as a diff for the user to approve. Use weekly (the
  session briefing nudges when it is due), after a run of sessions on one area, or
  when the same mistake has clearly happened twice.
allowed-tools: Bash(node scripts/memory-distill/*), Bash(git log*), Bash(git diff*), Bash(git status*), Bash(wc*), Read, Edit, Write, Grep, Glob, AskUserQuestion, Skill, mcp__github__search_pull_requests, mcp__github__pull_request_read
---

# Memory Distill

The memory system stores a lot: one daily log per working day, plus a digest per
session (`.claude/hooks/session-digest.js`). Before this skill, nothing ever moved a
lesson out of a log into a place the next session reads at the moment it matters.
So the same gotchas came back, and `MEMORY.md` sat nearly empty. This skill is that
promotion step. The aggregation is deterministic and cheap. Your job is judgment:
what is worth keeping, and where it belongs.

## 1. Aggregate

```bash
node scripts/memory-distill/index.js            # since the last run (or 30 days)
node scripts/memory-distill/index.js --since 2026-09-01
```

The report is short by design (one screen). Don't read the daily logs it summarizes
unless a candidate needs its context; open just that `file:line`.

Digests are machine-local (gitignored). On a fresh machine, or in a cloud session,
the report has only daily-log signal. Say so rather than presenting the digest
sections as "nothing went wrong".

## 2. Optional: review findings on merged PRs

Review-bot findings are an independent record of mistakes agents make here. If GitHub PR
tools are available (cloud sessions have them; locally, start the MCP server with
`THERR_GITHUB_MCP_TOOLSETS=issues,labels,pull_requests`), search
`repo:rili-live/therr-app is:pr is:merged merged:>=<since>` and read the review comments
on at most 10 PRs. A finding class that appears in **two or more PRs** is a candidate;
one-offs are not.

## 3. Place each candidate on the ladder

Use the **lowest rung that will be read at the moment the lesson matters**. Promote one
rung at a time. A lesson goes to a lint rule only after it has already lived on a lower
rung and still repeated.

| Rung | Target | Holds | Evidence needed |
|---|---|---|---|
| 0 | drop | One-offs, things already promoted (the report marks them), anything stale | — |
| 1 | `context/MEMORY.md` | True for the next few weeks: open threads, temporary environment state, pending decisions. Prefix each entry `(YYYY-MM-DD)` so rung 0 can expire it | one session is enough |
| 1 | `context/USER.md` | How this user likes to work: preferences, corrections they've made, what they want asked versus decided | the same correction or preference in **2+ sessions** |
| 2 | a package's `CLAUDE.md` | A durable fact about that package's code that isn't inferable from it | a log lesson, or a repeat |
| 3 | the relevant skill (a `## Known failure modes` section), or `steward` §3/§5 | A failure that happens *while doing that skill's job* | a repeat, or one costly incident |
| 4 | `.claude/settings.json` `permissions.ask` | A read-only command refused 2+ times. Propose `ask`, never `allow`, and never for anything that mutates production | 2+ refusals in the report |
| 5 | a lint rule, test or gate check | A repeat that can be detected mechanically, and still repeated after rung 2 or 3 | a repeat *after* a lower-rung promotion |

Rung 5 is usually bigger than a distill session should take on. File it with
`/github-issues defer` (naming the evidence) unless the check is a few lines.

While you're in `MEMORY.md`, **demote** too: propose removing entries older than about 30
days, contradicted by the code, or now promoted higher. Stay under the 2,500-character
cap (`/memory-write` rules apply).

## 4. Propose, then apply what's approved

Show one compact table: candidate · evidence (`file:line`, digest dates or PR numbers) ·
rung · target file · the one-line change. Then ask which to apply. Use
`AskUserQuestion` with `multiSelect` when there are four or fewer. Otherwise list them
numbered and ask for the numbers.

Apply only what's approved. Keep the wording terse and in the target file's existing
voice. A gotcha line in a CLAUDE.md says what goes wrong and what to do, not the
story of how it was found.

## 5. Close the loop

```bash
node scripts/memory-distill/index.js --mark     # records today in context/memory/.distill-state.json
```

Log one line in today's daily log (`- Distill: N promoted (rungs …), M dropped, K filed`).

Promotions to CLAUDE.md files, skills and settings are shared harness: they land on
`general` like any other shared change, in their own commit. Never mix them with feature
work. `MEMORY.md`, `USER.md` and `.distill-state.json` can ride on whatever branch you're on.

## What not to do

- Don't promote from a single digest error. A failure that happened once is noise
  until it happens again. The exception is a costly incident a daily log already
  calls out as a lesson.
- Don't copy digest text (commands, error output) into tracked files without reading
  it. Digests are redacted, but redaction is pattern-based.
- Don't write rung 1 entries without a date. Undated memory never expires, and stale
  memory is worse than none.
