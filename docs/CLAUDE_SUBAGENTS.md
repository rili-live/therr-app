# Project subagents

Claude Code loads every `*.md` in `.claude/agents/` as a subagent, so this index lives here
rather than in that directory. Each subagent runs in its own context and returns a report,
so use them for work that reads a lot and hands back a verdict. Work that edits repo files
as part of the main session belongs in `.claude/skills/`.

| Agent | Use it when |
|---|---|
| `persona-walkthrough` | Before sending strangers to a funnel surface (landing page, `/register`, invite link, space page claim, mobile onboarding): simulates a specific cold visitor screen by screen |
| `codebase-archaeologist` | Deliberately, scoped to one subsystem: finds places where code written in different sessions has quietly stopped agreeing |
| `ui-finish-gate` | After a user-facing screen works and before it merges: PASS/HOLD on whether it reads as this product and handles its states |

Invoke by name, e.g. "run the persona-walkthrough agent on habits.therr.com as the
cold-install persona". All three are read-only. The calling session applies changes and
files follow-ups with `/github-issues defer`.

Related skills adapted from the same source: `aso-listing`, `ad-creative`.

## Provenance

These agents, and the `aso-listing` and `ad-creative` skills, are adapted from
[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents):
`design/design-persona-walkthrough.md`, `specialized/specialized-codebase-archaeologist.md`,
`design/design-ui-finish-gate-reviewer.md`, `marketing/marketing-app-store-optimizer.md`
and `paid-media/paid-media-creative-strategist.md`. The persona and methodology sections
were kept. The generic personality text and invented success metrics were removed, and each
was rewritten around this repo's surfaces, data sources, branch rules and backlog.

Other agents from that collection were reviewed and deliberately not adopted, because they
duplicate an existing skill or don't fit current scale (for example, the experiment tracker
assumes tens of thousands of users per variant).

The original work is under the MIT License:

> MIT License
>
> Copyright (c) 2025 AgentLand Contributors
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this
> software and associated documentation files (the "Software"), to deal in the Software
> without restriction, including without limitation the rights to use, copy, modify, merge,
> publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
> to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
> INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
> PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
> FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
> DEALINGS IN THE SOFTWARE.
