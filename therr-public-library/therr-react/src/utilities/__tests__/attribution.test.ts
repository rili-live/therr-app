import {
    ATTRIBUTION_STORAGE_KEY,
    captureAttribution,
    getStoredAttribution,
    hasAttribution,
    readAttributionFromUrl,
} from '../attribution';

const OUTREACH_QUERY = '?utm_source=outreach&utm_medium=email'
    + '&utm_campaign=3_22_2026_gen_z_local_creators&utm_content=mentioned-site&utm_term=initial';

describe('readAttributionFromUrl', () => {
    it('reads all five utm parameters', () => {
        const result = readAttributionFromUrl(OUTREACH_QUERY, '/spaces/abc', '', 'web');

        expect(result).toMatchObject({
            utmSource: 'outreach',
            utmMedium: 'email',
            utmCampaign: '3_22_2026_gen_z_local_creators',
            utmContent: 'mentioned-site',
            utmTerm: 'initial',
            landingPath: '/spaces/abc',
            surface: 'web',
        });
    });

    it('keeps an external referrer', () => {
        const result = readAttributionFromUrl('', '/', 'https://www.google.com/', 'web');

        expect(result.referrer).toBe('https://www.google.com/');
    });

    it('drops a referrer from one of our own properties', () => {
        // therr.app -> therr.com is an internal funnel hop, not an acquisition
        // source. Recording it would overwrite "arrived from Google" for every
        // visitor who crossed properties before registering.
        ['https://www.therr.app/blog/x.html', 'https://dashboard.therr.com/', 'https://therr.com/']
            .forEach((referrer) => {
                expect(readAttributionFromUrl('', '/', referrer, 'web').referrer).toBe(undefined);
            });
    });

    it('is not fooled by a lookalike domain', () => {
        const result = readAttributionFromUrl('', '/', 'https://nottherr.app/', 'web');

        expect(result.referrer).toBe('https://nottherr.app/');
    });

    it('truncates oversized values', () => {
        const result = readAttributionFromUrl(
            `?utm_campaign=${'c'.repeat(500)}`,
            `/${'p'.repeat(1000)}`,
            `https://example.com/${'r'.repeat(2000)}`,
            'web',
        );

        expect(result.utmCampaign).toHaveLength(255);
        expect(result.referrer).toHaveLength(1024);
        expect(result.landingPath).toHaveLength(512);
    });
});

describe('hasAttribution', () => {
    it('does not count surface and landingPath as a source', () => {
        expect(hasAttribution({ surface: 'web', landingPath: '/' })).toBe(false);
    });

    it('counts a campaign tag or an external referrer', () => {
        expect(hasAttribution({ utmCampaign: 'spring' })).toBe(true);
        expect(hasAttribution({ referrer: 'https://www.google.com/' })).toBe(true);
    });

    it('handles null and undefined', () => {
        expect(hasAttribution(null)).toBe(false);
        expect(hasAttribution(undefined)).toBe(false);
    });
});

describe('captureAttribution', () => {
    const setUrl = (search: string, pathname = '/') => {
        window.history.replaceState({}, '', `${pathname}${search}`);
    };

    beforeEach(() => {
        window.sessionStorage.clear();
        setUrl('');
    });

    it('stores the campaign found on the landing URL', () => {
        setUrl(OUTREACH_QUERY, '/spaces/abc');

        const result = captureAttribution('web');

        expect(result?.utmCampaign).toBe('3_22_2026_gen_z_local_creators');
        expect(getStoredAttribution()?.utmSource).toBe('outreach');
    });

    it('keeps the first touch when a later call carries a different campaign', () => {
        // A blog CTA clicked three pages into a session is navigation, not a
        // second acquisition — overwriting here would credit the wrong campaign.
        setUrl(OUTREACH_QUERY);
        captureAttribution('web');

        setUrl('?utm_source=blog&utm_medium=content&utm_campaign=some_other_post');
        const result = captureAttribution('web');

        expect(result?.utmCampaign).toBe('3_22_2026_gen_z_local_creators');
    });

    it('keeps a direct first touch rather than letting an internal tag replace it', () => {
        captureAttribution('web');
        setUrl('?utm_source=blog&utm_campaign=late_arrival');

        expect(captureAttribution('web')?.utmSource).toBe(undefined);
    });

    it('records the surface even for a direct arrival', () => {
        expect(captureAttribution('dashboard')?.surface).toBe('dashboard');
    });

    it('survives unreadable session storage', () => {
        const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });
        const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });
        setUrl(OUTREACH_QUERY);

        // Attribution is telemetry; it must never break the page it sits on.
        expect(() => captureAttribution('web')).not.toThrow();
        expect(captureAttribution('web')?.utmSource).toBe('outreach');

        getItem.mockRestore();
        setItem.mockRestore();
    });

    it('tolerates a corrupted stored value', () => {
        window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, 'not-json');
        setUrl(OUTREACH_QUERY);

        expect(captureAttribution('web')?.utmSource).toBe('outreach');
    });
});
