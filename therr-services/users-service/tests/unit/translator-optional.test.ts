/**
 * `translateOptional` is the miss-detecting wrapper that per-brand copy overrides are built
 * on (`emails.contactInvite.body2ByBrand.*`, `invites.phoneTaglines.*`).
 *
 * It exists because the underlying translator echoes the key back when it finds nothing, so a
 * naive lookup of an override a brand does not have would put a literal
 * `emails.contactInvite.body2ByBrand.teem` into a customer-facing email.
 */
import { expect } from 'chai';
import translate, { translateOptional } from '../../src/utilities/translator';

describe('translateOptional', () => {
    it('resolves a key the dictionary has', () => {
        expect(translateOptional('en-us', 'emails.contactInvite.body2ByBrand.habits'))
            .to.equal(translate('en-us', 'emails.contactInvite.body2ByBrand.habits'));
        expect(translateOptional('en-us', 'emails.contactInvite.body2ByBrand.habits'))
            .to.contain('be the change');
    });

    it('resolves undefined — never the key — for a missing entry', () => {
        const missing = 'emails.contactInvite.body2ByBrand.teem';

        // The behavior being guarded against: the raw translator hands back the key.
        expect(translate('en-us', missing)).to.equal(missing);
        expect(translateOptional('en-us', missing)).to.equal(undefined);
    });

    it('treats an absent brand segment as a miss rather than a partial match', () => {
        // `brandVariation` is empty when the header is absent, which must not resolve to the
        // parent object or to the key text.
        expect(translateOptional('en-us', 'emails.contactInvite.body2ByBrand.')).to.equal(undefined);
        expect(translateOptional('en-us', 'invites.phoneTaglines.')).to.equal(undefined);
    });

    it('resolves undefined for a wholly unknown namespace', () => {
        expect(translateOptional('en-us', 'not.a.real.key')).to.equal(undefined);
    });

    it('treats a key naming a branch rather than a leaf as a miss', () => {
        // The translator walks the dictionary by path and returns whatever it lands on, so
        // these keys — the override namespaces with no brand appended — resolve to the parent
        // object. Unguarded that object reaches a caller typed for a string and renders as
        // '[object Object]' in a live email or SMS.
        ['emails.contactInvite.body2ByBrand', 'invites.phoneTaglines'].forEach((branchKey) => {
            expect(translate('en-us', branchKey)).to.be.an('object');
            expect(translateOptional('en-us', branchKey)).to.equal(undefined);
        });
    });
});
