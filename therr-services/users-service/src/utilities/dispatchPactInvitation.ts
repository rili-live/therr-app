import { randomBytes, randomUUID } from 'crypto';
import { BrandVariations } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import sendPactInvitationEmail from '../api/email/for-social/sendPactInvitationEmail';
import twilioClient from '../api/twilio';
import translate from './translator';
import { getHostContext } from '../constants/hostContext';

// Unambiguous base32 alphabet (no 0/O, 1/I) so users can read the code off
// an email without misreading characters.
const CLAIM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CLAIM_CODE_LENGTH = 4;
const CLAIM_TOKEN_TTL_DAYS = 14;
// 32^4 ≈ 1M live codes worst-case; with a 14-day TTL collisions on the
// partial unique index will eventually fire. Retry a handful of times before
// giving up — caller falls back to the long token-only deep link.
const CLAIM_CODE_MAX_ATTEMPTS = 5;
const PG_UNIQUE_VIOLATION = '23505';
const SMS_SENDER_DEFAULT = process.env.TWILIO_SENDER_PHONE_NUMBER;
const SMS_SENDER_GB = process.env.TWILIO_SENDER_PHONE_NUMBER_GB;

export const generateClaimCode = (): string => {
    const bytes = randomBytes(CLAIM_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CLAIM_CODE_LENGTH; i += 1) {
        code += CLAIM_CODE_ALPHABET[bytes[i] % CLAIM_CODE_ALPHABET.length];
    }
    return `PACT-${code}`;
};

export const getSmsSender = (toPhoneNumber: string): string | undefined => {
    if (toPhoneNumber.startsWith('+44')) return SMS_SENDER_GB;
    return SMS_SENDER_DEFAULT;
};

export const isOnHabits = (brandVariationsJson: any): boolean => {
    if (!Array.isArray(brandVariationsJson)) return false;
    return brandVariationsJson.some((entry) => entry
        && entry.brand === BrandVariations.HABITS
        && entry.isActive !== false);
};

export interface IDispatchPactInvitationArgs {
    pactMemberId: string;
    partnerUserId: string;
    fromUserName: string;
    habitName: string;
    brandVariation: string;
    whiteLabelOrigin: string;
    locale: string;
}

export interface IDispatchPactInvitationResult {
    isOnBrand: boolean;
    claimToken?: string;
    claimCode?: string;
    invitedVia?: 'email' | 'sms' | 'push';
}

/**
 * Routes a pact invitation to the right channel for the recipient.
 *
 * If the partner has actively used the Habits app (brandVariations contains
 * an active 'habits' entry) the caller should fall through to the existing
 * brand-scoped push notification — this helper returns isOnBrand=true and
 * does not touch the pact_members row.
 *
 * Otherwise the partner is a Therr-only connection: we mint a claim
 * token + short code on the pact_members row and send install + claim
 * instructions via email (and SMS when a phone is on file). The brand-scoped
 * push is intentionally skipped to avoid misrouting via the Therr Firebase
 * project when the user has no Habits-scoped device token.
 */
export const dispatchPactInvitation = async (
    args: IDispatchPactInvitationArgs,
): Promise<IDispatchPactInvitationResult> => {
    const partnerRows = await Store.users.findUser(
        { id: args.partnerUserId },
        ['id', 'email', 'phoneNumber', 'firstName', 'isUnclaimed', 'settingsEmailInvites', 'settingsLocale', 'brandVariations'],
    );
    const partner: any = partnerRows?.[0];
    if (!partner) {
        return { isOnBrand: false };
    }

    if (isOnHabits(partner.brandVariations)) {
        return { isOnBrand: true };
    }

    const claimToken = randomUUID();
    const claimTokenExpiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const hasEmail = !!partner.email && !partner.isUnclaimed;
    const hasPhone = !!partner.phoneNumber;
    if (!hasEmail && !hasPhone) {
        return { isOnBrand: false };
    }

    const invitedVia: 'email' | 'sms' = hasEmail ? 'email' : 'sms';

    let claimCode = generateClaimCode();
    let attempt = 0;
    let persisted = false;
    while (!persisted && attempt < CLAIM_CODE_MAX_ATTEMPTS) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await Store.pactMembers.update(args.pactMemberId, {
                claimToken,
                claimCode,
                claimTokenExpiresAt,
                invitedVia,
            });
            persisted = true;
        } catch (err: any) {
            if (err?.code !== PG_UNIQUE_VIOLATION) {
                throw err;
            }
            attempt += 1;
            claimCode = generateClaimCode();
        }
    }
    if (!persisted) {
        // Token-only fallback: write the row without a code so the deep-link
        // path still works, even if the human-readable code path is unavailable
        // for this invite.
        await Store.pactMembers.update(args.pactMemberId, {
            claimToken,
            claimCode: null,
            claimTokenExpiresAt,
            invitedVia,
        });
        claimCode = '';
    }

    const partnerLocale = partner.settingsLocale || args.locale || 'en-us';
    const contextConfig = getHostContext(args.whiteLabelOrigin, args.brandVariation);

    if (hasEmail) {
        sendPactInvitationEmail({
            subject: translate(partnerLocale, 'emails.pactInvitation.header', { fromName: args.fromUserName }),
            locale: partnerLocale,
            toAddresses: [partner.email],
            agencyDomainName: args.whiteLabelOrigin,
            brandVariation: args.brandVariation,
        }, {
            fromName: args.fromUserName,
            toName: partner.firstName || '',
            habitName: args.habitName,
            claimToken,
            claimCode,
        }).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to send pact invitation email'],
                traceArgs: {
                    'error.message': err?.message,
                    pactMemberId: args.pactMemberId,
                },
            });
        });
    }

    if (hasPhone) {
        const sender = getSmsSender(partner.phoneNumber);
        if (sender) {
            const baseHost = contextConfig.emailTemplates.appHostFull
                || contextConfig.parentHomepageUrl;
            const claimUrl = `${baseHost}/claim-pact/${claimToken}`;
            const smsBody = translate(partnerLocale, 'invites.pact.sms', {
                fromName: args.fromUserName,
                habitName: args.habitName,
                brandName: contextConfig.brandName,
                claimUrl,
                claimCode,
            });
            twilioClient.messages.create({
                body: smsBody,
                to: partner.phoneNumber,
                from: sender,
            }).catch((err: any) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Failed to send pact invitation SMS'],
                    traceArgs: {
                        'error.message': err?.message,
                        pactMemberId: args.pactMemberId,
                    },
                });
            });
        }
    }

    return {
        isOnBrand: false,
        claimToken,
        claimCode,
        invitedVia,
    };
};

export default dispatchPactInvitation;
