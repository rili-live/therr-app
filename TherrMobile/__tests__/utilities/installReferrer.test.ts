import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInstallAcquisition, parseInstallReferrer } from '../../main/utilities/installReferrer';

/**
 * The Play Install Referrer is the only channel that carries a Google Ads
 * campaign across the Play Store hop into a paid install. Everything downstream
 * of it — whether the app_install arm can be judged on anything but a raw
 * install count — depends on this parsing being right, and none of it is
 * observable without shipping to a real device and buying a real click. So the
 * rules are pure and tested here.
 */

const ATTRIBUTED = 'utm_source=google&utm_medium=cpc'
    + '&utm_campaign=fwh-app-us-installs-2026q3&gclid=abc123';
const PLAY_ORGANIC = 'utm_source=google-play&utm_medium=organic';

describe('parseInstallReferrer', () => {
    describe('a paid install', () => {
        it('extracts the campaign under the field names main."userAcquisition" expects', () => {
            expect(parseInstallReferrer(ATTRIBUTED)).toMatchObject({
                utmSource: 'google',
                utmMedium: 'cpc',
                utmCampaign: 'fwh-app-us-installs-2026q3',
                surface: 'mobile',
            });
        });

        it('keeps the raw referrer alongside the parsed fields', () => {
            // The column exists and the string carries params we do not model
            // yet (gclid). Discarding it would throw away the only copy.
            expect(parseInstallReferrer(ATTRIBUTED)?.referrer).toBe(ATTRIBUTED);
        });

        it('decodes percent-encoding and plus-as-space', () => {
            const parsed = parseInstallReferrer(
                'utm_source=google&utm_medium=cpc&utm_term=accountability+partner+app'
                + '&utm_content=rsa%20one',
            );

            expect(parsed?.utmTerm).toBe('accountability partner app');
            expect(parsed?.utmContent).toBe('rsa one');
        });
    });

    describe('an organic install', () => {
        it('does not turn Play\'s own placeholder into a campaign', () => {
            // utm_source=google-play&utm_medium=organic is what Play sends for
            // someone who browsed the store. Recording it would relabel every
            // organic install as a campaign named "google-play" and make the
            // paid cohort unfindable.
            expect(parseInstallReferrer(PLAY_ORGANIC)).toBeNull();
        });

        it.each([
            ['nothing at all', undefined],
            ['null', null],
            ['an empty string', ''],
            ['whitespace', '   '],
            ['Play\'s literal not-set', 'not set'],
            ['Play\'s encoded not-set', 'not%20set'],
        ])('returns null for %s', (_label, value) => {
            expect(parseInstallReferrer(value)).toBeNull();
        });
    });

    describe('an unrecognised referrer', () => {
        it('is kept as evidence rather than discarded', () => {
            // Not a campaign, but still a fact about where installs come from,
            // and the column is there.
            const parsed = parseInstallReferrer('some_partner_id=42');

            expect(parsed).toMatchObject({ surface: 'mobile', referrer: 'some_partner_id=42' });
            expect(parsed?.utmCampaign).toBeUndefined();
        });
    });

    describe('caps, which the server also enforces', () => {
        it('truncates a utm value to 255 characters', () => {
            const parsed = parseInstallReferrer(`utm_source=google&utm_campaign=${'c'.repeat(400)}`);

            expect(parsed?.utmCampaign).toHaveLength(255);
        });

        it('truncates the raw referrer to 1024 characters', () => {
            const parsed = parseInstallReferrer(`utm_source=google&utm_content=${'x'.repeat(2000)}`);

            expect(parsed?.referrer?.length).toBeLessThanOrEqual(1024);
        });

        it('never emits a field the sanitizer does not know', () => {
            // sanitizeUserAcquisition drops unknown keys silently, so a stray
            // field is not an error — it is a value that stops being recorded.
            const parsed = parseInstallReferrer(ATTRIBUTED) as Record<string, unknown>;

            expect(Object.keys(parsed).sort()).toEqual(
                ['referrer', 'surface', 'utmCampaign', 'utmMedium', 'utmSource'],
            );
        });
    });
});

describe('getInstallAcquisition', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        (NativeModules as any).InstallReferrer = {
            getInstallReferrer: jest.fn().mockResolvedValue({ referrer: ATTRIBUTED }),
        };
        Platform.OS = 'android';
    });

    it('reads the referrer and returns the campaign', async () => {
        await expect(getInstallAcquisition()).resolves.toMatchObject({
            utmCampaign: 'fwh-app-us-installs-2026q3',
        });
    });

    it('reads Play at most once, then serves the cache', async () => {
        // A user can reach registration more than once — a sign-out, a failed
        // first attempt — and each read is a service binding.
        await getInstallAcquisition();
        await getInstallAcquisition();

        expect((NativeModules as any).InstallReferrer.getInstallReferrer).toHaveBeenCalledTimes(1);
    });

    it('does not re-read after a launch that found nothing', async () => {
        // The read flag is stored separately from the value, so "read it and
        // there was nothing" stays distinguishable from "never read it".
        (NativeModules as any).InstallReferrer.getInstallReferrer
            .mockResolvedValue({ referrer: PLAY_ORGANIC });

        await expect(getInstallAcquisition()).resolves.toBeNull();
        await expect(getInstallAcquisition()).resolves.toBeNull();

        expect((NativeModules as any).InstallReferrer.getInstallReferrer).toHaveBeenCalledTimes(1);
    });

    describe('every failure is quiet, because none is actionable', () => {
        it('resolves null on iOS without touching the module', async () => {
            Platform.OS = 'ios';

            await expect(getInstallAcquisition()).resolves.toBeNull();
            expect((NativeModules as any).InstallReferrer.getInstallReferrer).not.toHaveBeenCalled();
        });

        it('resolves null when the native module is absent', async () => {
            delete (NativeModules as any).InstallReferrer;

            await expect(getInstallAcquisition()).resolves.toBeNull();
        });

        it('resolves null when the native call rejects', async () => {
            (NativeModules as any).InstallReferrer.getInstallReferrer
                .mockRejectedValue(new Error('Play services unavailable'));

            await expect(getInstallAcquisition()).resolves.toBeNull();
        });

        it('resolves null when the module resolves null', async () => {
            (NativeModules as any).InstallReferrer.getInstallReferrer.mockResolvedValue(null);

            await expect(getInstallAcquisition()).resolves.toBeNull();
        });

        it('resolves null when storage throws', async () => {
            jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage full'));

            await expect(getInstallAcquisition()).resolves.toBeNull();
        });

        it('gives up when Play binds and never calls the listener back', async () => {
            // The failure this guards is not a rejection, it is silence.
            // InstallReferrerClient reports outcomes through a listener that is
            // not guaranteed to fire, and this promise is awaited on the
            // registration submit path with the button already disabled — so an
            // unbounded wait is a sign-up that can only be escaped by killing
            // the app.
            jest.useFakeTimers();

            try {
                (NativeModules as any).InstallReferrer.getInstallReferrer
                    .mockReturnValue(new Promise(() => undefined));

                const pending = getInstallAcquisition();

                await jest.advanceTimersByTimeAsync(5000);

                await expect(pending).resolves.toBeNull();
            } finally {
                jest.useRealTimers();
            }
        });

        it('does not cache "nothing there" after a read that timed out', async () => {
            // A slow device must get another attempt. Caching the timeout would
            // make one bad launch discard a paid install's attribution forever.
            jest.useFakeTimers();

            try {
                (NativeModules as any).InstallReferrer.getInstallReferrer
                    .mockReturnValueOnce(new Promise(() => undefined));

                const pending = getInstallAcquisition();
                await jest.advanceTimersByTimeAsync(5000);
                await pending;

                jest.useRealTimers();

                (NativeModules as any).InstallReferrer.getInstallReferrer
                    .mockResolvedValue({ referrer: ATTRIBUTED });

                await expect(getInstallAcquisition()).resolves.toMatchObject({
                    utmCampaign: 'fwh-app-us-installs-2026q3',
                });
            } finally {
                jest.useRealTimers();
            }
        });

        it('does not mark the referrer read before the value it vouches for is stored', async () => {
            // The flag is what makes this read happen once ever. Written first,
            // a process killed between the two writes leaves "already read,
            // nothing there" — attribution lost with no way back.
            const writes: string[] = [];
            jest.spyOn(AsyncStorage, 'setItem').mockImplementation((key: string) => {
                writes.push(key);
                return Promise.resolve();
            });

            try {
                await getInstallAcquisition();

                expect(writes).toEqual(['therrInstallReferrer', 'therrInstallReferrerRead']);
            } finally {
                (AsyncStorage.setItem as jest.Mock).mockRestore();
            }
        });
    });
});
