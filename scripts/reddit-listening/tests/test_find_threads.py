"""Rules for which Reddit posts are worth a human reply. No network: listings are fixtures."""

import os
import sys
import unittest
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import find_threads  # noqa: E402

NOW = 1_800_000_000.0
CONFIG = find_threads.load_config(find_threads.DEFAULT_CONFIG)


def post(**overrides):
    base = {
        "id": "abc123",
        "subreddit": "getdisciplined",
        "title": "Looking for an accountability partner for my morning runs",
        "selftext": "I keep quitting after a week. Anyone want to keep each other accountable?",
        "permalink": "/r/getdisciplined/comments/abc123/looking/",
        "author": "someone",
        "created_utc": NOW - 2 * 3600,
        "num_comments": 1,
    }
    base.update(overrides)
    return base


class EvaluatePostTests(unittest.TestCase):
    def test_a_fresh_quiet_request_ranks_with_its_reasons(self):
        candidate = find_threads.evaluate_post(post(), CONFIG, NOW)
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate.url, "https://www.reddit.com/r/getdisciplined/comments/abc123/looking/")
        self.assertIn("accountability partner", candidate.match_reasons)
        self.assertEqual(candidate.age_hours, 2.0)

    def test_an_unrelated_post_is_dropped(self):
        self.assertIsNone(find_threads.evaluate_post(
            post(title="What is your favourite planner?", selftext="Just curious."), CONFIG, NOW))

    def test_old_busy_locked_and_deleted_posts_are_dropped(self):
        self.assertIsNone(find_threads.evaluate_post(post(created_utc=NOW - 30 * 3600), CONFIG, NOW))
        self.assertIsNone(find_threads.evaluate_post(post(num_comments=200), CONFIG, NOW))
        self.assertIsNone(find_threads.evaluate_post(post(locked=True), CONFIG, NOW))
        self.assertIsNone(find_threads.evaluate_post(post(author="[deleted]"), CONFIG, NOW))
        self.assertIsNone(find_threads.evaluate_post(post(over_18=True), CONFIG, NOW))

    def test_launch_posts_money_and_crisis_posts_are_never_candidates(self):
        self.assertIsNone(find_threads.evaluate_post(
            post(title="I built an accountability partner app"), CONFIG, NOW))
        self.assertIsNone(find_threads.evaluate_post(
            post(selftext="Accountability partner wanted, will pay via PayPal"), CONFIG, NOW))
        self.assertIsNone(find_threads.evaluate_post(
            post(selftext="I need an accountability partner, some days I think about suicide"), CONFIG, NOW))

    def test_a_post_dated_in_the_future_is_dropped(self):
        self.assertIsNone(find_threads.evaluate_post(post(created_utc=NOW + 600), CONFIG, NOW))


class RankTests(unittest.TestCase):
    def test_stronger_matches_rank_first_and_duplicates_collapse(self):
        weak = post(id="weak", title="Anyone want to do a 30 day challenge with me?", selftext="")
        strong = post(id="strong")
        ranked = find_threads.rank_candidates([weak, strong, strong], CONFIG, NOW)
        self.assertEqual([c.id for c in ranked], ["strong", "weak"])

    def test_results_are_capped(self):
        posts = [post(id=f"p{i}") for i in range(30)]
        self.assertEqual(len(find_threads.rank_candidates(posts, CONFIG, NOW)), CONFIG["max_results"])


class CollectTests(unittest.TestCase):
    def test_a_failing_subreddit_is_reported_and_the_rest_still_load(self):
        config = dict(CONFIG, subreddits=["getdisciplined", "blocked"])

        def fetch(url, _headers):
            if "/r/blocked/" in url:
                raise urllib.error.URLError("403")
            if url.endswith("rules.json?raw_json=1"):
                return {"rules": [{"short_name": "No self-promotion", "description": "Do not advertise."}]}
            return {"data": {"children": [{"data": post()}]}}

        posts, rules, failures = find_threads.collect(config, fetch, "https://x", {}, sleep=lambda _s: None)
        self.assertEqual(len(posts), 1)
        self.assertIn("blocked", failures)
        self.assertEqual(rules["getdisciplined"], ["No self-promotion: Do not advertise."])

    def test_markdown_lists_candidates_failures_and_rules(self):
        candidate = find_threads.evaluate_post(post(), CONFIG, NOW)
        text = find_threads.render_markdown([candidate], {"getdisciplined": ["No self-promotion"]}, {"x": "403"})
        self.assertIn("r/getdisciplined: Looking for an accountability partner", text)
        self.assertIn("- r/x: 403", text)
        self.assertIn("No self-promotion", text)


if __name__ == "__main__":
    unittest.main()
