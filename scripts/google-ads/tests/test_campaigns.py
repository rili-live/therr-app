"""Guard rails on the path that creates campaigns.

These cover the two failure modes that cost real money rather than confusion:
spending past the account-wide ceiling, and a plan that promises assets the
apply never sends.
"""

import unittest
from decimal import Decimal
from pathlib import Path

from therr_ads.campaigns import build_plan
from therr_ads.money import BudgetLimits
from therr_ads.settings import Settings
from therr_ads.spec import load_spec

REPO_SPECS = Path(__file__).resolve().parent.parent / "campaigns"
APP_SPEC = REPO_SPECS / "habits-app-install.yaml"


def settings_with(max_daily="50.00", max_total="100.00") -> Settings:
    return Settings(
        customer_id="1234567890",
        limits=BudgetLimits(
            max_daily_budget=Decimal(max_daily),
            max_total_daily_budget=Decimal(max_total),
        ),
    )


class AccountCeilingTest(unittest.TestCase):
    """`campaign apply` must weigh a new campaign against what already runs.

    The per-campaign ceiling alone does not bound account spend: N campaigns
    each under max_daily_budget still multiply the burn. build_plan takes
    other_campaigns_micros for exactly this, and the apply path supplies it.
    """

    def test_plan_is_allowed_when_the_account_has_room(self):
        spec = load_spec(APP_SPEC)
        plan = build_plan(spec, settings_with(), other_campaigns_micros=0)
        self.assertTrue(plan.can_apply)

    def test_plan_is_blocked_when_existing_campaigns_exhaust_the_total(self):
        # The spec's own daily budget is under the per-campaign ceiling, so a
        # per-campaign check alone would wave this through.
        spec = load_spec(APP_SPEC)
        solo = build_plan(spec, settings_with(), other_campaigns_micros=0)
        self.assertTrue(solo.can_apply)

        plan = build_plan(spec, settings_with(), other_campaigns_micros=99_000_000)
        self.assertFalse(plan.can_apply)
        self.assertTrue(
            any("Combined daily budget" in b for b in plan.blockers),
            f"expected an account-total blocker, got {plan.blockers}",
        )

    def test_blocked_plan_renders_the_refusal_rather_than_the_apply_hint(self):
        spec = load_spec(APP_SPEC)
        rendered = build_plan(spec, settings_with(), other_campaigns_micros=99_000_000).render()
        self.assertIn("BLOCKED (apply will refuse)", rendered)
        self.assertNotIn("campaign apply", rendered)


class MediaAssetHonestyTest(unittest.TestCase):
    """The plan must not count assets that apply drops.

    Only text assets are sent; images and videos need a separate binary upload
    this tool does not perform. An operator who filled the lists in would
    otherwise read the plan as confirmation the media shipped.
    """

    def test_plan_flags_media_as_not_uploaded(self):
        spec = load_spec(APP_SPEC)
        spec.assets.images = ["hero.png"]
        spec.assets.videos = ["promo.mp4"]
        rendered = build_plan(spec, settings_with()).render()
        self.assertIn("NOT uploaded", rendered)
        self.assertIn("Google Ads UI", rendered)

    def test_plan_stays_quiet_when_there_is_no_media(self):
        spec = load_spec(APP_SPEC)
        spec.assets.images = []
        spec.assets.videos = []
        self.assertNotIn("NOT uploaded", build_plan(spec, settings_with()).render())


class SpecMediaWarningTest(unittest.TestCase):
    def test_loading_a_spec_with_media_warns_that_it_is_not_uploaded(self):
        text = APP_SPEC.read_text().replace(
            "    images: []", '    images: ["hero.png"]'
        )
        import tempfile

        handle = tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False)
        handle.write(text)
        handle.close()
        spec = load_spec(Path(handle.name))
        self.assertTrue(
            any("NOT uploaded by this tool" in w for w in spec.warnings),
            f"expected a media-upload warning, got {spec.warnings}",
        )


class ApplySuppliesTheAccountTotalTest(unittest.TestCase):
    """The apply path must ASK what else is running before it plans.

    build_plan defaults other_campaigns_micros to 0, so a caller that omits it
    silently disables limits.max_total_daily_budget on the one operation that
    adds a campaign's burn to the account. `campaign budget` always supplied it;
    `campaign apply` did not, which is the regression this pins.
    """

    def _run_apply(self, monkey_budget_micros):
        from types import SimpleNamespace
        from unittest import mock

        from therr_ads import cli

        seen = {}

        def fake_build_plan(spec, settings, other_campaigns_micros=0):
            seen["other"] = other_campaigns_micros
            return build_plan(spec, settings, other_campaigns_micros=other_campaigns_micros)

        args = SimpleNamespace(
            spec=str(APP_SPEC), settings=None, config=None, confirm=False
        )
        with mock.patch.object(cli, "_client", return_value=object()), \
             mock.patch.object(cli, "_sum_other_budgets", return_value=monkey_budget_micros), \
             mock.patch.object(cli.campaigns, "build_plan", side_effect=fake_build_plan), \
             mock.patch.object(cli, "_settings", return_value=settings_with()):
            code = cli._cmd_campaign_apply(args)
        return seen, code

    def test_apply_passes_the_summed_other_budgets_into_the_plan(self):
        seen, _ = self._run_apply(42_000_000)
        self.assertEqual(
            seen.get("other"),
            42_000_000,
            "campaign apply built its plan without the account's existing spend",
        )

    def test_apply_refuses_when_existing_spend_exhausts_the_ceiling(self):
        _, code = self._run_apply(99_000_000)
        self.assertEqual(code, 2, "apply should refuse once the account total is blown")


class ResumeChecksTheAccountCeilingTest(unittest.TestCase):
    """Resuming adds a campaign's FULL daily budget to the account at once.

    _sum_other_budgets counts only ENABLED campaigns, so a paused campaign is
    invisible to the ceiling right up until it is resumed — which makes resume
    the one moment the check has to happen.
    """

    def _run_status(self, status, own_micros, other_micros):
        from types import SimpleNamespace
        from unittest import mock

        from therr_ads import cli

        campaign = {
            "id": 7,
            "name": "FwH-App-US-Installs-2026Q3",
            "status": "PAUSED",
            "start_date": "2026-08-01",
            "budget_resource": "customers/1/campaignBudgets/9",
            "budget_micros": own_micros,
            "sub_type": "APP_CAMPAIGN",
        }
        args = SimpleNamespace(
            name=campaign["name"], settings=None, config=None, confirm=False, status=status
        )
        set_status = mock.Mock()
        with mock.patch.object(cli, "_client", return_value=object()), \
             mock.patch.object(cli, "_settings", return_value=settings_with()), \
             mock.patch.object(cli, "_sum_other_budgets", return_value=other_micros), \
             mock.patch.object(cli.campaigns, "find_campaign", return_value=campaign), \
             mock.patch.object(cli.campaigns, "set_status", set_status):
            code = cli._cmd_campaign_status(args)
        return code, set_status

    def test_resume_is_refused_when_it_would_blow_the_account_total(self):
        code, set_status = self._run_status("ENABLED", 20_000_000, 95_000_000)
        self.assertEqual(code, 2)
        set_status.assert_not_called()

    def test_resume_is_allowed_when_the_account_has_room(self):
        code, _ = self._run_status("ENABLED", 20_000_000, 10_000_000)
        # 0 is the dry-run exit: the ceiling passed and it fell through to
        # the --confirm guard rather than being refused.
        self.assertEqual(code, 0)

    def test_pausing_is_never_blocked_by_a_budget_ceiling(self):
        # Pausing only ever reduces spend, so the ceiling must not gate it.
        code, _ = self._run_status("PAUSED", 20_000_000, 99_000_000)
        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main()
