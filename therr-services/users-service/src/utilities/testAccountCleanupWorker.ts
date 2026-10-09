import { AccessLevels } from 'therr-js-utilities/constants';
import { internalRestRequest } from 'therr-js-utilities/internal-rest-request';
import logSpan from 'therr-js-utilities/log-or-update-span';
import * as globalConfig from '../../../../global-config';
import { SUPER_ADMIN_ID } from '../constants';
import Store from '../store';

/**
 * Keeps store-review / QA accounts (AccessLevels.TEST_ACCOUNT) from leaving content in front of
 * real users. Google Play review signs in with a real login and posts random text to check that
 * posting works; see docs/TEST_ACCOUNTS.md for the whole picture.
 *
 * Content a flagged account creates is already private from the start (create handlers check
 * `isTestAccount`). This worker covers the rest, on each tick:
 *
 *   1. FLAG    — grants TEST_ACCOUNT to every account in TEST_ACCOUNT_EMAILS. The flag rides
 *                in the JWT, so it takes effect at the account's next sign-in or token refresh.
 *   2. HIDE    — sets everything those accounts have posted to private, which catches content
 *                from before they were flagged. Always on whenever the worker runs.
 *   3. PURGE   — deletes their posts older than TEST_ACCOUNT_CONTENT_RETENTION_HOURS. Only with
 *                TEST_ACCOUNT_CLEANUP_ENABLED=true; otherwise the cutoff sent is the epoch, so
 *                the same calls hide and delete nothing.
 *
 * The account itself is never deleted — Play keeps using the same login — and neither are its
 * habits, pacts or check-ins, which only it and its own pact partners can see.
 *
 * Every step is idempotent, so a second replica or a re-run after a partial failure is safe.
 */

const TICK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Let the pod settle (and pass readiness) before the first tick touches other services.
const FIRST_TICK_DELAY_MS = 2 * 60 * 1000;
const DEFAULT_RETENTION_HOURS = 48;

interface ITestAccountCleanupConfig {
    emails: string[];
    isPurgeEnabled: boolean;
    retentionHours: number;
}

interface ITestAccountCleanupResult {
    flagged: number;
    accounts: number;
    skipped: number;
    failures: number;
}

const getTestAccountCleanupConfig = (env: { [key: string]: string | undefined } = process.env): ITestAccountCleanupConfig => {
    const retentionHours = parseInt(env.TEST_ACCOUNT_CONTENT_RETENTION_HOURS || '', 10);

    return {
        emails: (env.TEST_ACCOUNT_EMAILS || '')
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter((email) => !!email),
        isPurgeEnabled: env.TEST_ACCOUNT_CLEANUP_ENABLED === 'true',
        // A floor of one hour so a typo of 0 cannot delete what a reviewer posted a second ago.
        retentionHours: Number.isFinite(retentionHours) && retentionHours >= 1 ? retentionHours : DEFAULT_RETENTION_HOURS,
    };
};

/**
 * The super admin owns every space and forum reassigned from a deleted account. Flagging it by
 * mistake (it is just an email in an env var) must never let this worker touch that content.
 */
const isProtectedAccount = (account: { id: string; accessLevels?: string[] }) => account.id === SUPER_ADMIN_ID
    || (account.accessLevels || []).includes(AccessLevels.SUPER_ADMIN);

const getServiceTargets = () => [
    { service: 'maps-service', url: `${globalConfig[process.env.NODE_ENV || 'development'].baseMapsServiceRoute}/test-account-content` },
    { service: 'messages-service', url: `${globalConfig[process.env.NODE_ENV || 'development'].baseMessagesServiceRoute}/test-account-content` },
];

const cleanUpAccount = async (account: { id: string; userName: string }, createdBefore: Date): Promise<number> => {
    // The other services refuse unless the forwarded access levels carry TEST_ACCOUNT.
    const headers = {
        'x-userid': account.id,
        'x-username': account.userName || '',
        'x-user-access-levels': JSON.stringify([AccessLevels.TEST_ACCOUNT]),
        'x-platform': 'users-service',
        'x-brand-variation': '',
        'x-localecode': 'en-us',
    };

    const results = await Promise.allSettled([
        Store.thoughts.purgeTestAccountContent(account.id, createdBefore)
            .then((thoughts) => ({ service: 'users-service', data: { thoughts } })),
        ...getServiceTargets().map(({ service, url }) => internalRestRequest({ headers }, {
            method: 'delete',
            url,
            data: { createdBefore: createdBefore.toISOString() },
        }).then((response) => ({ service, data: response?.data }))),
    ]);

    let failures = 0;
    results.forEach((result, index) => {
        const service = index === 0 ? 'users-service' : getServiceTargets()[index - 1].service;
        if (result.status === 'rejected') {
            failures += 1;
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Test account cleanup failed'],
                traceArgs: {
                    'error.message': result.reason?.message,
                    'service.name': service,
                    'user.id': account.id,
                    source: 'testAccountCleanupWorker',
                },
            });
        } else {
            logSpan({
                level: 'info',
                messageOrigin: 'API_SERVER',
                messages: ['Test account content cleaned up'],
                traceArgs: {
                    'service.name': service,
                    'user.id': account.id,
                    'cleanup.result': JSON.stringify(result.value.data),
                    'cleanup.createdBefore': createdBefore.toISOString(),
                    source: 'testAccountCleanupWorker',
                },
            });
        }
    });

    return failures;
};

const runTestAccountCleanup = async (
    config: ITestAccountCleanupConfig = getTestAccountCleanupConfig(),
    now: Date = new Date(),
): Promise<ITestAccountCleanupResult> => {
    const flaggedRows = await Store.users.grantTestAccountAccess(config.emails);
    if (flaggedRows.length) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Granted test account access'],
            traceArgs: {
                'user.ids': flaggedRows.map((row) => row.id).join(','),
                source: 'testAccountCleanupWorker',
            },
        });
    }

    const accounts = await Store.users.getTestAccounts();
    // Hide-only when purging is off: nothing was created before the epoch.
    const createdBefore = config.isPurgeEnabled
        ? new Date(now.getTime() - config.retentionHours * 60 * 60 * 1000)
        : new Date(0);

    let skipped = 0;
    let failures = 0;
    // Sequential: there are a handful of these accounts, and fanning out per account would only
    // multiply the load on the other services' write pools for no gain.
    // eslint-disable-next-line no-restricted-syntax
    for (const account of accounts) {
        if (isProtectedAccount(account)) {
            skipped += 1;
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Refusing to clean up a super admin flagged as a test account'],
                traceArgs: { 'user.id': account.id, source: 'testAccountCleanupWorker' },
            });
        } else {
            // eslint-disable-next-line no-await-in-loop
            failures += await cleanUpAccount(account, createdBefore);
        }
    }

    return {
        flagged: flaggedRows.length,
        accounts: accounts.length,
        skipped,
        failures,
    };
};

let isTicking = false;

const tick = () => {
    if (isTicking) {
        return Promise.resolve();
    }
    isTicking = true;

    return runTestAccountCleanup()
        .catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Test account cleanup tick failed'],
                traceArgs: { 'error.message': err?.message, source: 'testAccountCleanupWorker' },
            });
        })
        .finally(() => {
            isTicking = false;
        });
};

/**
 * Started from index.ts and stopped on SIGTERM. Inert unless TEST_ACCOUNT_EMAILS is set or
 * TEST_ACCOUNT_CLEANUP_ENABLED=true (the latter alone still hides and purges accounts flagged
 * by hand).
 */
const startTestAccountCleanupWorker = (): (() => void) => {
    const config = getTestAccountCleanupConfig();

    if (!config.emails.length && !config.isPurgeEnabled) {
        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Test account cleanup worker disabled (no TEST_ACCOUNT_EMAILS, TEST_ACCOUNT_CLEANUP_ENABLED != true)'],
            traceArgs: { source: 'users-service' },
        });
        return () => undefined;
    }

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Test account cleanup worker started'],
        traceArgs: {
            'testAccounts.emailCount': config.emails.length,
            'testAccounts.isPurgeEnabled': config.isPurgeEnabled,
            'testAccounts.retentionHours': config.retentionHours,
            source: 'users-service',
        },
    });

    let interval: ReturnType<typeof setInterval> | undefined;
    const firstTick = setTimeout(() => {
        tick();
        interval = setInterval(() => { tick(); }, TICK_INTERVAL_MS);
        interval.unref();
    }, FIRST_TICK_DELAY_MS);
    // Never hold the event loop open on shutdown.
    firstTick.unref();

    return () => {
        clearTimeout(firstTick);
        if (interval) clearInterval(interval);
        interval = undefined;
    };
};

export {
    startTestAccountCleanupWorker,
    // Exported for tests.
    runTestAccountCleanup,
    getTestAccountCleanupConfig,
};
