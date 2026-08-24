import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest } from '@jest/globals';

// `MainButtonMenu` pulls in `main/constants`, which reaches for notifee's native
// module at import time.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: { createChannel: jest.fn(), createChannels: jest.fn() },
    AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
    AndroidVisibility: { PUBLIC: 1 },
}));

jest.mock('../../main/components/ButtonMenu/MainButtonMenu', () => () => null);

// Echo the locale back so the assertion is about which dictionary is selected,
// not about the copy in it.
jest.mock('../../main/utilities/translator', () => ({
    __esModule: true,
    default: (locale: string, key: string) => `${locale}|${key}`,
}));

import { ApiAccessComponent } from '../../main/routes/ApiAccess';

const buildProps = (locale?: string): any => ({
    navigation: { setOptions: jest.fn() },
    user: {
        settings: { locale, mobileThemeName: 'light' },
        details: { accessLevels: [] },
    },
});

/**
 * The screen used to call `translator('en-us', ...)` with the locale hardcoded, so the
 * es and fr-ca entries added to the mobile dictionaries alongside it were unreachable —
 * a Spanish or French user saw the English copy with no other symptom.
 */
describe('ApiAccess translations', () => {
    it.each(['es', 'fr-ca'])('renders in the user\'s selected locale (%s), not always en-us', (locale) => {
        const instance: any = new ApiAccessComponent(buildProps(locale));

        expect(instance.translate('pages.apiAccess.pageTitle')).toBe(`${locale}|pages.apiAccess.pageTitle`);
    });

    it('falls back to en-us when the user has no locale set', () => {
        const instance: any = new ApiAccessComponent(buildProps(undefined));

        expect(instance.translate('pages.apiAccess.pageTitle')).toBe('en-us|pages.apiAccess.pageTitle');
    });
});
