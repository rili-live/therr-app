"""Hand-built report objects for the analysis tests.

Deliberately NOT mocks of the Google Ads client: the analysis layer is pure and
takes plain report objects, so the tests construct those directly. That keeps
the tests meaningful without the google-ads package installed, which is also
what lets them run in CI.
"""

from decimal import Decimal

from therr_ads.ga4 import Ga4Report, Ga4Row
from therr_ads.product import FunnelReport, FunnelRow
from therr_ads.reporting import AdGroupRow, AdsReport, CampaignRow, SearchTermRow

WINDOW = ("2026-08-01", "2026-08-14")


def ads_report(campaigns=None, ad_groups=None, search_terms=None) -> AdsReport:
    return AdsReport(
        start_date=WINDOW[0],
        end_date=WINDOW[1],
        campaigns=campaigns or [],
        ad_groups=ad_groups or [],
        search_terms=search_terms or [],
    )


def app_campaign(cost="200", installs=100, clicks=800, impressions=40000) -> CampaignRow:
    return CampaignRow(
        campaign_id=1,
        campaign_name="FwH-App-US-Installs-2026Q3",
        status="ENABLED",
        sub_type="APP_CAMPAIGN",
        impressions=impressions,
        clicks=clicks,
        cost=Decimal(cost),
        conversions=Decimal(installs),
        installs=Decimal(installs),
    )


def web_campaign(cost="140", conversions=20, clicks=200) -> CampaignRow:
    return CampaignRow(
        campaign_id=2,
        campaign_name="FwH-Web-US-Search-2026Q3",
        status="ENABLED",
        sub_type="SEARCH",
        impressions=4000,
        clicks=clicks,
        cost=Decimal(cost),
        conversions=Decimal(conversions),
    )


def ad_group(name, cost, conversions, clicks=100) -> AdGroupRow:
    return AdGroupRow(
        campaign_name="FwH-Web-US-Search-2026Q3",
        ad_group_id=abs(hash(name)) % 10000,
        ad_group_name=name,
        impressions=clicks * 20,
        clicks=clicks,
        cost=Decimal(str(cost)),
        conversions=Decimal(str(conversions)),
    )


def search_term(term, clicks, cost, conversions=0) -> SearchTermRow:
    return SearchTermRow(
        campaign_name="FwH-Web-US-Search-2026Q3",
        ad_group_name="accountability-partner",
        search_term=term,
        match_type="PHRASE",
        impressions=clicks * 12,
        clicks=clicks,
        cost=Decimal(str(cost)),
        conversions=Decimal(str(conversions)),
    )


def funnel_report(rows=None, notes=None) -> FunnelReport:
    return FunnelReport(
        start_date=WINDOW[0], end_date=WINDOW[1], rows=rows or [], notes=notes or []
    )


def funnel_row(
    campaign="fwh-web-us-search-2026q3",
    signups=100,
    activated=40,
    unlocked=12,
    checked_in=55,
    payers=3,
    revenue="60",
) -> FunnelRow:
    return FunnelRow(
        campaign=campaign,
        source="google",
        medium="cpc",
        signups=signups,
        activated=activated,
        unlocked=unlocked,
        checked_in=checked_in,
        checkins=checked_in * 4,
        payers=payers,
        revenue=Decimal(revenue),
    )


def ga4_report(warnings=None) -> Ga4Report:
    return Ga4Report(
        property_id="549794383",
        start_date=WINDOW[0],
        end_date=WINDOW[1],
        warnings=warnings or [],
    )
