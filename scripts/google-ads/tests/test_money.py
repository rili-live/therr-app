import unittest
from decimal import Decimal

from therr_ads.money import (
    BudgetError,
    BudgetLimits,
    check_budget,
    format_micros,
    from_micros,
    to_micros,
)


class ToMicrosTest(unittest.TestCase):
    def test_converts_dollars_to_micros(self):
        self.assertEqual(to_micros("20.00"), 20_000_000)
        self.assertEqual(to_micros(2.5), 2_500_000)
        self.assertEqual(to_micros(Decimal("0.01")), 10_000)

    def test_float_representation_error_does_not_lose_a_cent(self):
        # 20.10 is not representable in binary floating point; a naive
        # int(20.10 * 1e6) yields 20_099_999.
        self.assertEqual(to_micros(20.10), 20_100_000)

    def test_rounds_to_the_cent_quantum_google_enforces(self):
        self.assertEqual(to_micros("1.239"), 1_230_000)

    def test_rejects_negative_and_nonnumeric(self):
        with self.assertRaises(BudgetError):
            to_micros("-5")
        with self.assertRaises(BudgetError):
            to_micros("twenty dollars")

    def test_round_trips(self):
        self.assertEqual(from_micros(to_micros("37.42")), Decimal("37.42"))
        self.assertEqual(format_micros(20_000_000), "20.00 USD")


class CheckBudgetTest(unittest.TestCase):
    def setUp(self):
        self.limits = BudgetLimits(
            max_daily_budget=Decimal("50.00"),
            max_total_daily_budget=Decimal("100.00"),
            budget_change_warn_ratio=Decimal("0.20"),
            learning_period_days=7,
        )

    def test_allows_a_budget_inside_every_limit(self):
        decision = check_budget("20", self.limits)
        self.assertTrue(decision.allowed)
        self.assertEqual(decision.warnings, [])

    def test_blocks_over_the_per_campaign_ceiling(self):
        decision = check_budget("75", self.limits)
        self.assertFalse(decision.allowed)
        self.assertIn("max_daily_budget", decision.blocked[0])

    def test_blocks_when_the_account_total_would_exceed_the_ceiling(self):
        # Under the per-campaign ceiling, but two other campaigns already run
        # at 45 and 40, so this is the case a per-campaign check misses.
        decision = check_budget("30", self.limits, other_campaigns_micros=85_000_000)
        self.assertFalse(decision.allowed)
        self.assertIn("Combined daily budget", decision.blocked[0])

    def test_warns_but_allows_a_learning_resetting_increase(self):
        decision = check_budget("30", self.limits, current_micros=20_000_000)
        self.assertTrue(decision.allowed)
        self.assertTrue(decision.needs_force)
        self.assertIn("learning phase", decision.warnings[0])
        self.assertEqual(decision.change_ratio, Decimal("0.500"))

    def test_does_not_warn_on_a_step_inside_the_ratio(self):
        decision = check_budget("23", self.limits, current_micros=20_000_000)
        self.assertFalse(decision.needs_force)

    def test_warns_inside_the_learning_period(self):
        decision = check_budget("22", self.limits, current_micros=20_000_000, days_since_start=2)
        self.assertTrue(any("learning period" in w for w in decision.warnings))

    def test_no_learning_warning_after_the_period(self):
        decision = check_budget("22", self.limits, current_micros=20_000_000, days_since_start=30)
        self.assertFalse(any("learning period" in w for w in decision.warnings))

    def test_warns_when_budget_is_under_fifty_times_target_cpa(self):
        decision = check_budget("20", self.limits, target_cpa="2.50")
        self.assertTrue(any("50x the target CPA" in w for w in decision.warnings))

    def test_zero_is_blocked(self):
        self.assertFalse(check_budget("0", self.limits).allowed)


if __name__ == "__main__":
    unittest.main()
