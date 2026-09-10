"""MCP stdio server exposing Google Play metrics.

Registered in ~/.claude.json alongside analytics-mcp. See README.md.

DESIGN NOTE — WHY TOOLS RETURN PROVENANCE
Every report tool returns which bucket objects it read, which it could not find,
and whether the window includes a partial month. A Play report that comes back
empty is ambiguous between "wrong package name", "month not generated yet" and
"genuinely no installs", and an assistant reading these tools cannot tell those
apart from row counts. Returning the object list makes the difference visible
instead of leaving it to be guessed at, which is the failure mode that produces
confidently wrong growth analysis.
"""

from __future__ import annotations

import json
from datetime import date, timedelta

from therr_play import gcs_reports, publisher, reporting_api
from therr_play.auth import describe_failure, get_credentials
from therr_play.settings import SettingsError, load_settings

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:  # pragma: no cover - environment problem
    raise SystemExit(
        "The MCP SDK is not installed. From scripts/google-play:\n"
        "    python3 -m venv .venv && . .venv/bin/activate && "
        "pip install -r requirements.txt"
    )

mcp = FastMCP("google-play")

_state: dict[str, object] = {}


def _settings():
    if "settings" not in _state:
        _state["settings"] = load_settings()
    return _state["settings"]


def _credentials():
    if "credentials" not in _state:
        _state["credentials"] = get_credentials(_settings())
    return _state["credentials"]


def _storage():
    if "storage" not in _state:
        _state["storage"] = gcs_reports.storage_client(_credentials())
    return _state["storage"]


def _reporting():
    if "reporting" not in _state:
        _state["reporting"] = reporting_api.reporting_client(_credentials())
    return _state["reporting"]


def _publisher():
    if "publisher" not in _state:
        _state["publisher"] = publisher.publisher_client(_credentials())
    return _state["publisher"]


def _dates(start_date: str | None, end_date: str | None, default_days: int = 30):
    """Resolve a window, defaulting to the last N complete-ish days.

    The default end is 3 days ago, not today: Play data lags 2-3 days and a
    window ending today reliably shows a fake cliff at the right edge.
    """
    end = date.fromisoformat(end_date) if end_date else date.today() - timedelta(days=3)
    start = date.fromisoformat(start_date) if start_date else end - timedelta(days=default_days - 1)
    return start, end


def _dump(payload) -> str:
    return json.dumps(payload, indent=2, default=str)


def _report_payload(result: gcs_reports.ReportResult, start: date, end: date) -> dict:
    payload = {
        "kind": result.kind,
        "package": result.package,
        "dimension": result.dimension,
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "row_count": len(result.rows),
        "columns": result.columns,
        "rows": result.rows,
        "objects_read": result.objects_found,
    }
    if result.objects_missing:
        payload["objects_not_found"] = result.objects_missing
    if result.partial_months:
        payload["warning_partial_month"] = (
            f"Window includes the current month ({', '.join(result.partial_months)}), "
            "which Play has not finished writing. Play data lags 2-3 days; the last "
            "few days will read as a decline that is not real."
        )
    if result.truncated:
        payload["warning_truncated"] = (
            "Row cap reached. Narrow the date range or use a coarser dimension."
        )
    reason = result.empty_reason()
    if reason:
        payload["empty_reason"] = reason
    return payload


def _guard(fn):
    """Turn library exceptions into messages that name the fix."""
    try:
        return fn()
    except SettingsError as exc:
        return _dump({"error": str(exc)})
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller as text
        return _dump({"error": describe_failure(exc)})


@mcp.tool()
def play_list_apps() -> str:
    """List Play apps these credentials can see, plus the configured app keys.

    Run this first. It is the cheapest proof that auth, API enablement and the
    Play Console invitation are all in place.
    """

    def run():
        settings = _settings()
        configured = [
            {"key": a.key, "package": a.package, "label": a.label}
            for a in settings.apps.values()
        ]
        payload = {
            "configured_apps": configured,
            "default_app": settings.default_app,
            "bucket": settings.bucket or "(not set)",
        }
        try:
            payload["apps_visible_to_credentials"] = reporting_api.search_apps(_reporting())
        except Exception as exc:  # noqa: BLE001
            payload["apps_visible_to_credentials_error"] = describe_failure(exc)
        return _dump(payload)

    return _guard(run)


@mcp.tool()
def play_installs(
    app: str = "",
    dimension: str = "overview",
    start_date: str = "",
    end_date: str = "",
) -> str:
    """Daily installs, uninstalls and active devices from the Play reports bucket.

    dimension: overview | app_version | carrier | country | device | language | os_version
    Dates are ISO (YYYY-MM-DD). Defaults to the last 30 days ending 3 days ago,
    because Play data lags.
    """

    def run():
        settings = _settings()
        app_cfg = settings.app(app or None)
        start, end = _dates(start_date or None, end_date or None)
        result = gcs_reports.fetch_report(
            _storage(), settings.require_bucket(), "installs", app_cfg.package,
            start, end, dimension, settings.max_rows,
        )
        return _dump(_report_payload(result, start, end))

    return _guard(run)


@mcp.tool()
def play_acquisition(
    app: str = "",
    dimension: str = "traffic_source",
    start_date: str = "",
    end_date: str = "",
    deduplicated: bool = False,
) -> str:
    """Store listing visitors, acquisitions and conversion rate.

    The report that says whether a launch listing or a blog post produced
    installs. It exists nowhere else in the Play API surface.

    dimension: traffic_source | country.
    deduplicated=True reads the total_store_performance variant, which counts
    unique users over the period instead of summing daily rows — use it for a
    monthly total, because summing the daily file double-counts a returning
    visitor.

    Note: Google applies a privacy threshold to traffic_source. Below it every
    row collapses to "Other", which is what this account's volume currently
    produces. An all-"Other" result is a statement about volume, not a fault.
    """

    def run():
        settings = _settings()
        app_cfg = settings.app(app or None)
        start, end = _dates(start_date or None, end_date or None)
        kind = "total_store_performance" if deduplicated else "store_performance"
        result = gcs_reports.fetch_report(
            _storage(), settings.require_bucket(), kind, app_cfg.package,
            start, end, dimension, settings.max_rows,
        )
        return _dump(_report_payload(result, start, end))

    return _guard(run)


@mcp.tool()
def play_retention(app: str = "") -> str:
    """Explains why Play retention is not available as data, and what to use instead.

    Google retired the acquisition/retained_installers export. This developer
    account's bucket does not contain it, and the replacement is Play Console UI
    only. Kept as a tool so the answer is a sentence rather than an empty report
    that looks like a bug.
    """

    def run():
        settings = _settings()
        app_cfg = settings.app(app or None)
        return _dump(
            {
                "package": app_cfg.package,
                "available": False,
                "reason": gcs_reports.UNAVAILABLE_KINDS["retained_installers"],
                "verified_against_bucket": settings.require_bucket(),
            }
        )

    return _guard(run)


@mcp.tool()
def play_ratings(
    app: str = "", dimension: str = "overview", start_date: str = "", end_date: str = ""
) -> str:
    """Daily average rating and rating counts.

    dimension: overview | app_version | country | device | language | os_version
    """

    def run():
        settings = _settings()
        app_cfg = settings.app(app or None)
        start, end = _dates(start_date or None, end_date or None)
        result = gcs_reports.fetch_report(
            _storage(), settings.require_bucket(), "ratings", app_cfg.package,
            start, end, dimension, settings.max_rows,
        )
        return _dump(_report_payload(result, start, end))

    return _guard(run)


@mcp.tool()
def play_crashes(
    app: str = "", dimension: str = "overview", start_date: str = "", end_date: str = ""
) -> str:
    """Daily crash counts from the reports bucket.

    For rates rather than counts — crash rate per user, ANR rate — use
    play_vitals, which is user-weighted and is what Play's own quality
    thresholds are measured against.
    """

    def run():
        settings = _settings()
        app_cfg = settings.app(app or None)
        start, end = _dates(start_date or None, end_date or None)
        result = gcs_reports.fetch_report(
            _storage(), settings.require_bucket(), "crashes", app_cfg.package,
            start, end, dimension, settings.max_rows,
        )
        return _dump(_report_payload(result, start, end))

    return _guard(run)


@mcp.tool()
def play_reviews(app: str = "", start_date: str = "", end_date: str = "", live: bool = False) -> str:
    """Written reviews. Bucket by default (complete, monthly); live=True for the last week."""

    def run():
        settings = _settings()
        app_cfg = settings.app(app or None)
        if live:
            return _dump(
                {
                    "package": app_cfg.package,
                    "source": "androidpublisher reviews.list (last ~7 days)",
                    "reviews": publisher.list_reviews(_publisher(), app_cfg.package),
                }
            )
        start, end = _dates(start_date or None, end_date or None, default_days=60)
        result = gcs_reports.fetch_reviews(
            _storage(), settings.require_bucket(), app_cfg.package, start, end
        )
        return _dump(_report_payload(result, start, end))

    return _guard(run)


@mcp.tool()
def play_releases(app: str = "") -> str:
    """Current release state per track: versionCodes, rollout status and fraction.

    Use this to get the real x-axis for release attribution. A git merge date
    leads the date users actually received the code, sometimes by a week, so
    correlating a metric against merge dates overstates how fast a change took
    effect.
    """

    def run():
        settings = _settings()
        app_cfg = settings.app(app or None)
        return _dump(
            {
                "package": app_cfg.package,
                "tracks": publisher.list_tracks(_publisher(), app_cfg.package),
                "note": (
                    "Play does not expose a per-release publish timestamp here. This is "
                    "current state; for historical rollout dates use Play Console -> "
                    "Releases -> the track's release dashboard."
                ),
            }
        )

    return _guard(run)


@mcp.tool()
def play_vitals(
    app: str = "",
    metric_set: str = "crashrate",
    start_date: str = "",
    end_date: str = "",
    dimensions: str = "",
) -> str:
    """User-weighted app health over time.

    metric_set: crashrate | anrrate | slowstartrate | slowrenderingrate |
                excessivewakeuprate | stuckbackgroundwakelockrate | lmkrate
    dimensions: comma-separated, e.g. "versionCode" or "deviceModel".

    This API has NO install or acquisition data — use play_installs and
    play_acquisition for those.
    """

    def run():
        settings = _settings()
        app_cfg = settings.app(app or None)
        start, end = _dates(start_date or None, end_date or None)
        dims = [d.strip() for d in dimensions.split(",") if d.strip()]
        payload = reporting_api.query_vitals(
            _reporting(), metric_set, app_cfg.package, start, end, dimensions=dims
        )
        payload["window"] = {"start": start.isoformat(), "end": end.isoformat()}
        return _dump(payload)

    return _guard(run)


@mcp.tool()
def play_anomalies(app: str = "") -> str:
    """Anomalies Play's own detection has flagged for this app."""

    def run():
        settings = _settings()
        app_cfg = settings.app(app or None)
        return _dump(
            {
                "package": app_cfg.package,
                "anomalies": reporting_api.list_anomalies(_reporting(), app_cfg.package),
            }
        )

    return _guard(run)


@mcp.tool()
def play_list_report_files(prefix: str = "", limit: int = 200) -> str:
    """List raw objects in the reports bucket.

    The diagnostic escape hatch: when a report returns no rows, this settles
    whether the package name is wrong or Play simply has not generated the month.
    Useful prefixes: "stats/installs/", "stats/store_performance/", "reviews/".
    """

    def run():
        settings = _settings()
        return _dump(
            {
                "bucket": settings.require_bucket(),
                "prefix": prefix or "(root)",
                "objects": gcs_reports.list_report_files(
                    _storage(), settings.require_bucket(), prefix, limit
                ),
            }
        )

    return _guard(run)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
