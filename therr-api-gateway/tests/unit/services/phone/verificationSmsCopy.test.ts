/**
 * Regression guard for the brand named in the passwordless verification SMS.
 *
 * The dictionary entry used to hard-code "Therr app", so a Friends with Habits user asking to
 * sign in received "Your Therr app verification code is: ..." — a message naming an app they
 * had never installed, which is indistinguishable from a phishing attempt and trains people to
 * ignore the one SMS they must not ignore.
 *
 * These assertions exercise the same `translate` + `getBrandName` pair the router composes in
 * `sendVerificationSms`; the router itself is not importable here because it stands up the
 * Twilio and Redis clients at module load.
 */
import { expect } from 'chai';
import { BrandVariations, getBrandName } from 'therr-js-utilities/constants';
import translate from '../../../../src/utilities/translator';

const LOCALES = ['en-us', 'es'];

describe('verification SMS copy', () => {
    LOCALES.forEach((locale) => {
        describe(locale, () => {
            it('names the brand the code was requested for', () => {
                const body = translate(locale, 'sms.yourVerificationCode', {
                    brandName: getBrandName(BrandVariations.HABITS),
                    code: 123456,
                });

                expect(body).to.contain('Friends with Habits');
                expect(body).to.contain('123456');
            });

            it('never leaks Therr into another brand\'s message', () => {
                const body = translate(locale, 'sms.yourVerificationCode', {
                    brandName: getBrandName(BrandVariations.HABITS),
                    code: 123456,
                });

                expect(body).to.not.contain('Therr');
            });

            it('falls back to Therr when the brand header is absent or unrecognized', () => {
                [undefined, '', 'not-a-brand'].forEach((brandVariation) => {
                    const body = translate(locale, 'sms.yourVerificationCode', {
                        brandName: getBrandName(brandVariation),
                        code: 123456,
                    });

                    expect(body).to.contain('Therr');
                    expect(body).to.contain('123456');
                });
            });

            it('leaves no unsubstituted placeholders', () => {
                const body = translate(locale, 'sms.yourVerificationCode', {
                    brandName: getBrandName(BrandVariations.THERR),
                    code: 123456,
                });

                expect(body).to.not.contain('{');
                expect(body).to.not.contain('}');
            });
        });
    });
});
