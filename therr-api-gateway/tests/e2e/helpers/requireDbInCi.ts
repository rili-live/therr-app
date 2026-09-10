/**
 * Root hook: in CI, refuse to let the campaign E2E suite pass without a database.
 *
 * Every suite here opens with `checkE2eConnection()` and, when it fails, sets a
 * local `skipTests` flag that makes each `it` body `return` immediately. Mocha
 * scores an empty test body as a PASS, so an unreachable postgres turns the whole
 * job green while exercising nothing — the failure mode a CI gate exists to
 * prevent. Locally that skip is the right behaviour (a developer without infra
 * running `npm test` should not see a wall of red), so the guard is scoped to CI.
 *
 * `_bin/cicd/test-campaign-e2e.sh` passes CI=true into the container; CircleCI
 * sets it on the host but `docker run` does not forward it.
 */
import { checkE2eConnection, closeE2eConnection } from './testConnection';

export const mochaHooks = {
    async beforeAll() {
        if (!process.env.CI) {
            return;
        }

        const isConnected = await checkE2eConnection();

        if (!isConnected) {
            // Close what the probe opened; the throw below skips every suite's own
            // `after` hook, and a leaked pool holds the process open past `--exit`.
            await closeE2eConnection();
            throw new Error(
                'Campaign E2E: no connection to the users and maps databases. '
                + 'The suite would otherwise report every test as passing without running any of them. '
                + 'Check that setup-test-db.sh ran and that migrations were applied to both databases.',
            );
        }
    },
};
