---
name: memory-write
description: >
  Saves durable facts to context/MEMORY.md. Triggers on "remember this",
  "note that", "update memory", "save this", "forget about". Three actions:
  add (append under correct section), replace (substring match + swap),
  remove (confirm with user first). Enforces 2,500 char cap with dedup guard.
---

# Memory Write

## Outcome
- Fact added to, updated in, or removed from `context/MEMORY.md`
- Character cap enforced (2,500 chars)
- Confirmation message: "Saved — will be active from next session."

## Steps

1. Read `context/MEMORY.md` in full
2. Determine action: add, replace, or remove
3. **Dedup check**: scan for substring match — if the fact already exists, skip or update
4. **Cap check**: run `wc -c < context/MEMORY.md` — if over 2,500, consolidate before adding
5. Write the change
6. Confirm: "Saved — will be active from next session."

For **remove**: always confirm with the user before deleting.

## Sections in MEMORY.md
- `## Active Threads` — current work, open questions
- `## Environment Notes` — URLs, API keys (names only), tool versions, project structure
- `## Pending Decisions` — decisions that need to be made

## Rules
- Never exceed 2,500 characters
- Always check for duplicates before adding
- Replace is preferred over add when updating existing facts
