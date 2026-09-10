"""Pull performance rows out of the Google Ads API via GAQL.

GAQL GOTCHAS THAT COST TIME
  - `segments.date` in the WHERE clause takes 'YYYY-MM-DD' quoted strings, but
    `campaign.start_date` comes back unquoted as YYYY-MM-DD. Different formats,
    same-looking field.
  - metrics.cost_micros is micros; every other cost-shaped field is too. Never
    divide by 1e6 in a query, do it once at the boundary here.
  - A campaign with zero impressions in the window returns NO ROW, not a row of
    zeros. Absence is the normal case for a paused or starved campaign, so
    every consumer must handle an empty result as "no data", never as "zero
    performance" — those lead to opposite conclusions.
  - LIMIT applies after aggregation. There is no OFFSET; page with the iterator.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from therr_ads.money import from_micros


def date_range(days: int) -> tuple[str, str]:
    """Inclusive window ending YESTERDAY.

    Today is deliberately excluded: Google Ads conversion data for the current
    day is materially incomplete (conversions are attributed back to the click
    date and can arrive days later), and including it makes every trend line
    end in a fake drop.
    """
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=max(1, days) - 1)
    return start.isoformat(), end.isoformat()


@dataclass
class CampaignRow:
    campaign_id: int
    campaign_name: str
    status: str
    sub_type: str
    impressions: int = 0
    clicks: int = 0
    cost: Decimal = Decimal("0")
    conversions: Decimal = Decimal("0")
    conversion_value: Decimal = Decimal("0")
    # App campaigns report installs as a conversion action of type
    # DOWNLOAD/FIRST_OPEN; kept separate because "conversions" on the web arm
    # means signups and adding the two would be meaningless.
    installs: Decimal = Decimal("0")

    @property
    def ctr(self) -> Decimal:
        return _rate(self.clicks, self.impressions)

    @property
    def cpc(self) -> Decimal:
        return _per(self.cost, self.clicks)

    @property
    def cost_per_conversion(self) -> Decimal:
        return _per(self.cost, self.conversions)

    @property
    def conversion_rate(self) -> Decimal:
        return _rate(self.conversions, self.clicks)

    def to_dict(self) -> dict:
        data = {k: _plain(v) for k, v in asdict(self).items()}
        data.update(
            ctr=_plain(self.ctr),
            cpc=_plain(self.cpc),
            cost_per_conversion=_plain(self.cost_per_conversion),
            conversion_rate=_plain(self.conversion_rate),
        )
        return data


@dataclass
class AdGroupRow:
    campaign_name: str
    ad_group_id: int
    ad_group_name: str
    impressions: int = 0
    clicks: int = 0
    cost: Decimal = Decimal("0")
    conversions: Decimal = Decimal("0")

    @property
    def cost_per_conversion(self) -> Decimal:
        return _per(self.cost, self.conversions)

    def to_dict(self) -> dict:
        data = {k: _plain(v) for k, v in asdict(self).items()}
        data["cost_per_conversion"] = _plain(self.cost_per_conversion)
        return data


@dataclass
class SearchTermRow:
    """What people actually typed, as opposed to what we bid on.

    The highest-value report in the account on a small budget: it is where you
    find the intent you did not think to target, and the intent quietly eating
    the budget. Only populated for the web_landing arm — App campaigns do not
    expose search terms.
    """

    campaign_name: str
    ad_group_name: str
    search_term: str
    match_type: str = ""
    impressions: int = 0
    clicks: int = 0
    cost: Decimal = Decimal("0")
    conversions: Decimal = Decimal("0")

    def to_dict(self) -> dict:
        return {k: _plain(v) for k, v in asdict(self).items()}


@dataclass
class AdsReport:
    start_date: str
    end_date: str
    campaigns: list[CampaignRow] = field(default_factory=list)
    ad_groups: list[AdGroupRow] = field(default_factory=list)
    search_terms: list[SearchTermRow] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def total_cost(self) -> Decimal:
        return sum((c.cost for c in self.campaigns), Decimal("0"))

    @property
    def total_clicks(self) -> int:
        return sum(c.clicks for c in self.campaigns)

    @property
    def total_conversions(self) -> Decimal:
        return sum((c.conversions for c in self.campaigns), Decimal("0"))

    @property
    def total_installs(self) -> Decimal:
        return sum((c.installs for c in self.campaigns), Decimal("0"))

    def to_dict(self) -> dict:
        return {
            "start_date": self.start_date,
            "end_date": self.end_date,
            "campaigns": [c.to_dict() for c in self.campaigns],
            "ad_groups": [g.to_dict() for g in self.ad_groups],
            "search_terms": [t.to_dict() for t in self.search_terms],
            "notes": self.notes,
            "totals": {
                "cost": _plain(self.total_cost),
                "clicks": self.total_clicks,
                "conversions": _plain(self.total_conversions),
                "installs": _plain(self.total_installs),
            },
        }


def _rate(numerator, denominator) -> Decimal:
    if not denominator:
        return Decimal("0")
    return (Decimal(numerator) / Decimal(denominator)).quantize(Decimal("0.0001"))


def _per(total: Decimal, count) -> Decimal:
    if not count:
        return Decimal("0")
    return (Decimal(total) / Decimal(count)).quantize(Decimal("0.01"))


def _plain(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


CAMPAIGN_QUERY = """
    SELECT campaign.id, campaign.name, campaign.status,
           campaign.advertising_channel_sub_type,
           metrics.impressions, metrics.clicks, metrics.cost_micros,
           metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '{start}' AND '{end}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
"""

AD_GROUP_QUERY = """
    SELECT campaign.name, ad_group.id, ad_group.name,
           metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM ad_group
    WHERE segments.date BETWEEN '{start}' AND '{end}'
      AND ad_group.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
"""

SEARCH_TERM_QUERY = """
    SELECT campaign.name, ad_group.name,
           search_term_view.search_term, segments.search_term_match_type,
           metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '{start}' AND '{end}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 200
"""

# Installs are a conversion action, not a metric. Segmenting by conversion
# action category is the only way to split "install" from "in-app signup" once
# both exist; DOWNLOAD is the category Play install actions carry.
INSTALL_QUERY = """
    SELECT campaign.id, campaign.name,
           segments.conversion_action_category, metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '{start}' AND '{end}'
      AND campaign.status != 'REMOVED'
      AND segments.conversion_action_category = 'DOWNLOAD'
"""


def fetch(client, customer_id: str, days: int = 14, include_search_terms: bool = True) -> AdsReport:
    """Run the report set for a window and return normalized rows."""
    start, end = date_range(days)
    report = AdsReport(start_date=start, end_date=end)
    service = client.get_service("GoogleAdsService")

    by_id: dict[int, CampaignRow] = {}
    for row in _search(client, service, customer_id, CAMPAIGN_QUERY.format(start=start, end=end)):
        campaign = by_id.setdefault(
            row.campaign.id,
            CampaignRow(
                campaign_id=row.campaign.id,
                campaign_name=row.campaign.name,
                status=row.campaign.status.name,
                sub_type=row.campaign.advertising_channel_sub_type.name,
            ),
        )
        campaign.impressions += row.metrics.impressions
        campaign.clicks += row.metrics.clicks
        campaign.cost += from_micros(row.metrics.cost_micros)
        campaign.conversions += Decimal(str(row.metrics.conversions))
        campaign.conversion_value += Decimal(str(row.metrics.conversions_value))

    for row in _search(client, service, customer_id, INSTALL_QUERY.format(start=start, end=end)):
        campaign = by_id.get(row.campaign.id)
        if campaign is not None:
            campaign.installs += Decimal(str(row.metrics.conversions))

    report.campaigns = list(by_id.values())

    for row in _search(client, service, customer_id, AD_GROUP_QUERY.format(start=start, end=end)):
        report.ad_groups.append(
            AdGroupRow(
                campaign_name=row.campaign.name,
                ad_group_id=row.ad_group.id,
                ad_group_name=row.ad_group.name,
                impressions=row.metrics.impressions,
                clicks=row.metrics.clicks,
                cost=from_micros(row.metrics.cost_micros),
                conversions=Decimal(str(row.metrics.conversions)),
            )
        )

    if include_search_terms:
        try:
            for row in _search(client, service, customer_id, SEARCH_TERM_QUERY.format(start=start, end=end)):
                report.search_terms.append(
                    SearchTermRow(
                        campaign_name=row.campaign.name,
                        ad_group_name=row.ad_group.name,
                        search_term=row.search_term_view.search_term,
                        match_type=row.segments.search_term_match_type.name,
                        impressions=row.metrics.impressions,
                        clicks=row.metrics.clicks,
                        cost=from_micros(row.metrics.cost_micros),
                        conversions=Decimal(str(row.metrics.conversions)),
                    )
                )
        except Exception as exc:  # noqa: BLE001
            # An account with only App campaigns has no search_term_view data
            # and some API versions error rather than returning empty. Never let
            # this take down the rest of the report.
            report.notes.append(f"search terms unavailable: {exc}")

    if not report.campaigns:
        report.notes.append(
            f"No campaign delivered impressions between {start} and {end}. That is the expected "
            "result for a campaign still PAUSED — it is not a performance reading."
        )

    return report


def _search(client, service, customer_id: str, query: str):
    request = client.get_type("SearchGoogleAdsRequest")
    request.customer_id = customer_id
    request.query = query
    return service.search(request=request)
