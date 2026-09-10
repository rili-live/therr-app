import textwrap
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from therr_play.settings import SettingsError, load_settings


def write(tmp: str, body: str) -> Path:
    path = Path(tmp) / "settings.yaml"
    path.write_text(textwrap.dedent(body))
    return path


class LoadSettingsTests(unittest.TestCase):
    def test_missing_file_names_the_fix(self):
        with TemporaryDirectory() as tmp:
            with self.assertRaises(SettingsError) as ctx:
                load_settings(Path(tmp) / "nope.yaml")
            self.assertIn("settings.example.yaml", str(ctx.exception))

    def test_shorthand_and_mapping_app_forms(self):
        with TemporaryDirectory() as tmp:
            path = write(
                tmp,
                """
                bucket: "gs://pubsite_prod_rev_1"
                apps:
                    habits:
                        package: "com.therr.habits"
                        label: "Friends With Habits"
                    therr: "app.therrmobile"
                default_app: habits
                """,
            )
            settings = load_settings(path)
            self.assertEqual(settings.apps["habits"].label, "Friends With Habits")
            self.assertEqual(settings.apps["therr"].package, "app.therrmobile")
            # Shorthand entries fall back to the key as the label.
            self.assertEqual(settings.apps["therr"].label, "therr")

    def test_bucket_uri_is_normalised(self):
        with TemporaryDirectory() as tmp:
            path = write(
                tmp,
                """
                bucket: "gs://pubsite_prod_rev_1/"
                apps: {habits: "com.therr.habits"}
                """,
            )
            self.assertEqual(load_settings(path).require_bucket(), "pubsite_prod_rev_1")

    def test_pasted_uri_with_a_folder_path_yields_the_bucket_name(self):
        """Play Console's copy button hands you a path INTO the bucket."""
        with TemporaryDirectory() as tmp:
            path = write(
                tmp,
                """
                bucket: "gs://pubsite_prod_6296484018560789304/stats/installs/"
                apps: {habits: "com.therr.habits"}
                """,
            )
            self.assertEqual(
                load_settings(path).require_bucket(), "pubsite_prod_6296484018560789304"
            )

    def test_both_bucket_naming_generations_pass_through(self):
        for raw in ("gs://pubsite_prod_rev_0123456789", "gs://pubsite_prod_9876543210"):
            with TemporaryDirectory() as tmp:
                path = write(tmp, f'bucket: "{raw}"\napps: {{h: "com.therr.habits"}}\n')
                self.assertEqual(
                    load_settings(path).require_bucket(), raw.replace("gs://", "")
                )

    def test_missing_bucket_names_where_to_find_it(self):
        with TemporaryDirectory() as tmp:
            path = write(tmp, 'apps: {habits: "com.therr.habits"}\n')
            with self.assertRaises(SettingsError) as ctx:
                load_settings(path).require_bucket()
            self.assertIn("Play Console", str(ctx.exception))


class AppResolutionTests(unittest.TestCase):
    def _settings(self, default: str = "habits"):
        with TemporaryDirectory() as tmp:
            path = write(
                tmp,
                f"""
                bucket: "gs://pubsite_prod_rev_1"
                apps:
                    habits: "com.therr.habits"
                    therr: "app.therrmobile"
                default_app: "{default}"
                """,
            )
            return load_settings(path)

    def test_resolves_by_key(self):
        self.assertEqual(self._settings().app("therr").package, "app.therrmobile")

    def test_resolves_by_raw_package_name(self):
        self.assertEqual(self._settings().app("app.therrmobile").key, "therr")

    def test_falls_back_to_default(self):
        self.assertEqual(self._settings().app(None).package, "com.therr.habits")

    def test_no_app_and_no_default_is_an_error_not_a_guess(self):
        """Two apps in one account whose numbers are not comparable."""
        with self.assertRaises(SettingsError):
            self._settings(default="").app(None)

    def test_unknown_app_lists_what_is_configured(self):
        with self.assertRaises(SettingsError) as ctx:
            self._settings().app("com.therr.mobile")
        self.assertIn("habits", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
