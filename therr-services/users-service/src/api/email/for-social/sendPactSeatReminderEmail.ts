import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendPactSeatReminderEmailConfig {
    charset?: string;
    locale?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    fromName: string;
    toName?: string;
    habitName: string;
    claimUrl: string;
    claimCode: string;
    daysLeft: number;
}

/**
 * A reminder to someone invited by email who has not installed the app yet
 * (handlers/helpers/onboardingNurtureDigest.ts, #3011). Same claim link and code as the original
 * invite (sendPactInvitationEmail), plus the one fact that is new: when their spot runs out.
 */
export default (emailParams: ISendPactSeatReminderEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const { claimUrl, claimCode, daysLeft } = templateParams;
    const hasCode = !!claimCode;

    const htmlConfig = {
        header: translate(locale, 'emails.pactSeatReminder.header', { fromName: templateParams.fromName }),
        dearUser: translate(locale, 'emails.pactSeatReminder.dearUser', { toName: templateParams.toName || '' }),
        body1: translate(locale, 'emails.pactSeatReminder.body1', {
            fromName: templateParams.fromName,
            habitName: templateParams.habitName,
            daysLeft,
        }),
        body2: translate(
            locale,
            hasCode ? 'emails.pactInvitation.body2' : 'emails.pactInvitation.body2TokenOnly',
            { brandName: contextConfig.brandName },
        ),
        bodyBold: hasCode ? claimCode : '',
        buttonHref: claimUrl,
        buttonText: translate(locale, 'emails.pactInvitation.buttonText', { brandName: contextConfig.brandName }),
        postBody1: translate(
            locale,
            hasCode ? 'emails.pactInvitation.postBody1' : 'emails.pactInvitation.postBody1TokenOnly',
            hasCode ? { linkUrl: claimUrl, claimCode } : { linkUrl: claimUrl },
        ),
        fromEmailTitle: `${templateParams.fromName}, ${contextConfig.brandName}`,
        headerImageVariant: 'social' as const,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
