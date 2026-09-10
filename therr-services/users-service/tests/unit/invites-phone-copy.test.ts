/**
 * Regression guard for the contact-invite SMS copy.
 *
 * The dictionary entry used to read "{name} invited you to Therr — the local community and
 * rewards app", so an invite sent from Friends with Habits named the wrong app *and*
 * described it as something it is not. The brand name is now interpolated, and the tagline
 * is a per-brand lookup that renders empty for any brand that does not ship one — rather
 * than inventing marketing copy for brands that have none.
 *
 * These assertions compose the string exactly as `createOrInviteUserConnections` does.
 */
import { expect } from 'chai';
import translate from '../../src/utilities/translator';
import { getHostContext } from '../../src/constants/hostContext';

const LOCALES = ['en-us', 'es', 'fr-ca'];

// Mirrors the lookup in the handler: `translate` echoes the key back on a miss.
const resolveTagline = (locale: string, brandVariation: string) => {
    const key = `invites.phoneTaglines.${brandVariation}`;
    const translated = translate(locale, key);

    return translated === key ? '' : translated;
};

const buildInviteSms = (locale: string, brandVariation: string) => {
    const contextConfig = getHostContext('', brandVariation);

    return translate(locale, 'invites.phone', {
        name: 'Jane Doe',
        brandName: contextConfig.brandShortName,
        brandTagline: resolveTagline(locale, brandVariation),
        inviteUrl: 'https://example.com/invite/link/abc',
    });
};

describe('contact invite SMS copy', () => {
    LOCALES.forEach((locale) => {
        describe(locale, () => {
            it('names the sending brand', () => {
                const body = buildInviteSms(locale, 'habits');

                expect(body).to.contain('Friends with Habits');
                expect(body).to.contain('Jane Doe');
                expect(body).to.contain('https://example.com/invite/link/abc');
            });

            it('does not leak Therr, or its tagline, into another brand\'s invite', () => {
                const body = buildInviteSms(locale, 'habits');

                expect(body).to.not.contain('Therr');
                // The Therr tagline calls the app a local community and rewards app, which
                // Friends with Habits is not.
                expect(body.toLowerCase()).to.not.contain('rewards');
                expect(body.toLowerCase()).to.not.contain('récompenses');
                expect(body.toLowerCase()).to.not.contain('recompensas');
            });

            it('keeps the existing Therr copy intact, tagline included', () => {
                const body = buildInviteSms(locale, 'therr');

                expect(body).to.contain('Therr');
                expect(body).to.contain(resolveTagline(locale, 'therr'));
                expect(resolveTagline(locale, 'therr')).to.not.equal('');
            });

            it('renders cleanly for a brand with no tagline', () => {
                const body = buildInviteSms(locale, 'teem');

                expect(body).to.contain('Teem');
                expect(body).to.not.contain('{');
                expect(body).to.not.contain('}');
                // No dangling separator or doubled space where the tagline would have been.
                expect(body).to.not.contain('  ');
                expect(body).to.not.contain(' —.');
            });

            it('leaves no unsubstituted placeholders for any known brand', () => {
                ['therr', 'habits', 'teem'].forEach((brandVariation) => {
                    const body = buildInviteSms(locale, brandVariation);

                    expect(body).to.not.contain('{');
                    expect(body).to.not.contain('}');
                });
            });
        });
    });
});
