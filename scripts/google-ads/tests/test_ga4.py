"""The pure half of ga4.py — the crawler guard and the in-app funnel builder.

Both are parts a human reads a number off, and neither needs a client, so
neither has an excuse for being untested.
"""

import unittest

from therr_ads.ga4 import (
    ACTIVATION_EVENT,
    ACTIVATION_PROXY_EVENT,
    APP_FUNNEL_STEPS,
    Ga4Row,
    build_app_funnel,
    detect_crawler_contamination,
)


def row(sessions, engaged, **dimensions):
    return Ga4Row(dimensions=dimensions or {"landingPage": "/"}, sessions=sessions,
                  engaged_sessions=engaged)


class CrawlerGuardTest(unittest.TestCase):
    def test_flags_the_real_signature(self):
        # The observed shape: one enormous slice at ~1% engagement beside a
        # handful of small human ones.
        warnings = detect_crawler_contamination([
            row(2616, 28, landingPage="/spaces/x"),
            row(130, 80, landingPage="/"),
        ])
        self.assertEqual(len(warnings), 1)
        self.assertIn("2616 of 2746", warnings[0])

    def test_silent_on_healthy_traffic(self):
        self.assertEqual(detect_crawler_contamination([row(500, 300), row(200, 120)]), [])

    def test_ignores_small_slices_however_bad_their_engagement(self):
        # A 3-session slice at 0% engagement is noise, not a crawler, and
        # flagging it would train the reader to ignore the warning.
        self.assertEqual(detect_crawler_contamination([row(3, 0), row(500, 300)]), [])

    def test_no_rows_is_not_a_division_by_zero(self):
        self.assertEqual(detect_crawler_contamination([]), [])
        self.assertEqual(detect_crawler_contamination([row(0, 0)]), [])


class AppFunnelTest(unittest.TestCase):
    def test_preserves_declared_order_regardless_of_api_order(self):
        funnel = build_app_funnel({"connection_invites_sent": (2, 2), "first_open": (182, 182)})
        self.assertEqual([s.event_name for s in funnel.steps],
                         [name for name, _, _ in APP_FUNNEL_STEPS])
        self.assertEqual(funnel.installs, 182)

    def test_an_event_that_never_fired_is_missing_not_zero(self):
        funnel = build_app_funnel({"first_open": (182, 182)})
        self.assertIn(ACTIVATION_EVENT, funnel.missing_events())
        self.assertEqual(funnel.users_at(ACTIVATION_EVENT), 0)
        self.assertFalse(funnel.step(ACTIVATION_EVENT).instrumented)

    def test_an_event_seen_only_as_a_count_still_counts_as_instrumented(self):
        funnel = build_app_funnel({"first_open": (182, 182), ACTIVATION_EVENT: (0, 4)})
        self.assertTrue(funnel.step(ACTIVATION_EVENT).instrumented)
        self.assertNotIn(ACTIVATION_EVENT, funnel.missing_events())

    def test_the_shipped_flag_marks_what_the_app_actually_emits_today(self):
        shipped = {name for name, _, is_shipped in APP_FUNNEL_STEPS if is_shipped}
        self.assertIn(ACTIVATION_PROXY_EVENT, shipped)
        self.assertNotIn(ACTIVATION_EVENT, shipped)

    def test_empty_response_yields_a_full_funnel_of_zeroes(self):
        funnel = build_app_funnel({})
        self.assertEqual(len(funnel.steps), len(APP_FUNNEL_STEPS))
        self.assertEqual(funnel.installs, 0)
        self.assertEqual(len(funnel.missing_events()), len(APP_FUNNEL_STEPS))

    def test_unknown_events_from_the_api_are_ignored(self):
        funnel = build_app_funnel({"first_open": (182, 182), "screen_view": (999, 4991)})
        self.assertEqual(len(funnel.steps), len(APP_FUNNEL_STEPS))
        self.assertNotIn("screen_view", [s.event_name for s in funnel.steps])

    def test_serializes_without_losing_the_missing_distinction(self):
        payload = build_app_funnel({"first_open": (182, 182)}).to_dict()
        by_name = {s["event_name"]: s for s in payload["steps"]}
        self.assertTrue(by_name["first_open"]["instrumented"])
        self.assertFalse(by_name[ACTIVATION_EVENT]["instrumented"])
        self.assertEqual(payload["installs"], 182)
