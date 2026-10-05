// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, expect } from '@jest/globals';

const mockGetOpenPacts = jest.fn();
jest.mock('therr-react/services', () => ({
    PactsService: {
        getOpenPacts: (...args: any[]) => mockGetOpenPacts(...args),
    },
}));

import {
    checkOpenPactsSupported,
    pactShowsOpenPactSupport,
    resetOpenPactsSupport,
} from '../../main/utilities/openPactsSupport';

/**
 * The Play build can reach users before the open-pacts API reaches production. These pin that the
 * app offers open-pact controls only once the server is known to support them.
 */
describe('openPactsSupport', () => {
    beforeEach(() => {
        resetOpenPactsSupport();
        mockGetOpenPacts.mockReset();
    });

    describe('pactShowsOpenPactSupport', () => {
        it('reads a pact with a boolean isOpen as coming from a server with open pacts', () => {
            expect(pactShowsOpenPactSupport({ isOpen: false })).toBe(true);
            expect(pactShowsOpenPactSupport({ isOpen: true })).toBe(true);
        });

        it('reads a pact without isOpen as coming from an older server', () => {
            expect(pactShowsOpenPactSupport({})).toBe(false);
            expect(pactShowsOpenPactSupport(undefined)).toBe(false);
            expect(pactShowsOpenPactSupport(null)).toBe(false);
        });
    });

    describe('checkOpenPactsSupported', () => {
        it('answers from a known pact without asking the server', async () => {
            await expect(checkOpenPactsSupported([{}, { isOpen: false }])).resolves.toBe(true);
            expect(mockGetOpenPacts).not.toHaveBeenCalled();
        });

        it('asks the server once per session when no pact can tell', async () => {
            mockGetOpenPacts.mockResolvedValue({ data: { pacts: [], maxMembers: 6 } });

            await expect(checkOpenPactsSupported([])).resolves.toBe(true);
            await expect(checkOpenPactsSupported([])).resolves.toBe(true);
            expect(mockGetOpenPacts).toHaveBeenCalledTimes(1);
        });

        it('shares one in-flight probe between screens asking at once', async () => {
            mockGetOpenPacts.mockResolvedValue({ data: { pacts: [] } });

            await Promise.all([checkOpenPactsSupported(), checkOpenPactsSupported()]);
            expect(mockGetOpenPacts).toHaveBeenCalledTimes(1);
        });

        it('hides open pacts from an older server that answers the probe with an error', async () => {
            mockGetOpenPacts.mockRejectedValue({ response: { status: 500 } });

            await expect(checkOpenPactsSupported()).resolves.toBe(false);
            await expect(checkOpenPactsSupported()).resolves.toBe(false);
            expect(mockGetOpenPacts).toHaveBeenCalledTimes(1);
        });

        it('does not remember an offline answer, so the next screen asks again', async () => {
            mockGetOpenPacts
                .mockResolvedValueOnce({ data: {}, isOfflineFallback: true })
                .mockRejectedValueOnce(new Error('Network Error'))
                .mockResolvedValueOnce({ data: { pacts: [] } });

            await expect(checkOpenPactsSupported()).resolves.toBe(false);
            await expect(checkOpenPactsSupported()).resolves.toBe(false);
            await expect(checkOpenPactsSupported()).resolves.toBe(true);
            expect(mockGetOpenPacts).toHaveBeenCalledTimes(3);
        });
    });
});
