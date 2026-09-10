"""The product-side funnel, read from the users-service Postgres replica.

WHY THIS EXISTS
Google Ads reports what it sold you (impressions, clicks, installs). GA4 reports
what happened on web pages. NEITHER can answer the question the business
actually has, which is whether the users bought with money go on to do the thing
the app is for, and then pay for it. That answer only exists in our own database.

THE JOIN
main."userAcquisition".utmCampaign is written at registration by the client-side
attribution utility in therr-react, from the UTM parameters on the landing URL.
That column IS the campaign spec's tracking.utm_campaign, verbatim. Everything
below groups on it.

  utmCampaign -> userId
    -> habits.pacts           (creatorUserId | partnerUserId)  did they activate?
    -> main.invites           (requestingUserId)               did they spread it?
    -> habits.habit_checkins  (userId)                         did they stay?
    -> habits.lifetime_purchases (userId)                      did they pay $20?

THE HOLE YOU MUST KNOW ABOUT
This only covers users who arrived through a WEB page carrying UTMs — the
web_landing arm. A user who installed straight from a Play Store ad has no
userAcquisition row with a campaign, so the app_install arm's users appear here
as "unattributed" and every rate computed for them is wrong, not merely missing.
Closing that needs the Play Install Referrer wired into the Android app; it is
the single highest-value measurement task outstanding and is tracked in
docs/WORK_IN_PROGRESS.md. Until then: the web arm is measured, the app arm is
estimated, and this module refuses to pretend otherwise — see `unattributed` in
the returned payload.

READ-ONLY. Uses the READ replica env vars, issues SELECTs only, and is not
wired to any write path. Do not add one.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from decimal import Decimal

from therr_ads.reporting import date_range
from therr_ads.settings import ProductDbSettings, SettingsError

# One query, one CTE per funnel stage, grouped by campaign. Written as a single
# statement rather than five round trips so every stage sees exactly the same
# cohort — running them separately lets a signup registered mid-query appear in
# one stage and not another.
FUNNEL_SQL = """
WITH cohort AS (
    SELECT ua."userId",
           COALESCE(NULLIF(ua."utmCampaign", ''), '(unattributed)') AS campaign,
           COALESCE(NULLIF(ua."utmSource",   ''), '(none)')         AS source,
           COALESCE(NULLIF(ua."utmMedium",   ''), '(none)')         AS medium,
           ua."createdAt"
    FROM main."userAcquisition" ua
    WHERE ua."createdAt" >= %(start)s::timestamptz
      AND ua."createdAt" <  (%(end)s::date + INTERVAL '1 day')
      AND (%(brand)s = '' OR ua."brandVariation" = %(brand)s)
),
pacted AS (
    SELECT DISTINCT c."userId"
    FROM cohort c
    JOIN habits.pacts p
      ON p."creatorUserId" = c."userId" OR p."partnerUserId" = c."userId"
),
invited AS (
    -- Distinct PEOPLE invited, not invitations: inviting one friend to three
    -- pacts unlocks nothing, and the solo-tracking threshold counts people.
    SELECT c."userId", COUNT(DISTINCT COALESCE(i.email, i."phoneNumber")) AS invitee_count
    FROM cohort c
    JOIN main.invites i ON i."requestingUserId" = c."userId"
    GROUP BY c."userId"
),
checked_in AS (
    SELECT c."userId", COUNT(*) AS checkin_count
    FROM cohort c
    JOIN habits.habit_checkins hc
      ON hc."userId" = c."userId" AND hc.status = 'completed'
    GROUP BY c."userId"
),
paid AS (
    SELECT c."userId", SUM(lp."priceAmountMicros") AS revenue_micros
    FROM cohort c
    JOIN habits.lifetime_purchases lp
      ON lp."userId" = c."userId" AND lp.status = 'active'
    GROUP BY c."userId"
)
SELECT c.campaign,
       c.source,
       c.medium,
       COUNT(*)                                             AS signups,
       COUNT(pacted."userId")                               AS activated,
       COUNT(*) FILTER (WHERE invited.invitee_count >= %(unlock_threshold)s) AS unlocked,
       COUNT(checked_in."userId")                           AS checked_in,
       COALESCE(SUM(checked_in.checkin_count), 0)           AS checkins,
       COUNT(paid."userId")                                 AS payers,
       COALESCE(SUM(paid.revenue_micros), 0)                AS revenue_micros
FROM cohort c
LEFT JOIN pacted     ON pacted."userId"     = c."userId"
LEFT JOIN invited    ON invited."userId"    = c."userId"
LEFT JOIN checked_in ON checked_in."userId" = c."userId"
LEFT JOIN paid       ON paid."userId"       = c."userId"
GROUP BY c.campaign, c.source, c.medium
ORDER BY signups DESC
"""

# HABITS_SOLO_UNLOCK_INVITE_COUNT default. Solo habit tracking unlocks at three
# distinct people invited; the same threshold defines "unlocked" here so this
# report and the app agree on what activation means.
DEFAULT_UNLOCK_THRESHOLD = 3


@dataclass
class FunnelRow:
    campaign: str
    source: str
    medium: str
    signups: int = 0
    activated: int = 0
    unlocked: int = 0
    checked_in: int = 0
    checkins: int = 0
    payers: int = 0
    revenue: Decimal = Decimal("0")

    @property
    def activation_rate(self) -> Decimal:
        return _rate(self.activated, self.signups)

    @property
    def unlock_rate(self) -> Decimal:
        return _rate(self.unlocked, self.signups)

    @property
    def retention_proxy(self) -> Decimal:
        """Share of signups with at least one completed check-in.

        A proxy, not retention: it says they used the app once, not that they
        came back. Real retention needs a cohort-by-day query, which is the
        obvious next iteration of this module.
        """
        return _rate(self.checked_in, self.signups)

    @property
    def payer_rate(self) -> Decimal:
        return _rate(self.payers, self.signups)

    @property
    def is_attributed(self) -> bool:
        return self.campaign != "(unattributed)"

    def to_dict(self) -> dict:
        data = {k: (float(v) if isinstance(v, Decimal) else v) for k, v in asdict(self).items()}
        data.update(
            activation_rate=float(self.activation_rate),
            unlock_rate=float(self.unlock_rate),
            retention_proxy=float(self.retention_proxy),
            payer_rate=float(self.payer_rate),
        )
        return data


@dataclass
class FunnelReport:
    start_date: str
    end_date: str
    rows: list[FunnelRow] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def attributed(self) -> list[FunnelRow]:
        return [r for r in self.rows if r.is_attributed]

    @property
    def unattributed(self) -> FunnelRow | None:
        for row in self.rows:
            if not row.is_attributed:
                return row
        return None

    def by_campaign(self, campaign: str) -> FunnelRow | None:
        for row in self.rows:
            if row.campaign == campaign:
                return row
        return None

    def to_dict(self) -> dict:
        return {
            "start_date": self.start_date,
            "end_date": self.end_date,
            "rows": [r.to_dict() for r in self.rows],
            "notes": self.notes,
        }


def _rate(numerator, denominator) -> Decimal:
    if not denominator:
        return Decimal("0")
    return (Decimal(numerator) / Decimal(denominator)).quantize(Decimal("0.0001"))


def fetch(
    db: ProductDbSettings,
    days: int = 14,
    unlock_threshold: int = DEFAULT_UNLOCK_THRESHOLD,
) -> FunnelReport:
    start, end = date_range(days)
    report = FunnelReport(start_date=start, end_date=end)

    if not db.enabled:
        report.notes.append(
            "product_db.enabled is false in settings.yaml, so the product funnel was not read. "
            "Ads and GA4 alone cannot tell you whether paid users activate or pay — enable it "
            "against the READ replica to get the half of the picture that matters."
        )
        return report

    try:
        import psycopg
    except ImportError:
        report.notes.append(
            "psycopg is not installed. Uncomment the psycopg line in requirements.txt and reinstall, "
            "or set product_db.enabled: false."
        )
        return report

    try:
        dsn = db.dsn()
    except SettingsError as exc:
        report.notes.append(str(exc))
        return report

    params = {
        "start": start,
        "end": end,
        "brand": db.brand_variation or "",
        "unlock_threshold": unlock_threshold,
    }

    with psycopg.connect(dsn, autocommit=True) as connection:
        # Belt and braces: the credentials should already be read-only, but a
        # read-only transaction makes an accidental write impossible rather than
        # merely unlikely.
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION READ ONLY")
            cursor.execute(FUNNEL_SQL, params)
            for record in cursor.fetchall():
                (campaign, source, medium, signups, activated, unlocked,
                 checked_in, checkins, payers, revenue_micros) = record
                report.rows.append(
                    FunnelRow(
                        campaign=campaign,
                        source=source,
                        medium=medium,
                        signups=int(signups or 0),
                        activated=int(activated or 0),
                        unlocked=int(unlocked or 0),
                        checked_in=int(checked_in or 0),
                        checkins=int(checkins or 0),
                        payers=int(payers or 0),
                        revenue=(Decimal(revenue_micros or 0) / Decimal(1_000_000)).quantize(Decimal("0.01")),
                    )
                )

    unattributed = report.unattributed
    if unattributed and unattributed.signups:
        attributed_total = sum(r.signups for r in report.attributed)
        report.notes.append(
            f"{unattributed.signups} of {unattributed.signups + attributed_total} signups in this window "
            "carry no utmCampaign. Expected sources: organic, in-app invite links, and — critically — "
            "every install driven by the app_install arm, because a Play Store install never touches a "
            "web page that could set a UTM. Do not read this bucket as 'organic growth' while an App "
            "campaign is running."
        )

    return report
