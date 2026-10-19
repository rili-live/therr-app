/**
 * Server-driven app update policy for the mobile apps.
 *
 * Store auto-update is the only thing that moves installs forward, and users can (and do)
 * turn it off. The policy lets us tell an installed build it is behind without shipping
 * anything: two `main.config` rows per brand and OS, editable with a single UPDATE.
 *
 *   appVersion.<brandVariation>.<os>.minimum      below this, the app blocks until updated
 *   appVersion.<brandVariation>.<os>.recommended  below this, the app shows a dismissible nudge
 *
 * e.g. `appVersion.habits.android.recommended` = `1.21.0`. A missing row means "no policy",
 * so with no rows at all every client is told `none` — the safe default.
 *
 * Only builds that send `x-app-version` can be gated. Installs from before the header existed
 * never call this endpoint, so raising `minimum` does not reach them — the API must stay
 * backward compatible with those builds regardless.
 */

export type AppUpdateStatus = 'none' | 'recommended' | 'required';

export interface IAppVersionPolicy {
    status: AppUpdateStatus;
    currentVersion: string | null;
    minimumVersion: string | null;
    recommendedVersion: string | null;
}

const SUPPORTED_OS = ['android', 'ios'];

// Bounded so a malformed header can't produce a config key we would never write.
const VERSION_RE = /^\d{1,5}(\.\d{1,5}){0,3}$/;

export const normalizeAppOs = (os?: string): string | null => {
    const normalized = (os || '').toLowerCase().trim();

    return SUPPORTED_OS.includes(normalized) ? normalized : null;
};

export const isValidAppVersion = (version?: string | null): version is string => !!version && VERSION_RE.test(version.trim());

/**
 * Numeric, segment-wise comparison: `1.10.0` > `1.9.3`, and `1.2` equals `1.2.0`.
 * Returns a negative number when `a` is older, positive when newer, 0 when equal.
 */
export const compareAppVersions = (a: string, b: string): number => {
    const aParts = a.trim().split('.').map(Number);
    const bParts = b.trim().split('.').map(Number);
    const length = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < length; i += 1) {
        const diff = (aParts[i] || 0) - (bParts[i] || 0);
        if (diff !== 0) {
            return diff;
        }
    }

    return 0;
};

export const getAppVersionConfigKeys = (brandVariation: string, os: string) => ({
    minimum: `appVersion.${brandVariation}.${os}.minimum`,
    recommended: `appVersion.${brandVariation}.${os}.recommended`,
});

/**
 * Decide what a client on `currentVersion` should be told. Any value that does not parse as a
 * version — a missing header, a typo in a config row — resolves toward `none`, because a bad
 * row that blocked every install would be far worse than one that blocks nobody.
 */
export const resolveAppVersionPolicy = ({
    currentVersion,
    minimumVersion,
    recommendedVersion,
}: {
    currentVersion?: string | null;
    minimumVersion?: string | null;
    recommendedVersion?: string | null;
}): IAppVersionPolicy => {
    const current = isValidAppVersion(currentVersion) ? currentVersion.trim() : null;
    const minimum = isValidAppVersion(minimumVersion) ? minimumVersion.trim() : null;
    const recommended = isValidAppVersion(recommendedVersion) ? recommendedVersion.trim() : null;
    let status: AppUpdateStatus = 'none';

    if (current) {
        if (minimum && compareAppVersions(current, minimum) < 0) {
            status = 'required';
        } else if (recommended && compareAppVersions(current, recommended) < 0) {
            status = 'recommended';
        }
    }

    return {
        status,
        currentVersion: current,
        minimumVersion: minimum,
        recommendedVersion: recommended,
    };
};
