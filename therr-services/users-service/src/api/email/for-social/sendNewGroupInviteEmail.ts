/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendNewGroupInviteEmailConfig {
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
    groupName: string;
    groupId: string;
    fromUserName: string;
}

export default (emailParams: ISendNewGroupInviteEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    if (!emailParams.recipientIdentifiers.settingsEmailInvites) {
        return Promise.resolve({});
    }

    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const linkUrl = `${globalConfig[process.env.NODE_ENV].hostFull}/groups/${templateParams.groupId}`;

    const htmlConfig = {
        header: translate(locale, 'emails.newGroupInvite.header'),
        body1: translate(locale, 'emails.newGroupInvite.body1', { fromUserName: templateParams.fromUserName, groupName: templateParams.groupName }),
        body2: translate(locale, 'emails.newGroupInvite.body2'),
        buttonHref: linkUrl,
        buttonText: contextConfig.brandGoLinkText,
        postBody1: translate(locale, 'emails.newGroupInvite.postBody1', { linkUrl }),
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
