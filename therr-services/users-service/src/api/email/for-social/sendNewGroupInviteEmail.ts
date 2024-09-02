/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendNewGroupInviteEmailConfig {
    charset?: string;
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

// TODO: Localize email
export default (emailParams: ISendNewGroupInviteEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    if (!emailParams.recipientIdentifiers.settingsEmailInvites) {
        return Promise.resolve({});
    }

    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const htmlConfig = {
        header: 'New Group Invite',
        body1: `${templateParams.fromUserName} invited you to join the group, ${templateParams.groupName}`,
        body2: 'Joining a group grants access to group chat and upcoming events. Login to check your notifications and reply to the invite.',
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/groups/${templateParams.groupId}`,
        buttonText: contextConfig.brandGoLinkText,
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${globalConfig[process.env.NODE_ENV].hostFull}/groups/${templateParams.groupId}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
