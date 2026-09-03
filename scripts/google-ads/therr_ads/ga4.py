"""GA4 Data API — both halves of the funnel, which live in two properties.

THE TOPOLOGY, because getting this wrong cost this tool its most useful data
source for months:

  properties/549794383  "Consolidated Domains"  — every web surface that loads
        gtag: habits.therr.com, therr.com, dashboard.therr.com, therr.app.
        Sessions, landing pages, session source/medium, so a `google / cpc`
        session traces to a campaign.

  properties/267810693  "therr-app" (Default Account for Firebase) — the mobile
        streams. It carries an Android data stream named **Friends with Habits**
        emitting first_open, profile_create_start, phone_verify_success and
        connection_invites_sent, all already marked as key events, and it is
        already linked to the Google Ads accounts. This module used to assert
        that no such stream existed and that installs were invisible to GA4.
        That was wrong: the stream was simply in the OTHER property.

GA4 cannot join across properties, so these are two reports rather than two
dimensions of one report, and `Ga4Report` (web) and `AppFunnelReport` (app) are
deliberately separate types.

WHAT IS STILL INVISIBLE
The app stream stops at phone verification. There is no pact-create, no
check-in and no Founder Unlock purchase event in TherrMobile, so the MODEL
question has no GA4 answer at all and the PRODUCT question is answerable only
as far as "did they invite anyone". `analysis._rule_app_activation` says so and
files the instrumentation as work rather than inferring past the gap.

THE ONE REMAINING PROPERTY HAZARD
A headless-Chrome crawler produced ~86% of sessions in the consolidated
property over the 30 days to 2 Sep 2026 — Singapore desktop, 1.1% engagement,
walking /spaces/*. GA4's IAB bot filter does not catch it and a GA4 data filter
CANNOT exclude it (data filters only support Developer and Internal traffic).
It does not touch habits.therr.com, so `ga4.web_hostname` is the effective
exclusion for this campaign; `crawler_guard` stays on as the backstop and flags
rather than filters, because silently dropping rows would make this tool
disagree with the GA4 UI for no visible reason. Tracked in
docs/WORK_IN_PROGRESS.md § Analytics & traffic.
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


# ---------------------------------------------------------------------------
# The app half — properties/267810693, stream "Friends with Habits"
# ---------------------------------------------------------------------------

# Ordered, and the order is the funnel. Each entry is (event name, label, and
# whether the event exists in the shipped app today). The `shipped=False` steps
# are the Phase 1 instrumentation: listing them here rather than adding them
# later is deliberate, because a funnel that silently omits its own missing
# stages reads as a complete picture. `analysis._rule_app_activation` turns an
# absent step into a work item instead of an inference.
APP_FUNNEL_STEPS: tuple[tuple[str, str, bool], ...] = (
    ("first_open", "installed and opened", True),
    ("profile_create_start", "started a profile", True),
    ("phone_verify_success", "verified a phone", True),
    ("connection_invites_sent", "sent an invite", True),
    ("habit_pact_create", "created a pact", False),
    ("habit_checkin_complete", "completed a check-in", False),
    ("habits_founder_unlock_purchase", "bought the Founder Unlock", False),
)

# The step the PRODUCT question is really about — "did a cold user do the thing
# the app is for". Pact creation is the real answer; until it is instrumented,
# sending an invite is the closest available proxy, and it is a weaker claim.
ACTIVATION_EVENT = "habit_pact_create"
ACTIVATION_PROXY_EVENT = "connection_invites_sent"


@dataclass
class AppFunnelStep:
    event_name: str
    label: str
    shipped: bool = True
    users: int = 0
    events: int = 0

    @property
    def instrumented(self) -> bool:
        """True once the event has actually been seen, not merely declared."""
        return self.events > 0 or self.users > 0

    def to_dict(self) -> dict:
        return {
            "event_name": self.event_name,
            "label": self.label,
            "shipped": self.shipped,
            "instrumented": self.instrumented,
            "users": self.users,
            "events": self.events,
        }


@dataclass
class AppFunnelReport:
    property_id: str
    stream_name: str
    start_date: str
    end_date: str
    steps: list[AppFunnelStep] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def installs(self) -> int:
        first = self.step("first_open")
        return first.users if first else 0

    def step(self, event_name: str) -> AppFunnelStep | None:
        for item in self.steps:
            if item.event_name == event_name:
                return item
        return None

    def users_at(self, event_name: str) -> int:
        found = self.step(event_name)
        return found.users if found else 0

    def missing_events(self) -> list[str]:
        """Declared steps that have never fired. The instrumentation backlog."""
        return [s.event_name for s in self.steps if not s.instrumented]

    def to_dict(self) -> dict:
        return {
            "property_id": self.property_id,
            "stream_name": self.stream_name,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "installs": self.installs,
            "steps": [s.to_dict() for s in self.steps],
            "notes": self.notes,
        }


def build_app_funnel(counts: dict, property_id: str = "", stream_name: str = "",
                     start_date: str = "", end_date: str = "") -> AppFunnelReport:
    """Assemble the funnel from an {event_name: (users, events)} mapping. Pure.

    Split out from the fetch so the ordering and the missing-event logic are
    unit testable without a GA4 client, per the module-purity split the rest of
    this package uses.
    """
    steps = []
    for event_name, label, shipped in APP_FUNNEL_STEPS:
        users, events = counts.get(event_name, (0, 0))
        steps.append(
            AppFunnelStep(
                event_name=event_name, label=label, shipped=shipped,
                users=int(users or 0), events=int(events or 0),
            )
        )
    return AppFunnelReport(
        property_id=property_id, stream_name=stream_name,
        start_date=start_date, end_date=end_date, steps=steps,
    )


def fetch_app_funnel(app_property_id: str, days: int = 14,
                     stream_name: str = "Friends with Habits") -> AppFunnelReport:
    """Pull the in-app funnel for one data stream.

    Both Therr Android apps report into this property, so the stream filter is
    not optional — without it the habits funnel quietly absorbs the flagship
    app's installs and every rate below it is wrong in the flattering direction.
    """
    start, end = date_range(days)
    report = AppFunnelReport(
        property_id=app_property_id, stream_name=stream_name,
        start_date=start, end_date=end, steps=[],
    )

    if not app_property_id:
        report.notes.append(
            "settings.yaml -> ga4.app_property_id is not set, so the in-app funnel was not pulled. "
            "It is 267810693 for Friends with Habits — the Firebase-created property, NOT the "
            "consolidated web property in ga4.property_id."
        )
        return build_app_funnel({}, app_property_id, stream_name, start, end)

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
            f"google-analytics-data is not installed ({exc}). Run: pip install -r requirements.txt."
        )
        return build_app_funnel({}, app_property_id, stream_name, start, end)

    request = RunReportRequest(
        property=f"properties/{app_property_id}",
        date_ranges=[DateRange(start_date=start, end_date=end)],
        dimensions=[Dimension(name="eventName")],
        metrics=[Metric(name="activeUsers"), Metric(name="eventCount")],
        dimension_filter=_exact_filter("streamName", stream_name),
        limit=250,
    )
    try:
        response = BetaAnalyticsDataClient().run_report(request)
    except Exception as exc:  # noqa: BLE001
        built = build_app_funnel({}, app_property_id, stream_name, start, end)
        built.notes.append(f"in-app funnel failed: {exc}")
        return built

    counts = {
        row.dimension_values[0].value: (
            int(row.metric_values[0].value or 0),
            int(row.metric_values[1].value or 0),
        )
        for row in response.rows
    }
    built = build_app_funnel(counts, app_property_id, stream_name, start, end)
    missing = built.missing_events()
    if missing:
        built.notes.append(
            "No events recorded for: " + ", ".join(missing) + ". These are the steps the app does "
            "not yet emit, so the funnel is truncated rather than zero at those stages."
        )
    return built


def _exact_filter(field_name: str, value: str):
    """An exact-match dimension filter. Imported lazily like the rest of the API."""
    from google.analytics.data_v1beta.types import Filter, FilterExpression

    return FilterExpression(
        filter=Filter(field_name=field_name, string_filter=Filter.StringFilter(value=value))
    )


def fetch(property_id: str, days: int = 14, crawler_guard: bool = True,
          include_surface: bool = False, host_name: str = "") -> Ga4Report:
    """Pull the campaign and landing-page breakdowns for the window.

    `host_name` restricts the report to one hostname. Pass the campaign's own
    landing host: the consolidated property serves four sites and only one of
    them is being advertised, so an unfiltered read mixes the campaign's traffic
    with therr.com's — including the crawler, which is 86% of therr.com and 0%
    of habits.therr.com.
    """
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
        host_name=host_name,
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
        host_name=host_name,
    )

    if crawler_guard:
        report.warnings.extend(detect_crawler_contamination(report.by_landing_page))

    if host_name:
        report.notes.append(f"Restricted to hostName = {host_name}.")
    else:
        report.notes.append(
            "No hostname filter was applied, so this report mixes every site in the property. Set "
            "ga4.web_hostname: habits.therr.com in settings.yaml — the crawler lives entirely on "
            "www.therr.com, so this one setting is what makes the web arm's numbers readable."
        )

    if not include_surface:
        report.notes.append(
            "The `surface` breakdown was skipped because ga4.surface_dimension_registered is false. "
            "The dimension IS registered on property 549794383 and returns data, so unless you are "
            "pointing at a different property this should be set to true."
        )

    return report


def _run(client, property_id, start, end, dimensions, metrics, report, label, host_name=""):
    from google.analytics.data_v1beta.types import DateRange, RunReportRequest

    request = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(start_date=start, end_date=end)],
        dimensions=dimensions,
        metrics=metrics,
        limit=250,
    )
    if host_name:
        request.dimension_filter = _exact_filter("hostName", host_name)
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
