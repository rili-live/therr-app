"""Play Developer Reporting API: vitals and anomalies. NOT installs.

Worth stating plainly because the name misleads: this API reports on app health,
not on the business. Crash rate, ANR rate, slow starts, memory, error clusters,
and Play's own anomaly detection. There is no installs metric set, no
acquisition metric set, and no revenue. Those live in the Cloud Storage bucket —
see gcs_reports.py.

WHY IT IS HERE ANYWAY
A 35% uninstall rate has two explanations, and this API separates them: users
who did not want the product, versus users whose app crashed. Reading crash rate
against the same release window as an install curve turns a guess into a fact.

TIMELINE SPEC, NOT DATE STRINGS
Every query takes a `timelineSpec` with an aggregation period (DAILY, HOURLY,
FULL_RANGE) and start/stop points expressed as structured date objects, not ISO
strings. Daily metrics are also user-weighted 7-day and 28-day rolling values,
so a "daily" crash rate is already smoothed; do not re-smooth it.
"""

from __future__ import annotations

from datetime import date

from therr_play.settings import SettingsError

# The vitals metric sets: method name -> (REST resource name, metrics returned).
#
# The two names are NOT derivable from each other, and this is the one thing
# about this API that will definitely trip you up. The client method is all
# lowercase (`service.vitals().crashrate()`), while the resource name in the
# request body is camelCase with a capitalised suffix
# (`apps/{pkg}/crashRateMetricSet`). Constructing the second from the first by
# concatenation produces a 400 that quotes the regex at you and explains
# nothing. Both spellings are therefore written out here.
#
# Asking for a metric belonging to a different set returns a 400 naming neither,
# which is why the metric list is pinned per set rather than passed through.
VITALS_SETS: dict[str, tuple[str, tuple[str, ...]]] = {
    "crashrate": ("crashRateMetricSet", ("crashRate", "userPerceivedCrashRate", "distinctUsers")),
    "anrrate": ("anrRateMetricSet", ("anrRate", "userPerceivedAnrRate", "distinctUsers")),
    "slowstartrate": ("slowStartRateMetricSet", ("slowStartRate", "distinctUsers")),
    "slowrenderingrate": (
        "slowRenderingRateMetricSet",
        ("slowRenderingRate20Fps", "slowRenderingRate30Fps", "distinctUsers"),
    ),
    "excessivewakeuprate": (
        "excessiveWakeupRateMetricSet",
        ("excessiveWakeupRate", "distinctUsers"),
    ),
    "stuckbackgroundwakelockrate": (
        "stuckBackgroundWakelockRateMetricSet",
        ("stuckBgWakelockRate", "distinctUsers"),
    ),
    "lmkrate": ("lmkRateMetricSet", ("lmkRate", "userPerceivedLmkRate", "distinctUsers")),
}


def reporting_client(credentials):
    try:
        from googleapiclient.discovery import build
    except ImportError as exc:  # pragma: no cover - environment problem
        raise SettingsError(
            "google-api-python-client is not installed. From scripts/google-play:\n"
            "    python3 -m venv .venv && . .venv/bin/activate && "
            "pip install -r requirements.txt"
        ) from exc
    return build(
        "playdeveloperreporting", "v1beta1", credentials=credentials, cache_discovery=False
    )


def _point(d: date) -> dict:
    return {"year": d.year, "month": d.month, "day": d.day}


def timeline_spec(start: date, end: date, period: str = "DAILY") -> dict:
    return {
        "aggregationPeriod": period,
        "startTime": _point(start),
        "endTime": _point(end),
    }


def query_vitals(
    service,
    metric_set: str,
    package: str,
    start: date,
    end: date,
    metrics: list[str] | None = None,
    dimensions: list[str] | None = None,
    page_size: int = 200,
) -> dict:
    """Query one vitals metric set for one app."""
    if metric_set not in VITALS_SETS:
        raise SettingsError(
            f"Unknown vitals metric set '{metric_set}'. Available: "
            f"{', '.join(sorted(VITALS_SETS))}. Note this API has no installs or "
            "acquisition data at all — that is the reports bucket."
        )
    resource_name, default_metrics = VITALS_SETS[metric_set]
    metrics = metrics or list(default_metrics)
    body = {
        "timelineSpec": timeline_spec(start, end),
        "metrics": metrics,
        "dimensions": dimensions or [],
        "pageSize": page_size,
    }
    resource = getattr(service.vitals(), metric_set)()
    response = resource.query(name=f"apps/{package}/{resource_name}", body=body).execute()

    rows = []
    for row in response.get("rows", []):
        flat: dict[str, object] = {}
        start_time = row.get("startTime", {})
        if start_time:
            flat["date"] = (
                f"{start_time.get('year'):04d}-"
                f"{start_time.get('month', 1):02d}-{start_time.get('day', 1):02d}"
            )
        for dim in row.get("dimensions", []):
            flat[dim.get("dimension", "?")] = (
                dim.get("stringValue") or dim.get("int64Value") or dim.get("valueLabel")
            )
        for metric in row.get("metrics", []):
            value = metric.get("decimalValue", {}).get("value")
            if value is None:
                value = metric.get("int64Value")
            flat[metric.get("metric", "?")] = value
        rows.append(flat)
    return {"metricSet": metric_set, "package": package, "rows": rows}


def list_anomalies(service, package: str, page_size: int = 25) -> list[dict]:
    """Play's own detected anomalies — spikes it thinks are worth your attention."""
    response = (
        service.anomalies()
        .list(parent=f"apps/{package}", pageSize=page_size)
        .execute()
    )
    out = []
    for anomaly in response.get("anomalies", []):
        out.append(
            {
                "name": anomaly.get("name"),
                "metricSet": anomaly.get("metricSet"),
                "timelineSpec": anomaly.get("timelineSpec"),
                "dimensions": anomaly.get("dimensions"),
                "metric": anomaly.get("metric"),
            }
        )
    return out


def search_apps(service, page_size: int = 50) -> list[dict]:
    """Every app this credential can see. The fastest proof that auth works."""
    response = service.apps().search(pageSize=page_size).execute()
    return [
        {"name": app.get("name"), "packageName": app.get("packageName"),
         "displayName": app.get("displayName")}
        for app in response.get("apps", [])
    ]
