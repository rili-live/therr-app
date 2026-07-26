import { describe, it, expect } from '@jest/globals';
import {
    getIdentifierType,
    isLikelyPhoneNumber,
    maskEmail,
    maskIdentifier,
    maskPhoneNumber,
    toDialableNumber,
} from '../../main/utilities/authIdentifier';

describe('isLikelyPhoneNumber', () => {
    it('accepts the formats people actually type', () => {
        expect(isLikelyPhoneNumber('+13175551234')).toEqual(true);
        expect(isLikelyPhoneNumber('317-555-1234')).toEqual(true);
        expect(isLikelyPhoneNumber('(317) 555 1234')).toEqual(true);
        expect(isLikelyPhoneNumber('+44 20 7946 0958')).toEqual(true);
    });

    it('rejects emails and usernames', () => {
        expect(isLikelyPhoneNumber('jane@example.com')).toEqual(false);
        expect(isLikelyPhoneNumber('jane_doe')).toEqual(false);
        // An email whose local part is all digits must not be mistaken for a number.
        expect(isLikelyPhoneNumber('3175551234@example.com')).toEqual(false);
    });

    it('rejects digit strings outside the E.164 length range', () => {
        // A short numeric username, not a phone number.
        expect(isLikelyPhoneNumber('1234')).toEqual(false);
        expect(isLikelyPhoneNumber('12345678901234567890')).toEqual(false);
    });

    it('rejects empty and whitespace-only input', () => {
        expect(isLikelyPhoneNumber('')).toEqual(false);
        expect(isLikelyPhoneNumber('   ')).toEqual(false);
        expect(isLikelyPhoneNumber(undefined)).toEqual(false);
    });
});

describe('toDialableNumber', () => {
    it('strips display formatting but keeps an explicit country code', () => {
        expect(toDialableNumber('+1 (317) 555-1234')).toEqual('+13175551234');
        expect(toDialableNumber('317-555-1234')).toEqual('3175551234');
    });
});

describe('getIdentifierType', () => {
    it('classifies each identifier kind', () => {
        expect(getIdentifierType('jane@example.com')).toEqual('email');
        expect(getIdentifierType('+13175551234')).toEqual('phone');
        expect(getIdentifierType('jane_doe')).toEqual('userName');
    });
});

describe('masking', () => {
    it('keeps enough of an email to recognize your own account', () => {
        expect(maskEmail('jane.doe@example.com')).toEqual('ja•••@example.com');
    });

    it('returns the input unchanged when it is not an email', () => {
        expect(maskEmail('not-an-email')).toEqual('not-an-email');
    });

    it('shows only the last four digits of a phone number', () => {
        expect(maskPhoneNumber('+13175551234')).toEqual('•••• 1234');
    });

    it('dispatches on identifier type', () => {
        expect(maskIdentifier('jane@example.com')).toEqual('ja•••@example.com');
        expect(maskIdentifier('+13175551234')).toEqual('•••• 1234');
        expect(maskIdentifier('jane_doe')).toEqual('jane_doe');
    });
});
