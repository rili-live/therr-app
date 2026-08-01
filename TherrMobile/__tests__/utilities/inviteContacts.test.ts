import { Platform } from 'react-native';
import {
    buildMailToUrl,
    buildSmsUrl,
    getContactDisplayName,
    getContactEmail,
    getContactInviteTargetLabel,
    getContactPhoneNumber,
    isContactInvitable,
    sanitizePhoneNumber,
} from '../../main/utilities/inviteContacts';

const originalOS = Platform.OS;

const setPlatform = (os: 'ios' | 'android') => {
    (Platform as any).OS = os;
};

afterEach(() => {
    setPlatform(originalOS as 'ios' | 'android');
});

describe('sanitizePhoneNumber', () => {
    it('strips display formatting that would break an sms: URI', () => {
        expect(sanitizePhoneNumber('(555) 123-4567')).toBe('5551234567');
        expect(sanitizePhoneNumber(' 555.123.4567 ')).toBe('5551234567');
    });

    it('preserves a leading country-code plus', () => {
        expect(sanitizePhoneNumber('+1 (555) 123-4567')).toBe('+15551234567');
    });

    it('returns an empty string for unusable values', () => {
        expect(sanitizePhoneNumber(undefined)).toBe('');
        expect(sanitizePhoneNumber('')).toBe('');
        expect(sanitizePhoneNumber('not a number')).toBe('');
    });
});

describe('getContactPhoneNumber', () => {
    it('prefers a mobile-labelled number', () => {
        expect(getContactPhoneNumber({
            phoneNumbers: [
                { label: 'home', number: '555-111-1111' },
                { label: 'mobile', number: '555-222-2222' },
            ],
        })).toBe('5552222222');
    });

    it('treats iPhone and cell labels as mobile', () => {
        expect(getContactPhoneNumber({
            phoneNumbers: [
                { label: 'work', number: '555-111-1111' },
                { label: 'iPhone', number: '555-333-3333' },
            ],
        })).toBe('5553333333');
    });

    // The original bug: only `label === 'mobile'` was accepted, so a contact whose
    // number was saved as "home" produced an Invite button that did nothing.
    it('falls back to the first usable number when no label looks mobile', () => {
        expect(getContactPhoneNumber({
            phoneNumbers: [{ label: 'home', number: '(555) 444-4444' }],
        })).toBe('5554444444');
    });

    it('returns an empty string when there are no numbers', () => {
        expect(getContactPhoneNumber({ phoneNumbers: [] })).toBe('');
        expect(getContactPhoneNumber({})).toBe('');
        expect(getContactPhoneNumber(undefined)).toBe('');
    });
});

describe('getContactEmail', () => {
    it('deprioritizes work addresses', () => {
        expect(getContactEmail({
            emailAddresses: [
                { label: 'work', email: 'grant@work.com' },
                { label: 'home', email: 'grant@home.com' },
            ],
        })).toBe('grant@home.com');
    });

    it('still uses a work address when it is the only one', () => {
        expect(getContactEmail({
            emailAddresses: [{ label: 'work', email: 'grant@work.com' }],
        })).toBe('grant@work.com');
    });
});

describe('getContactDisplayName', () => {
    it('joins given and family names', () => {
        expect(getContactDisplayName({ givenName: 'Grant', familyName: 'S' })).toBe('Grant S');
    });

    it('does not leave a dangling space when only one name is present', () => {
        expect(getContactDisplayName({ givenName: 'Grant', familyName: '' })).toBe('Grant');
    });

    it('falls back through displayName, company, then contact info', () => {
        expect(getContactDisplayName({ displayName: 'Grant S' })).toBe('Grant S');
        expect(getContactDisplayName({ company: 'Therr' })).toBe('Therr');
        expect(getContactDisplayName({ emailAddresses: [{ email: 'grant@home.com' }] })).toBe('grant@home.com');
    });
});

describe('isContactInvitable', () => {
    it('requires at least one phone number or email', () => {
        expect(isContactInvitable({ phoneNumbers: [{ label: 'home', number: '5551234567' }] })).toBe(true);
        expect(isContactInvitable({ emailAddresses: [{ email: 'grant@home.com' }] })).toBe(true);
        expect(isContactInvitable({ givenName: 'Grant', phoneNumbers: [], emailAddresses: [] })).toBe(false);
    });
});

describe('getContactInviteTargetLabel', () => {
    it('shows the phone number the invite will be sent to', () => {
        expect(getContactInviteTargetLabel({
            phoneNumbers: [{ label: 'home', number: '(555) 123-4567' }],
            emailAddresses: [{ email: 'grant@home.com' }],
        })).toBe('5551234567');
    });

    it('falls back to the email when there is no number', () => {
        expect(getContactInviteTargetLabel({
            emailAddresses: [{ email: 'grant@home.com' }],
        })).toBe('grant@home.com');
    });
});

describe('buildSmsUrl', () => {
    // Android reads the body out of the query string. The previous `&body=` form made
    // the whole string one invalid recipient, which is why Messages opened blank.
    it('uses a query-string body and semicolon separators on Android', () => {
        setPlatform('android');

        expect(buildSmsUrl(['(555) 123-4567'], 'Join me')).toBe('sms:5551234567?body=Join%20me');
        expect(buildSmsUrl(['555-123-4567', '555-765-4321'], 'Join me'))
            .toBe('sms:5551234567;5557654321?body=Join%20me');
    });

    it('uses an ampersand body and comma separators on iOS', () => {
        setPlatform('ios');

        expect(buildSmsUrl(['(555) 123-4567'], 'Join me')).toBe('sms:5551234567&body=Join%20me');
        expect(buildSmsUrl(['555-123-4567', '555-765-4321'], 'Join me'))
            .toBe('sms:5551234567,5557654321&body=Join%20me');
    });

    it('drops unusable numbers and dedupes recipients', () => {
        setPlatform('android');

        expect(buildSmsUrl([undefined, '', '(555) 123-4567', '555-123-4567'], 'Join me'))
            .toBe('sms:5551234567?body=Join%20me');
    });

    it('returns null when no recipient is usable', () => {
        expect(buildSmsUrl([], 'Join me')).toBeNull();
        expect(buildSmsUrl([undefined, ''], 'Join me')).toBeNull();
    });

    it('encodes an invite link so query params survive', () => {
        setPlatform('android');

        const url = buildSmsUrl(['5551234567'], 'Join me https://www.therr.com/invite/grant?a=b');

        expect(url).toBe('sms:5551234567?body=Join%20me%20https%3A%2F%2Fwww.therr.com%2Finvite%2Fgrant%3Fa%3Db');
    });
});

describe('buildMailToUrl', () => {
    it('encodes the subject and body', () => {
        expect(buildMailToUrl('grant@home.com', 'Join me!', 'Sign up: https://www.therr.com'))
            .toBe('mailto:grant%40home.com?subject=Join%20me!&body=Sign%20up%3A%20https%3A%2F%2Fwww.therr.com');
    });

    it('returns null without an address', () => {
        expect(buildMailToUrl('', 'Join me!', 'body')).toBeNull();
    });
});
