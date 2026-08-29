import tempfile
import unittest
from pathlib import Path

from tests import fixtures
from therr_ads.analysis import ActionItem, Diagnosis, Verdict, analyze
from therr_ads.settings import Targets
from therr_ads.workitems import (
    BEGIN_MARKER,
    END_MARKER,
    WIP_ANCHOR,
    render_block,
    upsert_block,
    write_actions,
)


def temp_doc(body: str) -> Path:
    handle = tempfile.NamedTemporaryFile("w", suffix=".md", delete=False)
    handle.write(body)
    handle.close()
    return Path(handle.name)


def diagnosis_with(actions):
    diagnosis = Diagnosis(window="2026-08-01 to 2026-08-14")
    diagnosis.actions = actions
    diagnosis.verdicts = [Verdict("MODEL", "UNVIABLE", "Cost per payer exceeds net unlock value.")]
    return diagnosis


class RenderTest(unittest.TestCase):
    def test_block_is_marker_delimited(self):
        block = render_block([], diagnosis_with([]), source="test")
        self.assertTrue(block.startswith(BEGIN_MARKER))
        self.assertIn(END_MARKER, block)

    def test_action_renders_as_an_unchecked_checkbox(self):
        actions = [ActionItem(1, "Do the thing", "Because of the data.", kind="code")]
        block = render_block(actions, diagnosis_with(actions))
        self.assertIn("- [ ] **(code, P1) Do the thing**", block)

    def test_multiline_rationale_is_collapsed_to_one_line(self):
        actions = [ActionItem(1, "T", "line one\n  line two\n\nline three")]
        block = render_block(actions, diagnosis_with(actions))
        self.assertIn("line one line two line three", block)

    def test_verdicts_are_included(self):
        block = render_block([], diagnosis_with([]))
        self.assertIn("**MODEL: UNVIABLE**", block)

    def test_empty_action_set_says_so_explicitly(self):
        self.assertIn("No action items", render_block([], diagnosis_with([])))


class UpsertTest(unittest.TestCase):
    def test_inserts_above_the_anchor(self):
        path = temp_doc(f"# Doc\n\nintro\n\n{WIP_ANCHOR}\n\ntail\n")
        upsert_block(path, render_block([], diagnosis_with([])), anchor=WIP_ANCHOR)
        text = path.read_text()
        self.assertLess(text.index(BEGIN_MARKER), text.index(WIP_ANCHOR))
        self.assertIn("tail", text)

    def test_rerun_replaces_rather_than_appends(self):
        path = temp_doc(f"# Doc\n\n{WIP_ANCHOR}\n\ntail\n")
        first = [ActionItem(1, "First finding", "why")]
        second = [ActionItem(1, "Second finding", "why")]
        upsert_block(path, render_block(first, diagnosis_with(first)), anchor=WIP_ANCHOR)
        upsert_block(path, render_block(second, diagnosis_with(second)), anchor=WIP_ANCHOR)
        text = path.read_text()
        self.assertEqual(text.count(BEGIN_MARKER), 1)
        self.assertEqual(text.count(END_MARKER), 1)
        self.assertNotIn("First finding", text)
        self.assertIn("Second finding", text)

    def test_content_outside_the_markers_is_never_touched(self):
        path = temp_doc(f"# Doc\n\nHAND WRITTEN NOTE\n\n{WIP_ANCHOR}\n\nTRAILING NOTE\n")
        for actions in ([ActionItem(1, "a", "b")], [ActionItem(2, "c", "d")]):
            upsert_block(path, render_block(actions, diagnosis_with(actions)), anchor=WIP_ANCHOR)
        text = path.read_text()
        self.assertIn("HAND WRITTEN NOTE", text)
        self.assertIn("TRAILING NOTE", text)

    def test_appends_when_the_anchor_is_absent(self):
        path = temp_doc("# Doc\n\nno anchor here\n")
        upsert_block(path, render_block([], diagnosis_with([])), anchor="## Nope")
        self.assertIn(BEGIN_MARKER, path.read_text())

    def test_refuses_to_create_a_missing_file(self):
        with self.assertRaises(FileNotFoundError):
            upsert_block(Path("/nonexistent/dir/doc.md"), "x")


class RoutingTest(unittest.TestCase):
    def test_actions_are_split_between_the_two_documents(self):
        wip = temp_doc(f"# WIP\n\n{WIP_ANCHOR}\n")
        playbook = temp_doc("# Playbook\n")
        actions = [
            ActionItem(1, "Code change", "r", target="wip", kind="code"),
            ActionItem(2, "Campaign decision", "r", target="playbook", kind="decision"),
        ]
        write_actions(actions, diagnosis_with(actions), wip, playbook)
        self.assertIn("Code change", wip.read_text())
        self.assertNotIn("Campaign decision", wip.read_text())
        self.assertIn("Campaign decision", playbook.read_text())
        self.assertNotIn("Code change", playbook.read_text())


class EndToEndTest(unittest.TestCase):
    """A realistic analyze -> write round trip, to catch integration drift."""

    def test_a_full_diagnosis_writes_both_documents(self):
        ads = fixtures.ads_report(
            [fixtures.app_campaign(cost="800", installs=100)],
            ad_groups=[
                fixtures.ad_group("accountability-partner", 60, 12),
                fixtures.ad_group("habit-tracker-generic", 80, 0),
            ],
            search_terms=[fixtures.search_term("free habit template", 20, 40)],
        )
        funnel = fixtures.funnel_report(
            [
                fixtures.funnel_row(campaign="(unattributed)", signups=200, payers=0),
                fixtures.funnel_row(signups=100, activated=8, payers=0),
            ]
        )
        diagnosis = analyze(ads, fixtures.ga4_report(["crawler"]), funnel, Targets())
        self.assertTrue(diagnosis.actions)

        wip = temp_doc(f"# WIP\n\n{WIP_ANCHOR}\n")
        playbook = temp_doc("# Playbook\n")
        results = write_actions(diagnosis.sorted_actions(), diagnosis, wip, playbook)
        self.assertEqual(len(results), 2)

        wip_text = wip.read_text()
        self.assertIn("Play Install Referrer", wip_text)
        self.assertIn("headless crawler", wip_text)
        self.assertIn("Paid acquisition — generated", wip_text)

        playbook_text = playbook.read_text()
        self.assertIn("Decide: fix creative", playbook_text)


if __name__ == "__main__":
    unittest.main()
