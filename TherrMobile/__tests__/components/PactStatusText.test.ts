import { it, describe, expect, jest } from '@jest/globals';

jest.mock('react-native-vector-icons/FontAwesome5', () => ({
    __esModule: true,
    default: () => null,
}));

import { getStatusText } from '../../main/components/Habits/PactCard';

/**
 * A pending pact is named for whoever has to act on it, never as "Pending".
 *
 * The dashboard's invite segment is also about pending things, so the bare word
 * meant two different things on one screen: an empty "Pending" segment sat
 * beside an "All" segment listing pacts badged "Pending" — the same pacts the
 * "Sent" segment described, correctly, as awaiting acceptance.
 */

const translate = (key: string) => key;

describe('getStatusText', () => {
    it('names the sender\'s side of a pending pact', () => {
        expect(getStatusText('pending', translate, false))
            .toBe('pages.pacts.status.awaitingAcceptance');
    });

    it('names the recipient\'s side of a pending pact', () => {
        expect(getStatusText('pending', translate, true))
            .toBe('pages.pacts.status.needsYourReply');
    });

    it('never renders the bare "pending" status string', () => {
        expect(getStatusText('pending', translate, false)).not.toBe('pages.pacts.status.pending');
        expect(getStatusText('pending', translate, true)).not.toBe('pages.pacts.status.pending');
    });

    it('leaves the unambiguous statuses alone', () => {
        ['active', 'completed', 'abandoned', 'expired'].forEach((status) => {
            expect(getStatusText(status, translate, false)).toBe(`pages.pacts.status.${status}`);
        });
    });

    it('passes an unknown status through rather than rendering a missing key', () => {
        // A status added server-side before the client knows about it should read
        // as itself, not as the literal text "pages.pacts.status.whatever".
        expect(getStatusText('archived', translate, false)).toBe('archived');
    });

    it('ignores the response flag for a pact that is not pending', () => {
        expect(getStatusText('active', translate, true)).toBe('pages.pacts.status.active');
    });
});
