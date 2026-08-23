import { ErrorCodes } from 'therr-js-utilities/constants';
import { describe, it, expect } from '@jest/globals';
import { getLoginErrorCopy, getRegistrationErrorCopy } from '../../main/utilities/authErrors';

// Echo the key back so each case can assert on which dictionary entry was chosen without
// depending on the copy itself, which changes far more often than the mapping does.
const translate = (key: string) => key;

describe('getLoginErrorCopy', () => {
    it('names a wrong password rather than falling through silently', () => {
        // The bug this suite exists for: a 401 from POST /users-service/auth reached the form
        // with no branch to catch it, so the sign-in button spun and then did nothing.
        const copy = getLoginErrorCopy({ statusCode: 401, message: 'Incorrect user/password combination' }, translate);

        expect(copy.title).toEqual('alertTitles.loginError');
        expect(copy.message).toEqual('forms.loginForm.invalidUsernamePassword');
    });

    it('gives an unverified account its own message instead of a credential error', () => {
        const copy = getLoginErrorCopy({ statusCode: 401, errorCode: ErrorCodes.NOT_VERIFIED }, translate);

        expect(copy.title).toEqual('alertTitles.accountNotVerified');
        expect(copy.message).toEqual('forms.loginForm.accountNotVerified');
    });

    it('does not reveal whether an account exists for an unknown identifier', () => {
        // A 404 has to be indistinguishable from a wrong password, or the form becomes an
        // oracle for which e-mails and phone numbers are registered.
        const notFound = getLoginErrorCopy({ statusCode: 404 }, translate);
        const wrongPassword = getLoginErrorCopy({ statusCode: 401 }, translate);

        expect(notFound).toEqual(wrongPassword);
    });

    it('calls out rate limiting', () => {
        const copy = getLoginErrorCopy({ statusCode: 429 }, translate);

        expect(copy.title).toEqual('alertTitles.tooManyAttempts');
        expect(copy.message).toEqual('alertMessages.tooManyAttempts');
    });

    it.each([
        ['a 5xx', { statusCode: 500 }],
        ['a bare Error with no statusCode', new Error('No refresh token available')],
        ['an undefined rejection', undefined],
        ['an empty object', {}],
    ])('still returns copy for %s', (_label, error) => {
        const copy = getLoginErrorCopy(error, translate);

        expect(copy.title).toEqual('alertTitles.backendErrorMessage');
        expect(copy.message).toEqual('forms.loginForm.backendErrorMessage');
    });
});

describe('getRegistrationErrorCopy', () => {
    it('translates a duplicate account instead of echoing the backend English', () => {
        const copy = getRegistrationErrorCopy({
            statusCode: 400,
            errorCode: ErrorCodes.USER_EXISTS,
            message: 'Username and e-mail must be unique. A user already exists.',
        }, translate);

        expect(copy.title).toEqual('alertTitles.registrationError');
        expect(copy.message).toEqual('forms.registerForm.errorMessages.accountExists');
    });

    it('names the phone-account cap for TOO_MANY_ACCOUNTS', () => {
        const copy = getRegistrationErrorCopy({ statusCode: 400, errorCode: ErrorCodes.TOO_MANY_ACCOUNTS }, translate);

        expect(copy.message).toEqual('forms.phoneSignupForm.errorMessages.accountTypeTaken');
    });

    it('passes a validation message through without the old parameter suffix', () => {
        const copy = getRegistrationErrorCopy({
            statusCode: 400,
            message: 'Birthdate is required',
            parameters: ['settingsBirthdate'],
        }, translate);

        expect(copy.message).toEqual('Birthdate is required');
    });

    it('falls back to the generic message for a 400 carrying no message', () => {
        const copy = getRegistrationErrorCopy({ statusCode: 400 }, translate);

        expect(copy.message).toEqual('forms.registerForm.backendErrorMessage');
    });

    it.each([
        ['a 5xx', { statusCode: 503 }],
        ['a bare Error', new Error('Network request failed')],
        ['an undefined rejection', undefined],
    ])('still returns copy for %s', (_label, error) => {
        const copy = getRegistrationErrorCopy(error, translate);

        expect(copy.title).toEqual('alertTitles.registrationError');
        expect(copy.message).toEqual('forms.registerForm.backendErrorMessage');
    });
});
