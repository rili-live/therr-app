/**
 * Root hook: in CI, refuse to let the campaign E2E suite pass without a usable database.
 *
 * Two distinct silent failures this closes:
 *
 *  1. Every suite opens with `checkE2eConnection()` and, when it fails, sets a local
 *     `skipTests` flag that makes each `it` body `return` immediately. Mocha scores an
 *     empty test body as a PASS, so an unreachable postgres turned the whole job green
 *     while exercising nothing — the failure mode a CI gate exists to prevent.
 *  2. `checkE2eConnection` only runs `SELECT 1`, which succeeds against a database that
 *     exists but has never been migrated. `setup-test-db.sh` creates the databases and
 *     does not migrate them, so "connected" is not the same as "usable" here. Probing a
 *     table the fixtures actually need turns 36 identical `relation does not exist`
 *     failures into one message naming the cause.
 *
 * Locally the skip is the right behaviour — a developer without infra running the suite
 * should not see a wall of red — so the guard is scoped to CI.
 *
 * `_bin/cicd/test-campaign-e2e.sh` passes CI=true into the container; CircleCI sets it
 * on the host but `docker run` does not forward it.
 */
import { getE2eConnection, checkE2eConnection, closeE2eConnection } from './testConnection';

const fail = async (message: string): Promise<never> => {
    // Close what the probe opened; the throw skips every suite's own `after` hook, and a
    // leaked pool holds the process open past `--exit`.
    await closeE2eConnection();
    throw new Error(`Campaign E2E: ${message}`);
};

export const mochaHooks = {
    async beforeAll() {
        if (!process.env.CI) {
            return;
        }

        const isConnected = await checkE2eConnection();

        if (!isConnected) {
            return fail(
                'no connection to the users and maps databases. The suite would otherwise report '
                + 'every test as passing without running any of them. Check that setup-test-db.sh ran.',
            );
        }

        const conn = getE2eConnection();

        try {
            await Promise.all([
                conn.users.read.query('SELECT 1 FROM "main"."users" LIMIT 1'),
                conn.maps.read.query('SELECT 1 FROM "main"."spaces" LIMIT 1'),
            ]);
        } catch (err: any) {
            return fail(
                'connected, but the schema is missing — the databases exist and have not been '
                + `migrated (${err?.message}). test-campaign-e2e.sh runs both services' migrations; `
                + 'check that step rather than the tests.',
            );
        }

        return undefined;
    },
};
