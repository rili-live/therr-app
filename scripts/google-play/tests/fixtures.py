"""Fake Cloud Storage client, so the report logic is testable without network.

Mirrors only the three calls gcs_reports makes: bucket(), blob(), exists() /
download_as_bytes(), and list_blobs(). Encoding matters here — the fixtures
write UTF-16 with a BOM, because that is what Play actually serves and it is
the failure this suite most needs to keep caught.
"""

from __future__ import annotations


def utf16(text: str) -> bytes:
    """Encode as Play does: UTF-16 with a byte order mark."""
    return text.encode("utf-16")


class FakeBlob:
    def __init__(self, name: str, payload: bytes | None):
        self.name = name
        self._payload = payload

    def exists(self, _client=None) -> bool:
        return self._payload is not None

    def download_as_bytes(self) -> bytes:
        if self._payload is None:
            raise AssertionError(f"download of missing blob {self.name}")
        return self._payload


class FakeBucket:
    def __init__(self, objects: dict[str, bytes]):
        self._objects = objects

    def blob(self, name: str) -> FakeBlob:
        return FakeBlob(name, self._objects.get(name))


class FakeStorageClient:
    """objects maps full object path -> raw bytes."""

    def __init__(self, objects: dict[str, bytes]):
        self._objects = objects
        self.buckets_requested: list[str] = []

    def bucket(self, name: str) -> FakeBucket:
        self.buckets_requested.append(name)
        return FakeBucket(self._objects)

    def list_blobs(self, _bucket, prefix=None):
        for name in sorted(self._objects):
            if prefix is None or name.startswith(prefix):
                yield FakeBlob(name, self._objects[name])


INSTALLS_OVERVIEW = (
    "Date,Package Name,Daily Device Installs,Daily Device Uninstalls,Active Device Installs\n"
    "2026-08-30,com.therr.habits,7,2,120\n"
    "2026-08-31,com.therr.habits,5,1,124\n"
    "2026-09-01,com.therr.habits,9,3,130\n"
)

STORE_PERFORMANCE_TRAFFIC = (
    "Date,Package Name,Traffic Source,Store Listing Visitors,Store Listing Acquisitions\n"
    "2026-08-30,com.therr.habits,Play Store search,40,7\n"
    "2026-08-30,com.therr.habits,Third-party referrers,12,4\n"
    "2026-08-31,com.therr.habits,Play Store search,35,5\n"
)


def installs_bucket() -> dict[str, bytes]:
    return {
        "stats/installs/installs_com.therr.habits_202608_overview.csv": utf16(
            INSTALLS_OVERVIEW
        ),
        "stats/installs/installs_com.therr.habits_202609_overview.csv": utf16(
            "Date,Package Name,Daily Device Installs,Daily Device Uninstalls,"
            "Active Device Installs\n2026-09-01,com.therr.habits,9,3,130\n"
        ),
        "stats/store_performance/store_performance_com.therr.habits_202608_traffic_source.csv": (
            utf16(STORE_PERFORMANCE_TRAFFIC)
        ),
    }
