---
name: review
description: Review the staged git diff for bugs and risky changes
argument-hint: "[focus area]"
---

Review the currently staged changes. First run `git diff --cached` to see them.
Then report, concisely:
- Bugs or correctness issues
- Risky or breaking changes
- Missing tests for new behavior

Focus on: $ARGUMENTS
