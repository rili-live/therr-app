import AccessLevels from '../constants/enums/AccessLevels';

/**
 * Whether the requesting user is a store-review / QA account (AccessLevels.TEST_ACCOUNT).
 *
 * Accepts either the forwarded request headers (the gateway decodes the JWT and forwards
 * its access levels as the JSON string `x-user-access-levels`) or an access-levels array
 * already read off a `main.users` row. Anything unparseable reads as "not a test account":
 * the caller uses this to *hide* content, so a malformed header must fail toward the
 * ordinary behavior rather than throwing inside a create handler.
 */
const isTestAccount = (headersOrAccessLevels?: { [key: string]: any } | string[] | null): boolean => {
    if (!headersOrAccessLevels) {
        return false;
    }

    let accessLevels: unknown = headersOrAccessLevels;

    if (!Array.isArray(headersOrAccessLevels)) {
        const raw = headersOrAccessLevels['x-user-access-levels'];
        if (Array.isArray(raw)) {
            accessLevels = raw;
        } else {
            try {
                accessLevels = JSON.parse(raw || '[]');
            } catch (e) {
                return false;
            }
        }
    }

    return Array.isArray(accessLevels) && accessLevels.includes(AccessLevels.TEST_ACCOUNT);
};

export default isTestAccount;
