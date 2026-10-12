"""Which conversions count as an App campaign's installs.

The CHANNEL verdict divides spend by installs, so an inflated install count is
a better-looking CPI that the analyzer then acts on.
"""

import unittest
from decimal import Decimal

from therr_ads.reporting import InstallAction, split_installs

HABITS = "com.therr.habits"
FIRST_OPEN = InstallAction("ca/1", "com.therr.habits (Android) First open", "FIREBASE_ANDROID_FIRST_OPEN", HABITS)
HABITS_PLAY = InstallAction("ca/2", "Friends with Habits installs", "GOOGLE_PLAY_DOWNLOAD", HABITS)
ALL_OTHER_APPS = InstallAction("ca/3", "Android installs (all other apps)", "ANDROID_INSTALLS_ALL_OTHER_APPS")
FLAGSHIP_FIRST_OPEN = InstallAction("ca/4", "Therr (Android) First open", "FIREBASE_ANDROID_FIRST_OPEN", "app.therrmobile")


class SplitInstallsTest(unittest.TestCase):
    def test_the_catch_all_install_action_is_not_this_apps_install(self):
        # The first App run, 2026-10-09 to 11: 6 first opens, plus 7 catch-all
        # conversions on day one that made the CPI read $2.07 instead of $4.49.
        installs, excluded = split_installs(
            HABITS,
            {"ca/1": Decimal("6"), "ca/3": Decimal("7")},
            [FIRST_OPEN, ALL_OTHER_APPS],
        )
        self.assertEqual(installs, Decimal("6"))
        self.assertEqual(excluded, {"Android installs (all other apps)": Decimal("7")})

    def test_first_open_wins_over_play_download_so_one_install_counts_once(self):
        installs, excluded = split_installs(
            HABITS,
            {"ca/1": Decimal("5"), "ca/2": Decimal("6")},
            [FIRST_OPEN, HABITS_PLAY],
        )
        self.assertEqual(installs, Decimal("5"))
        self.assertIn("Friends with Habits installs", excluded)

    def test_play_download_is_the_fallback_without_a_first_open_action(self):
        installs, _ = split_installs(HABITS, {"ca/2": Decimal("4")}, [HABITS_PLAY, ALL_OTHER_APPS])
        self.assertEqual(installs, Decimal("4"))

    def test_another_apps_first_open_is_never_counted(self):
        installs, excluded = split_installs(
            HABITS,
            {"ca/1": Decimal("2"), "ca/4": Decimal("3")},
            [FIRST_OPEN, FLAGSHIP_FIRST_OPEN],
        )
        self.assertEqual(installs, Decimal("2"))
        self.assertEqual(excluded, {"Therr (Android) First open": Decimal("3")})

    def test_a_campaign_with_no_app_has_no_installs(self):
        installs, excluded = split_installs("", {"ca/1": Decimal("2")}, [FIRST_OPEN])
        self.assertEqual(installs, Decimal("0"))
        self.assertEqual(excluded, {FIRST_OPEN.name: Decimal("2")})


if __name__ == "__main__":
    unittest.main()
