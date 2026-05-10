/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
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
    claimToken: string;
    claimCode: string;
}

export default (emailParams: ISendPactInvitationEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const baseHost = contextConfig.emailTemplates.appHostFull
        || globalConfig[process.env.NODE_ENV].hostFull;
    const linkUrl = `${baseHost}/claim-pact/${templateParams.claimToken}`;

    const htmlConfig = {
        header: translate(locale, 'emails.pactInvitation.header', { fromName: templateParams.fromName }),
        dearUser: translate(locale, 'emails.pactInvitation.dearUser', { toName: templateParams.toName || '' }),
        body1: translate(locale, 'emails.pactInvitation.body1', {
            fromName: templateParams.fromName,
            habitName: templateParams.habitName,
            brandName: contextConfig.brandName,
        }),
        body2: translate(locale, 'emails.pactInvitation.body2', { brandName: contextConfig.brandName }),
        bodyBold: templateParams.claimCode,
        buttonHref: linkUrl,
        buttonText: translate(locale, 'emails.pactInvitation.buttonText', { brandName: contextConfig.brandName }),
        postBody1: translate(locale, 'emails.pactInvitation.postBody1', {
            linkUrl,
            claimCode: templateParams.claimCode,
        }),
        fromEmailTitle: `${templateParams.fromName}, ${contextConfig.brandName}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
