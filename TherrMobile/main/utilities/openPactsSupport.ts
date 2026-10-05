import { PactsService } from 'therr-react/services';

/**
 * Whether the API this build talks to supports open pacts.
 *
 * The mobile app ships on the Play pipeline (`niche/HABITS-main`) and the API on `general → stage →
 * main`, independently, and a store build cannot be recalled. Without this check, a build that
 * reaches users before the open-pacts API does offers a "Let others ask to join" switch the server
 * silently ignores, a toggle that 404s, and an open-pacts list that is always empty. So every
 * open-pacts control asks first, and stays hidden until the server says yes.
 *
 * Two signals, cheapest first:
 * - A pact the app already holds: a server with open pacts selects `habits.pacts."isOpen"`, a
 *   NOT NULL column, so every pact it returns carries a boolean. An older one has no such column.
 * - A probe of `GET /habits/pacts/open`, once per app session, for the screens that have no pact
 *   to look at (the create-pact wizard of a first-time user).
 */

interface IPactLike {
    isOpen?: unknown;
}

let isSupported: boolean | undefined;
let inFlightProbe: Promise<boolean> | undefined;

export const pactShowsOpenPactSupport = (pact?: IPactLike | null): boolean => typeof pact?.isOpen === 'boolean';

export const checkOpenPactsSupported = (knownPacts: Array<IPactLike | null | undefined> = []): Promise<boolean> => {
    if (isSupported !== undefined) {
        return Promise.resolve(isSupported);
    }
    if (knownPacts.some(pactShowsOpenPactSupport)) {
        isSupported = true;
        return Promise.resolve(true);
    }

    if (!inFlightProbe) {
        // Started inside the chain so even a synchronous throw lands in `catch` rather than in the
        // caller's componentDidMount.
        inFlightProbe = Promise.resolve()
            .then(() => PactsService.getOpenPacts())
            .then((response: any) => {
                // The interceptor turns a transient GET failure into `{ data: {}, isOfflineFallback }`.
                // That says nothing about the server, so it is not remembered — the next screen asks again.
                if (response?.isOfflineFallback) {
                    return false;
                }
                isSupported = Array.isArray(response?.data?.pacts);
                return isSupported;
            })
            .catch((error: any) => {
                // An older server routes `/habits/pacts/open` to `/habits/pacts/:id` and answers with
                // an error. Any HTTP answer is a verdict; no answer at all (offline) is not.
                if (error?.response) {
                    isSupported = false;
                }
                return false;
            })
            .finally(() => {
                inFlightProbe = undefined;
            });
    }

    return inFlightProbe;
};

/** Test-only: forget the session's verdict. */
export const resetOpenPactsSupport = () => {
    isSupported = undefined;
    inFlightProbe = undefined;
};
