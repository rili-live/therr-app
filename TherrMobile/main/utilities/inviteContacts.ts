import { Platform } from 'react-native';

/**
 * Loosely typed to stay assignable from `react-native-contacts`' own `Contact`, whose
 * string fields are nullable and vary by platform.
 */
type OptionalString = string | null;

export interface IContactPhoneNumber {
    label?: OptionalString;
    number?: OptionalString;
}

export interface IContactEmailAddress {
    label?: OptionalString;
    email?: OptionalString;
}

export interface IPhoneContact {
    recordID?: OptionalString;
    givenName?: OptionalString;
    familyName?: OptionalString;
    displayName?: OptionalString;
    company?: OptionalString;
    phoneNumbers?: IContactPhoneNumber[];
    emailAddresses?: IContactEmailAddress[];
}

/**
 * Labels that mark a number as reachable by SMS. react-native-contacts derives these
 * from the platform address book, so the spelling varies by OS and by how the user
 * saved the contact ('mobile' on Android, 'iPhone'/'main' are common on iOS).
 * Anything not in this list is still usable as a fallback — a contact whose only
 * number is labelled 'home' is far more likely to be a cell phone than a dead end.
 */
const PREFERRED_PHONE_LABELS = ['mobile', 'cell', 'iphone', 'main'];

/**
 * Strips a phone number down to what is legal inside an `sms:` URI. Address books
 * hand back display-formatted numbers ('(555) 123-4567'), and the spaces and parens
 * make the URI unparseable — the OS messaging app then opens with an empty recipient.
 */
export const sanitizePhoneNumber = (value?: string | null): string => {
    if (!value) {
        return '';
    }

    const trimmed = String(value).trim();
    const digits = trimmed.replace(/\D/g, '');

    if (!digits) {
        return '';
    }

    return trimmed.startsWith('+') ? `+${digits}` : digits;
};

/**
 * Returns the best SMS-able number for a contact, or '' when there is none.
 * Prefers a mobile-ish label but falls back to the first usable number.
 */
export const getContactPhoneNumber = (contact?: IPhoneContact | null): string => {
    const phoneNumbers = contact?.phoneNumbers || [];
    const preferred = phoneNumbers.filter(
        (phone) => PREFERRED_PHONE_LABELS.includes((phone?.label || '').toLowerCase()),
    );

    return [...preferred, ...phoneNumbers]
        .map((phone) => sanitizePhoneNumber(phone?.number))
        .find(Boolean) || '';
};

/**
 * Returns the best email for a contact, or '' when there is none.
 * Work addresses are deprioritized since invites are personal.
 */
export const getContactEmail = (contact?: IPhoneContact | null): string => {
    const emailAddresses = contact?.emailAddresses || [];
    const personal = emailAddresses.filter((address) => (address?.label || '').toLowerCase() !== 'work');

    return [...personal, ...emailAddresses]
        .map((address) => (address?.email || '').trim())
        .find(Boolean) || '';
};

export const getContactDisplayName = (contact?: IPhoneContact | null): string => {
    const fullName = [contact?.givenName, contact?.familyName]
        .map((part) => (part || '').trim())
        .filter(Boolean)
        .join(' ');

    return fullName
        || (contact?.displayName || '').trim()
        || (contact?.company || '').trim()
        || getContactEmail(contact)
        || getContactPhoneNumber(contact);
};

/** The contact detail the invite will actually be delivered to, for display under the name. */
export const getContactInviteTargetLabel = (contact?: IPhoneContact | null): string =>
    getContactPhoneNumber(contact) || getContactEmail(contact);

/** A contact with neither a phone number nor an email cannot be invited at all. */
export const isContactInvitable = (contact?: IPhoneContact | null): boolean =>
    !!(getContactPhoneNumber(contact) || getContactEmail(contact));

/**
 * Builds an `sms:` URI that both platforms actually parse.
 *
 * Android reads the message body out of the URI *query string* (`?body=`) and
 * separates multiple recipients with ';'. iOS expects the body appended with '&'
 * and comma-separated recipients. Using the iOS form on Android makes the whole
 * string get treated as one (invalid) recipient, which is why the messaging app
 * opened with no recipient and no prefilled text.
 */
export const buildSmsUrl = (phoneNumbers: (string | undefined)[], body: string): string | null => {
    const recipients = Array.from(new Set(
        phoneNumbers.map(sanitizePhoneNumber).filter(Boolean),
    ));

    if (!recipients.length) {
        return null;
    }

    const encodedBody = encodeURIComponent(body);

    return Platform.OS === 'ios'
        ? `sms:${recipients.join(',')}&body=${encodedBody}`
        : `sms:${recipients.join(';')}?body=${encodedBody}`;
};

export const buildMailToUrl = (email: string, subject: string, body: string): string | null => {
    const trimmed = (email || '').trim();

    if (!trimmed) {
        return null;
    }

    return `mailto:${encodeURIComponent(trimmed)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
