"""The edit lifecycle is the only stateful thing this tool does. Pin it."""

import unittest

from therr_play import publisher, reporting_api
from therr_play.settings import SettingsError


class FakeExecutable:
    def __init__(self, result=None, error: Exception | None = None):
        self._result = result
        self._error = error

    def execute(self):
        if self._error:
            raise self._error
        return self._result


class FakeTracks:
    def __init__(self, responses: dict):
        self._responses = responses

    def get(self, packageName, editId, track):
        if track not in self._responses:
            return FakeExecutable(error=RuntimeError(f"404 track {track} not found"))
        return FakeExecutable(self._responses[track])


class FakeEdits:
    def __init__(self, responses: dict):
        self._responses = responses
        self.inserted = 0
        self.deleted: list[str] = []

    def insert(self, body, packageName):
        self.inserted += 1
        return FakeExecutable({"id": "edit-1"})

    def delete(self, packageName, editId):
        self.deleted.append(editId)
        return FakeExecutable({})

    def tracks(self):
        return FakeTracks(self._responses)


class FakeService:
    def __init__(self, responses: dict):
        self._edits = FakeEdits(responses)

    def edits(self):
        return self._edits


PRODUCTION = {
    "track": "production",
    "releases": [
        {
            "name": "1.5.2",
            "status": "completed",
            "versionCodes": ["37"],
            "userFraction": None,
            "releaseNotes": [{"language": "en-US", "text": "Streak freeze"}],
        }
    ],
}


class ListTracksTests(unittest.TestCase):
    def test_reads_releases(self):
        service = FakeService({"production": PRODUCTION})
        tracks = publisher.list_tracks(service, "com.therr.habits", ("production",))
        self.assertEqual(tracks[0]["releases"][0]["versionCodes"], ["37"])
        self.assertEqual(tracks[0]["releases"][0]["status"], "completed")

    def test_edit_is_always_deleted(self):
        """A dangling edit holds a lock that breaks the next call."""
        service = FakeService({"production": PRODUCTION})
        publisher.list_tracks(service, "com.therr.habits", ("production",))
        self.assertEqual(service.edits().deleted, ["edit-1"])

    def test_edit_deleted_even_when_a_track_read_raises(self):
        service = FakeService({})
        publisher.list_tracks(service, "com.therr.habits", ("production", "beta"))
        self.assertEqual(service.edits().deleted, ["edit-1"])

    def test_unused_track_is_reported_not_fatal(self):
        service = FakeService({"production": PRODUCTION})
        tracks = publisher.list_tracks(service, "com.therr.habits", ("production", "alpha"))
        by_track = {t["track"]: t for t in tracks}
        self.assertEqual(by_track["production"]["releases"][0]["name"], "1.5.2")
        self.assertIn("error", by_track["alpha"])
        self.assertEqual(by_track["alpha"]["releases"], [])

    def test_never_commits(self):
        service = FakeService({"production": PRODUCTION})
        self.assertFalse(hasattr(service.edits(), "committed"))
        publisher.list_tracks(service, "com.therr.habits", ("production",))
        self.assertEqual(service.edits().inserted, 1)


class VitalsGuardTests(unittest.TestCase):
    def test_unknown_metric_set_says_where_installs_live(self):
        with self.assertRaises(SettingsError) as ctx:
            reporting_api.query_vitals(None, "installs", "com.therr.habits", None, None)
        message = str(ctx.exception)
        self.assertIn("no installs", message)
        self.assertIn("reports bucket", message)

    def test_resource_names_are_camel_case_not_the_method_name(self):
        """apps/{pkg}/crashRateMetricSet — concatenating the method name 400s."""
        from therr_play.reporting_api import VITALS_SETS

        self.assertEqual(VITALS_SETS["crashrate"][0], "crashRateMetricSet")
        self.assertEqual(VITALS_SETS["anrrate"][0], "anrRateMetricSet")
        self.assertEqual(
            VITALS_SETS["stuckbackgroundwakelockrate"][0],
            "stuckBackgroundWakelockRateMetricSet",
        )
        for method, (resource, metrics) in VITALS_SETS.items():
            self.assertTrue(resource.endswith("MetricSet"), method)
            self.assertNotEqual(resource, method + "Metricset", method)
            self.assertTrue(metrics, method)

    def test_timeline_spec_uses_structured_dates(self):
        from datetime import date

        spec = reporting_api.timeline_spec(date(2026, 8, 6), date(2026, 9, 8))
        self.assertEqual(spec["startTime"], {"year": 2026, "month": 8, "day": 6})
        self.assertEqual(spec["aggregationPeriod"], "DAILY")


if __name__ == "__main__":
    unittest.main()
