"""Connection-string quoting and credential-set validation.

Both cover failures that report themselves as something else: a password with a
space surfaces as an authentication error, and a half-set environment surfaces
as a KeyError from inside the google-ads library.
"""

import os
import unittest
from unittest import mock

from therr_ads.client import build_client
from therr_ads.settings import ProductDbSettings, SettingsError, _quote_conninfo


class ConninfoQuotingTest(unittest.TestCase):
    def test_plain_values_are_quoted(self):
        self.assertEqual(_quote_conninfo("simple"), "'simple'")

    def test_a_value_with_a_space_stays_one_field(self):
        # Unquoted, libpq would split here and read "pass" as the whole password.
        self.assertEqual(_quote_conninfo("pass word"), "'pass word'")

    def test_single_quotes_and_backslashes_are_escaped(self):
        self.assertEqual(_quote_conninfo("it's"), r"'it\'s'")
        self.assertEqual(_quote_conninfo("back\\slash"), r"'back\\slash'")

    def test_empty_value_is_still_a_well_formed_field(self):
        self.assertEqual(_quote_conninfo(""), "''")


class DsnTest(unittest.TestCase):
    ENV = {
        "DB_HOST_MAIN_READ": "10.0.0.5",
        "DB_PORT_MAIN_READ": "5432",
        "DB_USER_MAIN_READ": "reader",
        "DB_PASSWORD_MAIN_READ": "p@ss word'y",
        "USERS_SERVICE_DATABASE": "therr",
    }

    def test_a_password_with_a_space_survives_the_dsn(self):
        with mock.patch.dict(os.environ, self.ENV, clear=False):
            dsn = ProductDbSettings(enabled=True).dsn()
        self.assertIn(r"password='p@ss word\'y'", dsn)
        self.assertIn("host='10.0.0.5'", dsn)
        self.assertIn("dbname='therr'", dsn)

    def test_missing_env_names_every_missing_variable(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(SettingsError) as caught:
                ProductDbSettings(enabled=True).dsn()
        self.assertIn("DB_HOST_MAIN_READ", str(caught.exception))

    def test_port_defaults_when_unset(self):
        env = {k: v for k, v in self.ENV.items() if k != "DB_PORT_MAIN_READ"}
        with mock.patch.dict(os.environ, env, clear=True):
            self.assertIn("port='5432'", ProductDbSettings(enabled=True).dsn())


class EnvCredentialSetTest(unittest.TestCase):
    """A partial GOOGLE_ADS_* set must name what is missing, not KeyError."""

    def test_partial_env_credentials_are_rejected_by_name(self):
        partial = {
            "GOOGLE_ADS_DEVELOPER_TOKEN": "tok",
            "GOOGLE_ADS_REFRESH_TOKEN": "refresh",
        }
        with mock.patch.dict(os.environ, partial, clear=True):
            with self.assertRaises(SettingsError) as caught:
                build_client()
        message = str(caught.exception)
        # Either the google-ads package is absent (its own clear message) or we
        # reached the credential check; only the latter is under test here.
        if "google-ads package is not installed" in message:
            self.skipTest("google-ads not installed in this environment")
        self.assertIn("GOOGLE_ADS_CLIENT_ID", message)
        self.assertIn("GOOGLE_ADS_CLIENT_SECRET", message)


if __name__ == "__main__":
    unittest.main()


class Ga4CredentialsFileTest(unittest.TestCase):
    """`ga4.credentials_file` must reach the Data API client as a service-account
    file, with `~` expanded, and its absence must fall back to ADC — the two
    routes fail in different consoles, so a silent mix-up costs an afternoon."""

    def _fake_module(self):
        import sys
        import types
        from unittest import mock

        client_cls = mock.Mock()
        client_cls.from_service_account_file = mock.Mock(return_value="from-file")
        client_cls.return_value = "adc"
        module = types.ModuleType("google.analytics.data_v1beta")
        module.BetaAnalyticsDataClient = client_cls
        return mock.patch.dict(sys.modules, {"google.analytics.data_v1beta": module}), client_cls

    def test_file_is_expanded_and_used(self):
        from pathlib import Path

        from therr_ads import ga4

        patcher, client_cls = self._fake_module()
        with patcher:
            self.assertEqual(ga4.data_client("~/keys/ga.json"), "from-file")
        client_cls.from_service_account_file.assert_called_once_with(str(Path("~/keys/ga.json").expanduser()))

    def test_empty_falls_back_to_default_credentials(self):
        from therr_ads import ga4

        patcher, client_cls = self._fake_module()
        with patcher:
            self.assertEqual(ga4.data_client(""), "adc")
        client_cls.from_service_account_file.assert_not_called()

    def test_settings_loader_reads_the_key(self):
        import tempfile

        from therr_ads.settings import load_settings

        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as handle:
            handle.write('customer_id: "1"\nga4:\n  credentials_file: "~/x.json"\n')
        self.assertEqual(load_settings(handle.name).ga4.credentials_file, "~/x.json")
