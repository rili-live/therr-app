"""GA4 Data API — the web half of the funnel.

WHAT GA4 CAN AND CANNOT SEE HERE, which is the whole reason this module is
small and heavily caveated:

  CAN   Sessions, landing pages and events on habits.therr.com, therr.com,
        dashboard.therr.com and therr.app — every surface that loads gtag.
        Session source/medium, so a `google / cpc` session traces to a campaign.
  CANNOT  Anything inside the Android app. Friends with Habits ships Firebase
        for messaging, not a GA4 app data stream, so installs, first opens,
        pact creation and the $20 Founder Unlock are invisible here. Do not
        read a GA4 conversion number as an app conversion number.

TWO PROPERTY-SPECIFIC HAZARDS, both recorded in
docs/WORK_IN_PROGRESS.md § Analytics & traffic:

  1. A headless-Chrome crawler produced ~87% of sessions in the consolidated
     property over the 60 days to 23 Aug 2026 — Singapore desktop, 1280x1200 and
     800x600, ~17s duration, 2.1% engagement, walking /spaces/*. GA4's IAB bot
     filter does not catch it and a GA4 data filter CANNOT exclude it (data
     filters only support Developer and Internal traffic). Until it is blocked
     at the edge, unfiltered session totals are inflated roughly 8x. `crawler_guard`
     re-runs each report split by engagement and flags the discrepancy rather
     than letting an inflated total be read as growth.
  2. `surface` is sent on every hit but is not yet registered as a custom
     dimension, so `customEvent:surface` returns HTTP 400 for the whole report,
     not an empty column. Guarded by settings.ga4.surface_dimension_registered.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from therr_ads.reporting import date_range

# Engagement floor below which a traffic slice looks automated rather than
# human. The observed crawler sat at 2.1%; real campaign traffic to a landing
# page runs well north of 40%.
CRAWLER_ENGAGEMENT_CEILING = Decimal("0.10")
CRAWLER_MIN_SESSIONS = 50


@dataclass
class Ga4Row:
    dimensions: dict
    sessions: int = 0
    engaged_sessions: int = 0
    active_users: int = 0
    new_users: int = 0
    conversions: Decimal = Decimal("0")

    @property
    def engagement_rate(self) -> Decimal:
        if not self.sessions:
            return Decimal("0")
        return (Decimal(self.engaged_sessions) / Decimal(self.sessions)).quantize(Decimal("0.0001"))

    def to_dict(self) -> dict:
        return {
            **self.dimensions,
            "sessions": self.sessions,
            "engaged_sessions": self.engaged_sessions,
            "active_users": self.active_users,
            "new_users": self.new_users,
            "conversions": float(self.conversions),
            "engagement_rate": float(self.engagement_rate),
        }


@dataclass
class Ga4Report:
    property_id: str
    start_date: str
    end_date: str
    by_campaign: list[Ga4Row] = field(default_factory=list)
    by_landing_page: list[Ga4Row] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "property_id": self.property_id,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "by_campaign": [r.to_dict() for r in self.by_campaign],
            "by_landing_page": [r.to_dict() for r in self.by_landing_page],
            "notes": self.notes,
            "warnings": self.warnings,
        }


def detect_crawler_contamination(rows: list[Ga4Row]) -> list[str]:
    """Flag slices whose shape matches the known crawler. Pure — unit tested.

    Deliberately reports rather than filters. Silently dropping rows would make
    the tool disagree with the GA4 UI with no explanation, and the right fix is
    an edge block, not a reporting workaround.
    """
    warnings: list[str] = []
    total = sum(r.sessions for r in rows)
    if not total:
        return warnings

    suspect = [
        r
        for r in rows
        if r.sessions >= CRAWLER_MIN_SESSIONS and r.engagement_rate <= CRAWLER_ENGAGEMENT_CEILING
    ]
    suspect_sessions = sum(r.sessions for r in suspect)
    if not suspect_sessions:
        return warnings

    share = Decimal(suspect_sessions) / Decimal(total)
    labels = ", ".join(
        str(r.dimensions.get("sessionCampaignName") or r.dimensions.get("landingPage") or "(unnamed)")
        for r in suspect[:5]
    )
    warnings.append(
        f"{suspect_sessions} of {total} sessions ({share:.0%}) came from slices with engagement at or "
        f"below {CRAWLER_ENGAGEMENT_CEILING:.0%} — the signature of the headless crawler documented in "
        f"docs/WORK_IN_PROGRESS.md § Analytics & traffic. Affected: {labels}. Treat session and user "
        f"totals in this report as an upper bound, and read the paid rows (sessionMedium = cpc) instead: "
        f"the crawler arrives as direct/organic and does not click ads."
    )
    return warnings


def fetch(property_id: str, days: int = 14, crawler_guard: bool = True,
          include_surface: bool = False) -> Ga4Report:
    """Pull the campaign and landing-page breakdowns for the window."""
    start, end = date_range(days)
    report = Ga4Report(property_id=property_id, start_date=start, end_date=end)

    if not property_id:
        report.notes.append(
            "settings.yaml -> ga4.property_id is not set, so no GA4 data was pulled. It is the "
            "NUMERIC property id (GA4 Admin -> Property settings), not the G- measurement id."
        )
        return report

    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import (
            DateRange,
            Dimension,
            Metric,
            RunReportRequest,
        )
    except ImportError as exc:
        report.notes.append(
            f"google-analytics-data is not installed ({exc}). Run: pip install -r requirements.txt. "
            "Ads reporting works without it."
        )
        return report

    client = BetaAnalyticsDataClient()
    metrics = [
        Metric(name="sessions"),
        Metric(name="engagedSessions"),
        Metric(name="activeUsers"),
        Metric(name="newUsers"),
        Metric(name="conversions"),
    ]

    campaign_dimensions = [
        Dimension(name="sessionCampaignName"),
        Dimension(name="sessionSource"),
        Dimension(name="sessionMedium"),
    ]
    if include_surface:
        # Only when registered. An unregistered custom dimension fails the WHOLE
        # request with 400, taking the campaign breakdown down with it.
        campaign_dimensions.append(Dimension(name="customEvent:surface"))

    report.by_campaign = _run(
        client,
        property_id,
        start,
        end,
        campaign_dimensions,
        metrics,
        report,
        label="campaign breakdown",
    )
    report.by_landing_page = _run(
        client,
        property_id,
        start,
        end,
        [Dimension(name="landingPage"), Dimension(name="sessionMedium")],
        metrics,
        report,
        label="landing page breakdown",
    )

    if crawler_guard:
        report.warnings.extend(detect_crawler_contamination(report.by_landing_page))

    if not include_surface:
        report.notes.append(
            "The `surface` breakdown was skipped. Set ga4.surface_dimension_registered: true in "
            "settings.yaml once it is registered as an event-scoped custom dimension in GA4 admin "
            "(there is an open item for this in docs/WORK_IN_PROGRESS.md)."
        )

    return report


def _run(client, property_id, start, end, dimensions, metrics, report, label):
    from google.analytics.data_v1beta.types import DateRange, RunReportRequest

    request = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(start_date=start, end_date=end)],
        dimensions=dimensions,
        metrics=metrics,
        limit=250,
    )
    try:
        response = client.run_report(request)
    except Exception as exc:  # noqa: BLE001
        report.notes.append(f"{label} failed: {exc}")
        return []

    rows = []
    dimension_names = [d.name for d in dimensions]
    for row in response.rows:
        values = [v.value for v in row.dimension_values]
        numbers = [v.value for v in row.metric_values]
        rows.append(
            Ga4Row(
                dimensions=dict(zip(dimension_names, values)),
                sessions=int(numbers[0] or 0),
                engaged_sessions=int(numbers[1] or 0),
                active_users=int(numbers[2] or 0),
                new_users=int(numbers[3] or 0),
                conversions=Decimal(numbers[4] or "0"),
            )
        )
    return rows
