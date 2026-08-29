import unittest
from decimal import Decimal

from tests import fixtures
from therr_ads.analysis import FOUNDER_UNLOCK_NET, analyze
from therr_ads.settings import Targets


def verdict(diagnosis, area):
    for item in diagnosis.verdicts:
        if item.area == area:
            return item
    return None


def has_action(diagnosis, fragment):
    return any(fragment.lower() in a.title.lower() for a in diagnosis.actions)


class NoDeliveryTest(unittest.TestCase):
    def test_reports_insufficient_data_and_tells_you_to_start(self):
        diagnosis = analyze(fixtures.ads_report(), None, None, Targets())
        self.assertEqual(verdict(diagnosis, "CHANNEL").call, "INSUFFICIENT_DATA")
        self.assertTrue(has_action(diagnosis, "Enable the first"))

    def test_never_claims_zero_performance_when_there_is_no_data(self):
        diagnosis = analyze(fixtures.ads_report(), None, None, Targets())
        text = " ".join(s.statement for s in diagnosis.signals)
        self.assertIn("No campaign served", text)


class ChannelCostTest(unittest.TestCase):
    def test_cheap_installs_produce_a_scale_recommendation(self):
        report = fixtures.ads_report([fixtures.app_campaign(cost="200", installs=100)])  # $2 CPI
        diagnosis = analyze(report, None, None, Targets())
        self.assertTrue(has_action(diagnosis, "budget up by 20%"))
        self.assertTrue(any(s.severity == "good" for s in diagnosis.signals))

    def test_expensive_installs_produce_a_stop_or_fix_decision(self):
        report = fixtures.ads_report([fixtures.app_campaign(cost="800", installs=100)])  # $8 CPI
        diagnosis = analyze(report, None, None, Targets())
        self.assertTrue(has_action(diagnosis, "Decide: fix creative"))
        self.assertTrue(any(s.severity == "critical" for s in diagnosis.signals))

    def test_small_sample_is_refused_rather_than_judged(self):
        # $10 CPI, but only 5 installs — the rate is meaningless.
        report = fixtures.ads_report([fixtures.app_campaign(cost="50", installs=5)])
        diagnosis = analyze(report, None, None, Targets())
        self.assertFalse(has_action(diagnosis, "Decide: fix creative"))
        self.assertTrue(any("below the" in s.statement for s in diagnosis.signals))


class MarketTargetingTest(unittest.TestCase):
    def test_identifies_the_winning_keyword_theme(self):
        report = fixtures.ads_report(
            [fixtures.web_campaign()],
            ad_groups=[
                fixtures.ad_group("accountability-partner", cost=60, conversions=12),
                fixtures.ad_group("habit-tracker-generic", cost=80, conversions=0),
            ],
        )
        diagnosis = analyze(report, None, None, Targets())
        self.assertTrue(
            any("accountability-partner" in s.statement for s in diagnosis.signals)
        )
        self.assertTrue(has_action(diagnosis, "Pause the 'habit-tracker-generic'"))

    def test_uniform_failure_points_at_the_landing_page_not_the_keywords(self):
        report = fixtures.ads_report(
            [fixtures.web_campaign(conversions=0)],
            ad_groups=[
                fixtures.ad_group("accountability-partner", cost=60, conversions=0),
                fixtures.ad_group("habit-tracker-generic", cost=80, conversions=0),
                fixtures.ad_group("cant-stick-to-habits", cost=30, conversions=0),
            ],
        )
        diagnosis = analyze(report, None, None, Targets())
        self.assertTrue(has_action(diagnosis, "Audit the landing page"))


class SearchTermTest(unittest.TestCase):
    def test_flags_waste_and_proposes_negatives(self):
        report = fixtures.ads_report(
            [fixtures.web_campaign(cost="100")],
            search_terms=[
                fixtures.search_term("free habit tracker template", clicks=20, cost=40),
                fixtures.search_term("atomic habits book pdf", clicks=15, cost=30),
            ],
        )
        diagnosis = analyze(report, None, None, Targets())
        self.assertTrue(has_action(diagnosis, "negative keywords"))

    def test_promotes_converting_terms(self):
        report = fixtures.ads_report(
            [fixtures.web_campaign()],
            search_terms=[fixtures.search_term("accountability buddy app", 9, 18, conversions=3)],
        )
        diagnosis = analyze(report, None, None, Targets())
        self.assertTrue(has_action(diagnosis, "exact-match keywords"))


class DataIntegrityTest(unittest.TestCase):
    def test_crawler_warning_becomes_a_blocking_priority_one_item(self):
        diagnosis = analyze(
            fixtures.ads_report([fixtures.web_campaign()]),
            fixtures.ga4_report(warnings=["87% of sessions look automated"]),
            None,
            Targets(),
        )
        self.assertTrue(has_action(diagnosis, "Block the headless crawler"))

    def test_unattributed_signups_raise_the_install_referrer_gap(self):
        funnel = fixtures.funnel_report(
            [
                fixtures.funnel_row(campaign="(unattributed)", signups=180, activated=50, payers=1),
                fixtures.funnel_row(signups=40),
            ]
        )
        diagnosis = analyze(
            fixtures.ads_report([fixtures.app_campaign()]), None, funnel, Targets()
        )
        self.assertTrue(has_action(diagnosis, "Play Install Referrer"))
        signal = next(s for s in diagnosis.signals if "utmCampaign" in s.statement)
        self.assertEqual(signal.severity, "critical")


class ProductFunnelTest(unittest.TestCase):
    def test_low_activation_is_read_as_the_partner_wall(self):
        funnel = fixtures.funnel_report([fixtures.funnel_row(signups=100, activated=8)])
        diagnosis = analyze(
            fixtures.ads_report([fixtures.web_campaign()]), None, funnel, Targets()
        )
        product = verdict(diagnosis, "PRODUCT")
        self.assertEqual(product.call, "AT_RISK")
        self.assertIn("partner", product.reasoning)
        self.assertTrue(has_action(diagnosis, "before a partner accepts"))

    def test_healthy_activation_is_viable(self):
        funnel = fixtures.funnel_report([fixtures.funnel_row(signups=100, activated=55)])
        diagnosis = analyze(
            fixtures.ads_report([fixtures.web_campaign()]), None, funnel, Targets()
        )
        self.assertEqual(verdict(diagnosis, "PRODUCT").call, "VIABLE")

    def test_low_invite_rate_asks_for_the_viral_coefficient(self):
        funnel = fixtures.funnel_report(
            [fixtures.funnel_row(signups=100, activated=55, unlocked=2)]
        )
        diagnosis = analyze(
            fixtures.ads_report([fixtures.web_campaign()]), None, funnel, Targets()
        )
        self.assertTrue(has_action(diagnosis, "viral coefficient"))

    def test_small_cohort_is_refused(self):
        funnel = fixtures.funnel_report([fixtures.funnel_row(signups=5, activated=0)])
        diagnosis = analyze(
            fixtures.ads_report([fixtures.web_campaign()]), None, funnel, Targets()
        )
        self.assertEqual(verdict(diagnosis, "PRODUCT").call, "INSUFFICIENT_DATA")


class UnitEconomicsTest(unittest.TestCase):
    """The business-model question: does a payer cost less than a payer is worth?"""

    def test_cost_per_payer_under_net_unlock_value_is_viable(self):
        # $140 spend, 10 payers = $14/payer against $17 net.
        ads = fixtures.ads_report([fixtures.web_campaign(cost="140")])
        funnel = fixtures.funnel_report(
            [fixtures.funnel_row(signups=100, activated=55, payers=10, revenue="200")]
        )
        diagnosis = analyze(ads, None, funnel, Targets())
        model = verdict(diagnosis, "MODEL")
        self.assertEqual(model.call, "VIABLE")
        self.assertTrue(has_action(diagnosis, "Scale budget"))

    def test_cost_per_payer_over_net_unlock_value_is_unviable(self):
        # $400 spend, 4 payers = $100/payer against $17 net.
        ads = fixtures.ads_report([fixtures.web_campaign(cost="400")])
        funnel = fixtures.funnel_report(
            [fixtures.funnel_row(signups=100, activated=55, payers=4, revenue="80")]
        )
        diagnosis = analyze(ads, None, funnel, Targets())
        model = verdict(diagnosis, "MODEL")
        self.assertEqual(model.call, "UNVIABLE")
        self.assertIn("one-time", model.reasoning)
        self.assertTrue(has_action(diagnosis, "recurring premium tier"))

    def test_zero_payers_after_meaningful_spend_is_unviable(self):
        ads = fixtures.ads_report([fixtures.web_campaign(cost="300")])
        funnel = fixtures.funnel_report(
            [fixtures.funnel_row(signups=100, activated=55, payers=0, revenue="0")]
        )
        diagnosis = analyze(ads, None, funnel, Targets())
        self.assertEqual(verdict(diagnosis, "MODEL").call, "UNVIABLE")
        self.assertTrue(has_action(diagnosis, "growth channel or a research budget"))

    def test_zero_payers_on_trivial_spend_is_not_a_verdict(self):
        ads = fixtures.ads_report([fixtures.web_campaign(cost="20")])
        funnel = fixtures.funnel_report(
            [fixtures.funnel_row(signups=100, activated=55, payers=0, revenue="0")]
        )
        diagnosis = analyze(ads, None, funnel, Targets())
        self.assertEqual(verdict(diagnosis, "MODEL").call, "INSUFFICIENT_DATA")

    def test_net_value_accounts_for_the_play_store_fee(self):
        self.assertEqual(FOUNDER_UNLOCK_NET, Decimal("17.00"))

    def test_unattributed_rows_are_excluded_from_economics(self):
        # The unattributed bucket has all the payers, but none of them can be
        # credited to spend — counting them would fake a viable channel.
        ads = fixtures.ads_report([fixtures.web_campaign(cost="400")])
        funnel = fixtures.funnel_report(
            [
                fixtures.funnel_row(campaign="(unattributed)", signups=500, activated=300, payers=40),
                fixtures.funnel_row(signups=100, activated=55, payers=1, revenue="20"),
            ]
        )
        diagnosis = analyze(ads, None, funnel, Targets())
        self.assertEqual(verdict(diagnosis, "MODEL").call, "UNVIABLE")


if __name__ == "__main__":
    unittest.main()
