/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendPactInvitationEmailConfig {
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
}

export default (emailParams: ISendPactInvitationEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const { claimUrl, claimCode } = templateParams;
    const hasCode = !!claimCode;

    const htmlConfig = {
        header: translate(locale, 'emails.pactInvitation.header', { fromName: templateParams.fromName }),
        dearUser: translate(locale, 'emails.pactInvitation.dearUser', { toName: templateParams.toName || '' }),
        body1: translate(locale, 'emails.pactInvitation.body1', {
            fromName: templateParams.fromName,
            habitName: templateParams.habitName,
            brandName: contextConfig.brandName,
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
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
