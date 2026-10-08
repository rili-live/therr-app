import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendFirstHabitNudgeEmailConfig {
    charset?: string;
    locale?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    toName?: string;
}

/**
 * The email half of the onboarding no-habit nudge (handlers/helpers/onboardingNurtureDigest.ts),
 * for an account the digest cannot reach by push. One habit and one check-in, nothing else: the
 * partner ask comes after the first check-in, not in the email that is trying to get one.
 */
export default (emailParams: ISendFirstHabitNudgeEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const appUrl = contextConfig.emailTemplates.appHostFull || contextConfig.parentHomepageUrl;

    const htmlConfig = {
        header: translate(locale, 'emails.firstHabitNudge.header'),
        dearUser: translate(locale, 'emails.firstHabitNudge.dearUser', { toName: templateParams.toName || '' }),
        body1: translate(locale, 'emails.firstHabitNudge.body1'),
        body2: translate(locale, 'emails.firstHabitNudge.body2'),
        buttonHref: appUrl,
        buttonText: translate(locale, 'emails.firstHabitNudge.buttonText', { brandName: contextConfig.brandName }),
        postBody1: translate(locale, 'emails.firstHabitNudge.postBody1'),
        fromEmailTitle: contextConfig.brandName,
        headerImageVariant: 'social' as const,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
