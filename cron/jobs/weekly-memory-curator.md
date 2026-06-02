---
name: Weekly Memory Curator
time: '09:00'
days: sun
active: 'true'
model: sonnet
notify: on_finish
description: 'Prunes, merges, and consolidates MEMORY.md entries'
timeout: 10m
retry: '0'
---

Read `context/MEMORY.md`. For each entry:
1. Is it still relevant? Remove if stale.
2. Are there duplicates? Merge them.
3. Can entries be consolidated? Combine related facts.

Keep under 2,500 chars. Log what was changed.
