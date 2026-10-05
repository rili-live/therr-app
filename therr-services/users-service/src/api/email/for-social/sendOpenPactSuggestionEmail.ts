import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendOpenPactSuggestionEmailConfig {
    charset?: string;
    locale?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    toName?: string;
    habitName: string;
}

/**
 * The email half of the open-pact suggestion (handlers/helpers/openPactSuggestionDigest.ts), for a
 * creator the digest cannot reach by push. It points them back into the app, where the unanswered
 * pact itself offers the open pacts on the same habit — there is no web surface to send them to.
 */
export default (emailParams: ISendOpenPactSuggestionEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const appUrl = contextConfig.emailTemplates.appHostFull || contextConfig.parentHomepageUrl;

    const htmlConfig = {
        header: translate(locale, 'emails.openPactSuggestion.header', { habitName: templateParams.habitName }),
        dearUser: translate(locale, 'emails.openPactSuggestion.dearUser', { toName: templateParams.toName || '' }),
        body1: translate(locale, 'emails.openPactSuggestion.body1', { habitName: templateParams.habitName }),
        body2: translate(locale, 'emails.openPactSuggestion.body2', {
            habitName: templateParams.habitName,
            brandName: contextConfig.brandName,
        }),
        buttonHref: appUrl,
        buttonText: translate(locale, 'emails.openPactSuggestion.buttonText', { brandName: contextConfig.brandName }),
        postBody1: translate(locale, 'emails.openPactSuggestion.postBody1'),
        fromEmailTitle: contextConfig.brandName,
        headerImageVariant: 'social' as const,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
