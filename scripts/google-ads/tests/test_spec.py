import tempfile
import unittest
from pathlib import Path

from therr_ads.spec import SpecError, load_spec

REPO_SPECS = Path(__file__).resolve().parent.parent / "campaigns"


def write_spec(body: str) -> Path:
    handle = tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False)
    handle.write(body)
    handle.close()
    return Path(handle.name)


class ShippedSpecsTest(unittest.TestCase):
    """The specs committed to campaigns/ must always validate.

    This is the regression that matters: an invalid spec is only discovered
    when someone tries to spend money with it.
    """

    def test_every_shipped_spec_is_valid(self):
        specs = sorted(REPO_SPECS.glob("*.yaml"))
        self.assertTrue(specs, "no campaign specs found")
        for path in specs:
            with self.subTest(spec=path.name):
                spec = load_spec(path)
                self.assertTrue(spec.name)
                # Nothing ships ENABLED. A spec that creates a live campaign on
                # apply is how an unattended run starts spending.
                self.assertEqual(spec.status, "PAUSED")

    def test_web_spec_carries_the_utm_join_key(self):
        spec = load_spec(REPO_SPECS / "habits-web-landing.yaml")
        self.assertTrue(spec.tracking.utm_campaign)
        suffix = spec.tracking.final_url_suffix()
        self.assertIn(f"utm_campaign={spec.tracking.utm_campaign}", suffix)
        self.assertIn("utm_term={keyword}", suffix)


BASE_APP = """
campaign:
    name: "T"
    kind: app_install
    app_id: "com.therr.habits"
budget: {daily: 20}
bidding: {goal: OPTIMIZE_INSTALLS_TARGET_INSTALL_COST, target_cpa: 2.5}
targeting: {location_ids: ["2840"]}
assets:
    headlines: ["One", "Two"]
    descriptions: ["A description that is comfortably inside the limit."]
    videos: ["v.mp4"]
"""


class ValidationTest(unittest.TestCase):
    def test_minimal_app_spec_is_valid(self):
        spec = load_spec(write_spec(BASE_APP))
        self.assertEqual(spec.kind, "app_install")
        self.assertTrue(spec.is_app)

    def test_rejects_unknown_kind(self):
        with self.assertRaises(SpecError) as ctx:
            load_spec(write_spec(BASE_APP.replace("app_install", "brand_awareness")))
        self.assertIn("campaign.kind", str(ctx.exception))

    def test_rejects_missing_geo_targeting(self):
        body = BASE_APP.replace('targeting: {location_ids: ["2840"]}', "targeting: {}")
        with self.assertRaises(SpecError) as ctx:
            load_spec(write_spec(body))
        self.assertIn("location_ids", str(ctx.exception))

    def test_rejects_overlong_headline(self):
        body = BASE_APP.replace('"One"', '"This headline is far too long for Google Ads"')
        with self.assertRaises(SpecError) as ctx:
            load_spec(write_spec(body))
        self.assertIn("assets.headlines[0]", str(ctx.exception))

    def test_rejects_target_cpa_missing_for_cost_targeting_goal(self):
        body = BASE_APP.replace("target_cpa: 2.5", "")
        with self.assertRaises(SpecError) as ctx:
            load_spec(write_spec(body))
        self.assertIn("target_cpa is required", str(ctx.exception))

    def test_rejects_ad_groups_on_an_app_campaign(self):
        body = BASE_APP + '\nad_groups:\n    - name: "x"\n      keywords: ["y"]\n'
        with self.assertRaises(SpecError) as ctx:
            load_spec(write_spec(body))
        self.assertIn("not configurable on App campaigns", str(ctx.exception))

    def test_reports_every_error_not_just_the_first(self):
        body = """
campaign: {name: "", kind: app_install}
budget: {daily: 0}
bidding: {goal: NOT_A_GOAL}
targeting: {}
assets: {headlines: [], descriptions: []}
"""
        with self.assertRaises(SpecError) as ctx:
            load_spec(write_spec(body))
        message = str(ctx.exception)
        for expected in ("campaign.name", "budget.daily", "bidding.goal", "location_ids"):
            self.assertIn(expected, message)

    def test_missing_video_is_a_warning_not_an_error(self):
        body = BASE_APP.replace('    videos: ["v.mp4"]', "")
        spec = load_spec(write_spec(body))
        self.assertTrue(any("videos" in w for w in spec.warnings))


BASE_WEB = """
campaign: {name: "W", kind: web_landing}
budget: {daily: 10}
bidding: {goal: OPTIMIZE_INSTALLS_TARGET_INSTALL_COST, target_cpa: 8}
targeting: {location_ids: ["2840"]}
tracking: {utm_campaign: "w-2026q3"}
ad_groups:
    - name: "g"
      match_type: PHRASE
      final_url: "https://habits.therr.com"
      keywords: ["habit tracker with friends"]
assets:
    headlines: ["One", "Two", "Three"]
    descriptions: ["First description here.", "Second description here."]
"""


class WebSpecTest(unittest.TestCase):
    def test_minimal_web_spec_is_valid(self):
        spec = load_spec(write_spec(BASE_WEB))
        self.assertFalse(spec.is_app)
        self.assertEqual(len(spec.ad_groups), 1)

    def test_requires_utm_campaign(self):
        body = BASE_WEB.replace('tracking: {utm_campaign: "w-2026q3"}', "tracking: {}")
        with self.assertRaises(SpecError) as ctx:
            load_spec(write_spec(body))
        self.assertIn("utm_campaign is required", str(ctx.exception))

    def test_rejects_query_string_in_final_url(self):
        body = BASE_WEB.replace(
            '"https://habits.therr.com"', '"https://habits.therr.com?utm_source=google"'
        )
        with self.assertRaises(SpecError) as ctx:
            load_spec(write_spec(body))
        self.assertIn("must not carry a query string", str(ctx.exception))

    def test_rejects_non_https_final_url(self):
        body = BASE_WEB.replace('"https://habits.therr.com"', '"http://habits.therr.com"')
        with self.assertRaises(SpecError) as ctx:
            load_spec(write_spec(body))
        self.assertIn("must be https", str(ctx.exception))

    def test_broad_match_without_negatives_warns(self):
        body = BASE_WEB.replace("match_type: PHRASE", "match_type: BROAD")
        spec = load_spec(write_spec(body))
        self.assertTrue(any("BROAD" in w for w in spec.warnings))


if __name__ == "__main__":
    unittest.main()
