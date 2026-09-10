import { IErrorArgs } from '../../utilities/handleHttpError';

/**
 * Translates a failed gateway -> users-service `/auth/phone` call into the arguments the
 * gateway should answer the client with.
 *
 * Lives in its own module (rather than inline in `router.ts`) so it can be unit tested without
 * loading the router's Twilio and Redis clients.
 */
export default (err: any): Omit<IErrorArgs, 'res'> => {
    const statusCode = err?.response?.data?.statusCode || err?.response?.status;

    if (statusCode === 403 || statusCode === 404) {
        // Deliberately collapsed into one answer: "blocked" and "that account isn't on this
        // number" must not be distinguishable from "no such account".
        return {
            message: 'No account found for this phone number',
            statusCode: 404,
        };
    }

    // Any other 4xx is a real, actionable answer from the users-service — most importantly the
    // 401 for an account whose email was never verified. Reporting it as a 500 would render on
    // the client as "something went wrong", which no amount of retrying would fix.
    if (statusCode >= 400 && statusCode < 500) {
        return {
            message: err?.response?.data?.message || 'Unable to sign in with this phone number',
            errorCode: err?.response?.data?.errorCode,
            statusCode,
        };
    }

    return { err, message: 'SQL:PHONE_ROUTES:ERROR' };
};
