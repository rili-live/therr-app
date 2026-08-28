"""Write action items into docs/WORK_IN_PROGRESS.md and the playbook.

IDEMPOTENT BY MARKER BLOCK
Everything this module writes lives between a matched pair of HTML comments:

    <!-- BEGIN therrads:generated -->
    ...
    <!-- END therrads:generated -->

A re-run REPLACES the block rather than appending. Without that, a weekly run
would grow WORK_IN_PROGRESS.md by a section every Monday and the backlog would
become a changelog. Everything outside the markers is never touched — hand-added
notes inside a generated section will be lost, so the block says so in its
header.

WHY IT WRITES TO THE REPO AT ALL
docs/WORK_IN_PROGRESS.md is where this codebase's agents are told to look for
work (root CLAUDE.md § Backlog). An action item that lives only in a terminal
scrollback is not a work item; one in the backlog file gets picked up by
/work-plan and by the next session that reads the doc. That is the whole
integration: the analyzer's output has to land where the next agent already looks.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

BEGIN_MARKER = "<!-- BEGIN therrads:generated -->"
END_MARKER = "<!-- END therrads:generated -->"

# Anchor in WORK_IN_PROGRESS.md. The generated block is inserted immediately
# before this heading so it lands inside § Manual Operational Follow-ups, where
# CLAUDE.md tells agents to scan at session start.
WIP_ANCHOR = "## Skill-generated items (auto-appended)"


def render_block(actions, diagnosis, source: str = "therrads analyze") -> str:
    """Render the marker-delimited markdown block for a set of action items."""
    today = date.today().isoformat()
    lines = [
        BEGIN_MARKER,
        "",
        f"### Paid acquisition — generated {today} by `{source}`",
        "",
        f"> Auto-generated from Google Ads + GA4 + product funnel data for **{diagnosis.window}**.",
        "> This whole block is REPLACED on the next run — do not edit inside the markers, and if you",
        f"> action an item, delete its bullet and note the outcome outside the block.",
        "> Regenerate: `cd scripts/google-ads && ./therrads analyze --days 14 --write-work-items`",
        "",
    ]

    if diagnosis.verdicts:
        lines.append("**Verdicts:**")
        lines.append("")
        for verdict in diagnosis.verdicts:
            lines.append(f"- **{verdict.area}: {verdict.call}** — {_one_line(verdict.reasoning)}")
        lines.append("")

    if not actions:
        lines += ["No action items — every measured signal was inside target.", "", END_MARKER, ""]
        return "\n".join(lines)

    lines.append("**Action items:**")
    lines.append("")
    for action in actions:
        lines.append(f"- [ ] **({action.kind}, P{action.priority}) {action.title}**")
        lines.append(f"  {_one_line(action.rationale)}")
    lines += ["", END_MARKER, ""]
    return "\n".join(lines)


def _one_line(text: str) -> str:
    return " ".join(str(text).split())


def upsert_block(path: Path, block: str, anchor: str | None = None) -> str:
    """Insert or replace the generated block in `path`. Returns what it did.

    Never creates the file: writing a backlog document into existence from a
    reporting script would be a surprising side effect, and a missing path here
    means settings.yaml -> outputs points somewhere wrong.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(
            f"{path} does not exist. Check settings.yaml -> outputs; paths are resolved relative to "
            "scripts/google-ads/."
        )

    text = path.read_text()

    if BEGIN_MARKER in text and END_MARKER in text:
        start = text.index(BEGIN_MARKER)
        end = text.index(END_MARKER) + len(END_MARKER)
        # Preserve whatever trailing newline the old block had, so repeated runs
        # do not slowly accumulate or shed blank lines.
        updated = text[:start] + block.rstrip("\n") + text[end:]
        path.write_text(updated)
        return f"replaced generated block in {path}"

    if anchor and anchor in text:
        index = text.index(anchor)
        updated = text[:index] + block.rstrip("\n") + "\n\n" + text[index:]
        path.write_text(updated)
        return f"inserted generated block above {anchor!r} in {path}"

    separator = "" if text.endswith("\n\n") else ("\n" if text.endswith("\n") else "\n\n")
    path.write_text(text + separator + block)
    return f"appended generated block to {path}"


def write_actions(actions, diagnosis, wip_path: Path | None, playbook_path: Path | None) -> list[str]:
    """Split actions by target and write each set to its document."""
    results: list[str] = []

    wip_actions = [a for a in actions if a.target == "wip"]
    playbook_actions = [a for a in actions if a.target == "playbook"]

    if wip_path is not None:
        results.append(
            upsert_block(wip_path, render_block(wip_actions, diagnosis), anchor=WIP_ANCHOR)
        )
    if playbook_path is not None:
        results.append(upsert_block(playbook_path, render_block(playbook_actions, diagnosis)))

    return results
