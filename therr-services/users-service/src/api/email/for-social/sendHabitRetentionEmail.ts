import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';
import { RetentionMessageVariant } from '../../../utilities/retentionLadder';

export interface ISendHabitRetentionEmailConfig {
    charset?: string;
    locale?: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    toName?: string;
    habitName: string;
    /** Set only when the habit is shared with an active partner. Selects the partner-naming body. */
    partnerName?: string;
}

/** The locale block each variant reads, under `emails.habitRetention`. */
const VARIANT_KEYS: Record<RetentionMessageVariant, string> = {
    'first-checkin': 'firstCheckin',
    'day-two': 'dayTwo',
    comeback: 'comeback',
    'comeback-no-bonus': 'comebackNoBonus',
    'fresh-start': 'freshStart',
};

/**
 * The email half of the retention messages (handlers/helpers/retentionMessaging.ts), for a user
 * the digest cannot reach by push — most Habits accounts have no live Habits device token (about 63
 * real devices once dead tokens are cleared). Same
 * moment and same copy as the push, a little longer: one habit, one partner if they have one, one
 * button. Never the streak they lost (docs/HABIT_LIFECYCLE_MESSAGING.md § abstinence violation).
 */
export default (
    variant: RetentionMessageVariant,
    emailParams: ISendHabitRetentionEmailConfig,
    templateParams: ITemplateParams,
) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const appUrl = contextConfig.emailTemplates.appHostFull || contextConfig.parentHomepageUrl;
    const base = `emails.habitRetention.${VARIANT_KEYS[variant]}`;
    const params = {
        habitName: templateParams.habitName,
        partnerName: templateParams.partnerName || '',
        toName: templateParams.toName || '',
        brandName: contextConfig.brandName,
    };

    const htmlConfig = {
        header: translate(locale, `${base}.header`, params),
        dearUser: translate(locale, 'emails.habitRetention.dearUser', params),
        body1: translate(locale, templateParams.partnerName ? `${base}.body1WithPartner` : `${base}.body1`, params),
        body2: translate(locale, `${base}.body2`, params),
        buttonHref: appUrl,
        buttonText: translate(locale, 'emails.habitRetention.buttonText', params),
        postBody1: translate(locale, 'emails.habitRetention.postBody1', params),
        fromEmailTitle: contextConfig.brandName,
        headerImageVariant: 'social' as const,
    };

    return sendEmail({
        ...emailParams,
        subject: translate(locale, `${base}.subject`, params),
    }, htmlConfig);
};
