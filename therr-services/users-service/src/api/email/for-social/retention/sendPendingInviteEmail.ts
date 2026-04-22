/* eslint-disable max-len */
import sendEmail from '../../sendEmail';
import * as globalConfig from '../../../../../../../global-config';
import { getHostContext } from '../../../../constants/hostContext';
import translate from '../../../../utilities/translator';

export interface ISendPendingInviteEmailConfig {
    charset?: string;
    locale?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
    recipientIdentifiers: {
        id: string;
        accountEmail: string;
        settingsEmailInvites: boolean;
    };
}

export interface ITemplateParams {
    fromName: string;
}

export default (emailParams: ISendPendingInviteEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    if (!emailParams.recipientIdentifiers.settingsEmailInvites) {
        return Promise.resolve({});
    }

    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const htmlConfig = {
        header: translate(locale, 'emails.pendingInvite.header'),
        body1: translate(locale, 'emails.pendingInvite.body1', { fromName: templateParams.fromName, brandName: contextConfig.brandName }),
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}`,
        buttonText: `${contextConfig.brandGoLinkText}`,
        fromEmailTitle: `${templateParams.fromName}, ${contextConfig.brandName}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
