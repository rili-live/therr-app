import normalizeEmail from 'normalize-email';

export interface IInviteeIdentity {
    email?: string | null;
    phoneNumber?: string | null;
}

const normalize = (email?: string | null) => (email ? normalizeEmail(email).toLowerCase() : '');

// Phone-number formats vary wildly between intake paths (Twilio E.164, raw
// device contact strings, hand-entered with dashes/parens). Stripping to
// digits and dropping a leading country-1 makes the equality check robust to
// formatting drift without pulling in a full parser.
const normalizePhone = (phone?: string | null) => {
    if (!phone) return '';
    const digits = String(phone).replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
    return digits;
};

/**
 * A PACT-XXXX code in the wrong hands would otherwise let any registrant
 * claim the original invitee's slot in a pact. Redemption is gated on the
 * registrant matching the email or phoneNumber the invite was actually sent
 * to. We accept either signal because some users register with email and
 * later add a phone (or vice versa) and we do not want to lock out a
 * legitimate match.
 *
 * Pure function so the security check is unit-testable without DB stubs.
 */
export const isMatchingInvitee = (
    newUser: IInviteeIdentity,
    originalInvitee: IInviteeIdentity,
): boolean => {
    const newEmail = normalize(newUser.email);
    const inviteeEmail = normalize(originalInvitee.email);
    if (newEmail && inviteeEmail && newEmail === inviteeEmail) {
        return true;
    }

    const newPhone = normalizePhone(newUser.phoneNumber);
    const inviteePhone = normalizePhone(originalInvitee.phoneNumber);
    if (newPhone && inviteePhone && newPhone === inviteePhone) {
        return true;
    }

    return false;
};

export default isMatchingInvitee;
