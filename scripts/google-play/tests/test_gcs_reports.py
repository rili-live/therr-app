import unittest
from datetime import date

from tests.fixtures import FakeStorageClient, installs_bucket, utf16
from therr_play import gcs_reports
from therr_play.settings import SettingsError


class MonthRangeTests(unittest.TestCase):
    def test_single_month(self):
        self.assertEqual(
            gcs_reports.month_range(date(2026, 8, 6), date(2026, 8, 30)), ["202608"]
        )

    def test_spans_month_boundary(self):
        self.assertEqual(
            gcs_reports.month_range(date(2026, 8, 6), date(2026, 9, 8)),
            ["202608", "202609"],
        )

    def test_spans_year_boundary(self):
        self.assertEqual(
            gcs_reports.month_range(date(2025, 12, 20), date(2026, 2, 3)),
            ["202512", "202601", "202602"],
        )

    def test_reversed_range_is_an_error(self):
        with self.assertRaises(SettingsError):
            gcs_reports.month_range(date(2026, 9, 1), date(2026, 8, 1))


class DecodeTests(unittest.TestCase):
    """The single most common silent failure with these exports."""

    def test_utf16_with_bom(self):
        self.assertEqual(gcs_reports._decode(utf16("Date,Installs\n")), "Date,Installs\n")

    def test_utf16_le_without_bom_is_sniffed(self):
        payload = "Date,Installs\n".encode("utf-16-le")
        self.assertEqual(gcs_reports._decode(payload), "Date,Installs\n")

    def test_utf8_still_works(self):
        self.assertEqual(gcs_reports._decode(b"Date,Installs\n"), "Date,Installs\n")

    def test_utf8_with_bom(self):
        self.assertEqual(
            gcs_reports._decode("Date,Installs\n".encode("utf-8-sig")), "Date,Installs\n"
        )


class ObjectPathTests(unittest.TestCase):
    def test_installs_path_shape(self):
        self.assertEqual(
            gcs_reports.object_path("installs", "com.therr.habits", "202608", "country"),
            "stats/installs/installs_com.therr.habits_202608_country.csv",
        )

    def test_store_performance_path_shape(self):
        self.assertEqual(
            gcs_reports.object_path(
                "store_performance", "app.therrmobile", "202609", "traffic_source"
            ),
            "stats/store_performance/store_performance_app.therrmobile_202609_"
            "traffic_source.csv",
        )


class FetchReportTests(unittest.TestCase):
    def setUp(self):
        self.client = FakeStorageClient(installs_bucket())

    def _fetch(self, **kwargs):
        params = dict(
            client=self.client,
            bucket_name="pubsite_prod_rev_1",
            kind="installs",
            package="com.therr.habits",
            start=date(2026, 8, 30),
            end=date(2026, 8, 31),
            dimension="overview",
        )
        params.update(kwargs)
        return gcs_reports.fetch_report(**params)

    def test_reads_utf16_rows(self):
        result = self._fetch()
        self.assertEqual(len(result.rows), 2)
        self.assertEqual(result.rows[0]["Daily Device Installs"], "7")

    def test_filters_to_the_requested_window(self):
        """1 Sep is inside the August file's month but outside the window."""
        result = self._fetch()
        self.assertNotIn("2026-09-01", [r["Date"] for r in result.rows])

    def test_concatenates_across_months(self):
        result = self._fetch(start=date(2026, 8, 30), end=date(2026, 9, 1))
        self.assertEqual(len(result.rows), 4)
        self.assertEqual(len(result.objects_found), 2)

    def test_missing_month_is_recorded_not_raised(self):
        result = self._fetch(start=date(2026, 7, 1), end=date(2026, 8, 31))
        self.assertIn(
            "stats/installs/installs_com.therr.habits_202607_overview.csv",
            result.objects_missing,
        )
        self.assertEqual(len(result.rows), 2)

    def test_wrong_package_is_distinguishable_from_no_data(self):
        result = self._fetch(package="com.therr.mobile")
        self.assertEqual(result.rows, [])
        self.assertEqual(result.objects_found, [])
        self.assertIn("package name is wrong", result.empty_reason())

    def test_empty_window_with_files_present_says_so(self):
        result = self._fetch(start=date(2026, 8, 1), end=date(2026, 8, 2))
        self.assertEqual(result.rows, [])
        self.assertTrue(result.objects_found)
        self.assertIn("date range", result.empty_reason())

    def test_row_cap_marks_truncation(self):
        result = self._fetch(start=date(2026, 8, 30), end=date(2026, 9, 1), max_rows=2)
        self.assertTrue(result.truncated)
        self.assertEqual(len(result.rows), 2)

    def test_unknown_kind_rejected(self):
        with self.assertRaises(SettingsError):
            self._fetch(kind="revenue")

    def test_dimension_not_published_by_google_is_rejected(self):
        """installs has no traffic_source breakdown; store_performance does."""
        with self.assertRaises(SettingsError) as ctx:
            self._fetch(dimension="traffic_source")
        self.assertIn("store_performance", str(ctx.exception).lower() or "")

    def test_store_performance_traffic_source(self):
        result = self._fetch(
            kind="store_performance",
            dimension="traffic_source",
            start=date(2026, 8, 30),
            end=date(2026, 8, 31),
        )
        sources = {r["Traffic Source"] for r in result.rows}
        self.assertEqual(sources, {"Play Store search", "Third-party referrers"})


class ListFilesTests(unittest.TestCase):
    def test_prefix_filter(self):
        client = FakeStorageClient(installs_bucket())
        names = gcs_reports.list_report_files(client, "b", "stats/store_performance/")
        self.assertEqual(len(names), 1)
        self.assertTrue(names[0].startswith("stats/store_performance/"))

    def test_limit_is_respected(self):
        client = FakeStorageClient(installs_bucket())
        self.assertEqual(len(gcs_reports.list_report_files(client, "b", "", limit=2)), 2)


if __name__ == "__main__":
    unittest.main()
