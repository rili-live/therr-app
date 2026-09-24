import { getApiErrorDetail, getApiErrorMessage, readApiError } from '../../main/utilities/apiErrorMessage';

describe('getApiErrorMessage', () => {
    describe('messages worth showing', () => {
        it('returns a 4xx body, which the service localizes deliberately', () => {
            expect(getApiErrorMessage({
                statusCode: 403,
                message: 'Only the person who created this pact can send a nudge',
            })).toBe('Only the person who created this pact can send a nudge');
        });

        it('returns a 409, the shape the renew CTA depends on', () => {
            expect(getApiErrorMessage({
                statusCode: 409,
                message: 'This pact has already been renewed.',
            })).toBe('This pact has already been renewed.');
        });

        it('trims surrounding whitespace', () => {
            expect(getApiErrorMessage({ statusCode: 400, message: '  Enter an amount.  ' }))
                .toBe('Enter an amount.');
        });
    });

    describe('messages that must never reach a user', () => {
        // The regression this exists for. On 2026-09-20 every Friends with Habits
        // check-in 500'd and the dashboard toast rendered the token verbatim under
        // "Oops! Something went wrong."
        it('withholds the internal route token on a 500', () => {
            expect(getApiErrorMessage({
                statusCode: 500,
                message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR',
            })).toBe('');
        });

        it('withholds any 5xx body, token or not', () => {
            expect(getApiErrorMessage({ statusCode: 503, message: 'upstream connect error' })).toBe('');
            expect(getApiErrorMessage({ statusCode: 502, message: 'Bad Gateway' })).toBe('');
        });

        it('withholds an internal token even on a 4xx', () => {
            expect(getApiErrorMessage({ statusCode: 400, message: 'SQL:PACTS_ROUTES:ERROR' })).toBe('');
        });

        it('withholds an unresolved dictionary path', () => {
            // `configureTranslator` returns the key itself on a miss, and seven such keys
            // were undefined in every locale until 7070c93d9 defined them.
            expect(getApiErrorMessage({
                statusCode: 400,
                message: 'errorMessages.habitGoals.nameRequired',
            })).toBe('');
        });

        it('keeps a sentence that merely ends in a period', () => {
            // The dictionary-path guard must not swallow ordinary prose.
            expect(getApiErrorMessage({ statusCode: 400, message: 'Enter a name.' }))
                .toBe('Enter a name.');
        });
    });

    describe('rejections that never reached the API', () => {
        it('returns empty when there is no statusCode', () => {
            expect(getApiErrorMessage({ message: 'Network Error' })).toBe('');
        });

        it('returns empty for a thrown Error with no response', () => {
            expect(getApiErrorMessage(new Error('timeout of 0ms exceeded'))).toBe('');
        });

        it('tolerates null, undefined and a non-string message', () => {
            expect(getApiErrorMessage(null)).toBe('');
            expect(getApiErrorMessage(undefined)).toBe('');
            expect(getApiErrorMessage({ statusCode: 400 })).toBe('');
            expect(getApiErrorMessage({ statusCode: 400, message: { nested: true } })).toBe('');
            expect(getApiErrorMessage({ statusCode: 400, message: '   ' })).toBe('');
        });
    });
});

describe('readApiError', () => {
    // The shape the response interceptor rejects with: the gateway's body, whose
    // `statusCode` echoes the HTTP status. `err.response` does not exist on it.
    it('reads the status from the rejected body', () => {
        const err = { statusCode: 403, error: 'solo-locked', requiredCount: 3 };

        expect(readApiError(err)).toEqual({ status: 403, body: err });
    });

    it('still accepts the raw axios error shape', () => {
        const data = { error: 'habit-limit-reached', limit: 5 };

        expect(readApiError({ response: { status: 402, data } })).toEqual({ status: 402, body: data });
    });

    it('reports no status for a request that never reached the API', () => {
        expect(readApiError(new Error('Network Error')).status).toBeUndefined();
        expect(readApiError(undefined).status).toBeUndefined();
    });
});

describe('getApiErrorDetail', () => {
    // `parameters` is set by the gateway's express-validator middleware alongside a 400
    // (therr-api-gateway/src/validation/index.ts) and names the fields that failed
    // validation, which is the difference between "Invalid input" and knowing which box
    // to go fix.
    it('appends the field names the API named', () => {
        expect(getApiErrorDetail({
            statusCode: 400,
            message: 'Invalid input',
            parameters: ['email', 'userName'],
        })).toBe('Invalid input (email, userName)');
    });

    it('returns the bare message when no parameters were sent', () => {
        expect(getApiErrorDetail({ statusCode: 400, message: 'Invalid input' }))
            .toBe('Invalid input');
    });

    it('withholds the parameters along with a message it would not show', () => {
        // Parameters under generic fallback copy would name fields the sentence above
        // them no longer refers to.
        expect(getApiErrorDetail({
            statusCode: 500,
            message: 'SQL:USER_ROUTES:ERROR',
            parameters: ['email'],
        })).toBe('');
    });

    it('ignores a parameters value that is not a populated array', () => {
        expect(getApiErrorDetail({ statusCode: 400, message: 'Invalid input', parameters: [] }))
            .toBe('Invalid input');
        expect(getApiErrorDetail({ statusCode: 400, message: 'Invalid input', parameters: 'email' }))
            .toBe('Invalid input');
        expect(getApiErrorDetail({ statusCode: 400, message: 'Invalid input', parameters: [null, 'email'] }))
            .toBe('Invalid input (email)');
    });

    it('is empty for a rejection that never reached the API', () => {
        expect(getApiErrorDetail(new Error('Network Error'))).toBe('');
        expect(getApiErrorDetail(null)).toBe('');
    });
});
