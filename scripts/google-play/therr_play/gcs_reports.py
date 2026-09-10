"""The Play Console reports bucket: installs, acquisition, retention, ratings.

This module is the reason the tool exists. Everything a growth question needs —
how many installed, where they came from, how many stayed — is here and nowhere
else in the Play API surface.

FOUR THINGS THAT WILL WASTE YOUR TIME IF YOU DO NOT KNOW THEM

1. THE FILES ARE UTF-16, NOT UTF-8.
   Reading one as UTF-8 does not raise; it yields a header row with a NUL
   between every character, every column lookup misses, and the report comes
   back empty. `_decode` handles the BOM. This is the single most common
   silent failure with these exports.

2. THE FILES ARE MONTHLY, THE QUESTIONS ARE NOT.
   One object per package per month per dimension. A 34-day window spans two
   objects and a quarter spans four; `month_range` enumerates them and
   `fetch_report` concatenates, tolerating months that do not exist yet.

3. THE CURRENT MONTH IS PARTIAL AND LAGS 2-3 DAYS.
   Today's file exists but stops a few days back. A week-over-week comparison
   that includes the tail of the current month will always show a fake decline.
   Reports carry `partial_months` so callers can say so out loud.

4. A WRONG PACKAGE NAME LOOKS EXACTLY LIKE NO DATA.
   Both produce zero rows. `fetch_report` reports which object paths it tried,
   so an empty result can be told apart from a typo without guessing. The two
   Therr packages are app.therrmobile and com.therr.habits — note the flagship
   is NOT com.therr.mobile.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date

from therr_play.settings import SettingsError

# report kind -> (bucket prefix, filename stem, dimensions Google actually
# publishes). Asking for a dimension outside this set fetches an object that
# does not exist and returns nothing, so the set is enforced client-side.
REPORT_KINDS: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "installs": (
        "stats/installs",
        "installs",
        ("overview", "app_version", "carrier", "country", "device", "language", "os_version"),
    ),
    # The acquisition funnel: store listing visitors, acquisitions, and the
    # conversion rate between them.
    #
    # `traffic_source` is meant to split Play Store search from Explore from
    # third-party referrers — but Google applies a privacy threshold, and below
    # it every row collapses to the single value "Other". At Friends With
    # Habits' volume (a few hundred visitors a month) that is what you get, so
    # an all-"Other" result is a real answer about volume, not a broken report.
    "store_performance": (
        "stats/store_performance",
        "store_performance",
        ("country", "traffic_source"),
    ),
    # Same shape, unique-user-deduplicated across the period rather than summed
    # daily. Use it when a monthly total matters more than a daily series;
    # summing the daily file double-counts a user who visited on two days.
    "total_store_performance": (
        "stats/store_performance",
        "total_store_performance",
        ("country", "traffic_source"),
    ),
    "ratings": (
        "stats/ratings",
        "ratings",
        ("overview", "app_version", "carrier", "country", "device", "language", "os_version"),
    ),
    # Google's newer ratings shape, published alongside the old one rather than
    # replacing it. Both exist in the bucket; ratings_v2 has the shorter history.
    "ratings_v2": (
        "stats/ratings_v2",
        "ratings_v2",
        ("overview", "app_version", "carrier", "country", "device", "language", "os_version"),
    ),
    "crashes": (
        "stats/crashes",
        "crashes",
        ("overview", "app_version", "device", "device_name", "os_version"),
    ),
}

# Report kinds Google's documentation lists but which this developer account's
# bucket does not contain. Kept as a named set so the failure is a sentence
# explaining the situation rather than an empty result the caller has to
# interpret. Retention in particular is documented, sought often, and simply
# absent — Play retired the legacy acquisition/ exports and the replacement is
# UI-only, so retention has to come from the GA4 app property instead.
UNAVAILABLE_KINDS: dict[str, str] = {
    "retained_installers": (
        "Play retired the acquisition/retained_installers export and this developer "
        "account's bucket does not carry it. Retention is available in the Play Console "
        "UI only. For an analysable cohort, use the GA4 app property (267810693, stream "
        "'Friends with Habits') — but note it counts local development builds too, so "
        "read it against Play's install numbers rather than on its own."
    ),
    "buyers_7d": (
        "Not present in this bucket. Purchase data lives in the financial reports "
        "(sales/ and earnings/), which this tool does not read."
    ),
}


# Reviews are the one detailed report with no dimension in the filename.
REVIEWS_PREFIX = "reviews"


@dataclass
class ReportResult:
    kind: str
    package: str
    dimension: str
    rows: list[dict[str, str]] = field(default_factory=list)
    columns: list[str] = field(default_factory=list)
    objects_found: list[str] = field(default_factory=list)
    objects_missing: list[str] = field(default_factory=list)
    partial_months: list[str] = field(default_factory=list)
    truncated: bool = False

    def empty_reason(self) -> str | None:
        """Say why there are no rows, instead of leaving the caller to guess."""
        if self.rows:
            return None
        if not self.objects_found:
            return (
                f"No report objects existed for package '{self.package}'. Tried: "
                + ", ".join(self.objects_missing)
                + ". Either the package name is wrong, or Play has not generated these "
                "months yet. Use list_report_files to see what the bucket actually holds."
            )
        return (
            "Report objects existed but no rows fell inside the requested date range. "
            "Play data lags 2-3 days; check the window."
        )


def month_range(start: date, end: date) -> list[str]:
    """Every yyyyMM touched by [start, end], inclusive of both ends."""
    if end < start:
        raise SettingsError(f"end date {end} is before start date {start}.")
    months: list[str] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        months.append(f"{year:04d}{month:02d}")
        month += 1
        if month > 12:
            year, month = year + 1, 1
    return months


def _decode(payload: bytes) -> str:
    """Decode a Play report CSV.

    Play writes UTF-16 with a BOM. We branch on the BOM rather than always
    assuming UTF-16, because Google has quietly shipped UTF-8 for some report
    types and a hard assumption would break exactly when they change it again.
    """
    if payload[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return payload.decode("utf-16")
    if payload[:3] == b"\xef\xbb\xbf":
        return payload.decode("utf-8-sig")
    # No BOM. UTF-16 without one still has NULs in ASCII text; sniff for that
    # rather than returning a string full of them.
    if payload[:200].count(b"\x00") > len(payload[:200]) // 4:
        return payload.decode("utf-16-le", errors="replace")
    return payload.decode("utf-8", errors="replace")


def _date_column(columns: list[str]) -> str | None:
    for name in ("Date", "date"):
        if name in columns:
            return name
    return None


def _parse_csv(text: str) -> tuple[list[str], list[dict[str, str]]]:
    reader = csv.DictReader(io.StringIO(text))
    columns = [c.strip() for c in (reader.fieldnames or [])]
    rows = [{(k or "").strip(): (v or "") for k, v in row.items()} for row in reader]
    return columns, rows


def object_path(kind: str, package: str, month: str, dimension: str) -> str:
    prefix, stem, _ = REPORT_KINDS[kind]
    return f"{prefix}/{stem}_{package}_{month}_{dimension}.csv"


def fetch_report(
    client,
    bucket_name: str,
    kind: str,
    package: str,
    start: date,
    end: date,
    dimension: str = "overview",
    max_rows: int = 2000,
) -> ReportResult:
    """Pull one report kind across a date range and filter to the window."""
    if kind in UNAVAILABLE_KINDS:
        raise SettingsError(f"Report '{kind}' is not available. {UNAVAILABLE_KINDS[kind]}")
    if kind not in REPORT_KINDS:
        raise SettingsError(
            f"Unknown report kind '{kind}'. Available: {', '.join(sorted(REPORT_KINDS))}"
        )
    _, _, dimensions = REPORT_KINDS[kind]
    if dimension not in dimensions:
        # Point at the report that DOES carry this breakdown. The common case is
        # asking installs for traffic_source, which is a reasonable thing to want
        # and lives one report over in store_performance.
        elsewhere = [k for k, (_, _, dims) in REPORT_KINDS.items() if dimension in dims]
        hint = (
            f" '{dimension}' is published by: {', '.join(sorted(elsewhere))}."
            if elsewhere
            else ""
        )
        raise SettingsError(
            f"Report '{kind}' has no '{dimension}' breakdown. Google publishes: "
            f"{', '.join(dimensions)}.{hint}"
        )

    bucket = client.bucket(bucket_name)
    result = ReportResult(kind=kind, package=package, dimension=dimension)
    today = date.today()
    start_s, end_s = start.isoformat(), end.isoformat()

    for month in month_range(start, end):
        path = object_path(kind, package, month, dimension)
        blob = bucket.blob(path)
        if not blob.exists(client):
            result.objects_missing.append(path)
            continue
        result.objects_found.append(path)
        if month == f"{today.year:04d}{today.month:02d}":
            result.partial_months.append(month)

        columns, rows = _parse_csv(_decode(blob.download_as_bytes()))
        for column in columns:
            if column not in result.columns:
                result.columns.append(column)

        date_col = _date_column(columns)
        for row in rows:
            # Rows without a date column (some aggregate shapes) pass through
            # whole; the month boundary is the only filter available for them.
            if date_col and not (start_s <= row.get(date_col, "") <= end_s):
                continue
            result.rows.append(row)
            if len(result.rows) >= max_rows:
                result.truncated = True
                return result
    return result


def fetch_reviews(
    client, bucket_name: str, package: str, start: date, end: date, max_rows: int = 500
) -> ReportResult:
    """Reviews are a detailed report: one file per month, no dimension suffix."""
    bucket = client.bucket(bucket_name)
    result = ReportResult(kind="reviews", package=package, dimension="none")
    for month in month_range(start, end):
        path = f"{REVIEWS_PREFIX}/reviews_{package}_{month}.csv"
        blob = bucket.blob(path)
        if not blob.exists(client):
            result.objects_missing.append(path)
            continue
        result.objects_found.append(path)
        columns, rows = _parse_csv(_decode(blob.download_as_bytes()))
        for column in columns:
            if column not in result.columns:
                result.columns.append(column)
        result.rows.extend(rows)
        if len(result.rows) >= max_rows:
            result.rows = result.rows[:max_rows]
            result.truncated = True
            break
    return result


def list_report_files(client, bucket_name: str, prefix: str = "", limit: int = 200) -> list[str]:
    """Raw listing. The escape hatch when a report comes back empty.

    Seeing the real object names settles the package-name-vs-no-data ambiguity
    in one call, which is why this is exposed as a tool rather than kept private.
    """
    bucket = client.bucket(bucket_name)
    names: list[str] = []
    for blob in client.list_blobs(bucket, prefix=prefix or None):
        names.append(blob.name)
        if len(names) >= limit:
            break
    return names


def storage_client(credentials):
    try:
        from google.cloud import storage
    except ImportError as exc:  # pragma: no cover - environment problem
        raise SettingsError(
            "google-cloud-storage is not installed. From scripts/google-play:\n"
            "    python3 -m venv .venv && . .venv/bin/activate && "
            "pip install -r requirements.txt"
        ) from exc
    # The bucket is billed to Google's own project, so no project= is passed;
    # supplying ours makes requests fail with a confusing billing error.
    return storage.Client(credentials=credentials, project=None)
