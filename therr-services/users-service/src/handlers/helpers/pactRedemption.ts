import normalizeEmail from 'normalize-email';
import Store from '../../store';

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

/**
 * Decides whether a registration that carries a PACT-XXXX claim code proves
 * ownership of the contact channel the invite was sent to. Possession of the
 * claim secret (delivered by email/SMS) plus a matching address is the same
 * ownership proof a verification link provides, so a positive result lets
 * registration skip the email-verification wall entirely.
 *
 * Brute-force is impractical by construction: a wrong guess still creates the
 * (unverified) account, and the duplicate-email check then blocks any retry
 * for the same address — one code guess per email, against a ~1M keyspace
 * with a 14-day TTL.
 *
 * Fails closed (false) on any lookup error — worst case the user verifies by
 * email like before.
 */
export const isClaimCodePreVerified = async (
    pactClaimCode: string | null,
    registrant: IInviteeIdentity,
): Promise<boolean> => {
    if (!pactClaimCode) {
        return false;
    }
    try {
        const member = await Store.pactMembers.findByClaim({ code: pactClaimCode });
        const memberIsRedeemable = !!member
            && member.status === 'pending'
            && (!member.claimTokenExpiresAt
                || new Date(member.claimTokenExpiresAt).getTime() >= Date.now());
        if (!memberIsRedeemable) {
            return false;
        }

        const originalInviteeRows = await Store.users.findUser(
            { id: member.userId },
            ['email', 'phoneNumber'],
        );
        const originalInvitee = originalInviteeRows?.[0];
        return !!originalInvitee && isMatchingInvitee(registrant, {
            email: originalInvitee.email,
            phoneNumber: originalInvitee.phoneNumber,
        });
    } catch (err) {
        return false;
    }
};

export default isMatchingInvitee;
