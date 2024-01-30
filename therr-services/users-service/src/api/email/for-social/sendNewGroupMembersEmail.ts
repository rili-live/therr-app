/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendNewGroupMembersEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    recipientIdentifiers: {
        id: string;
        accountEmail: string;
        settingsEmailInvites: boolean;
    };
}

export interface ITemplateParams {
    groupName: string;
    membersList?: string[];
}

// TODO: Localize email
export default (emailParams: ISendNewGroupMembersEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    if (!emailParams.recipientIdentifiers.settingsEmailInvites) {
        return Promise.resolve({});
    }

    const contextConfig = getHostContext(emailParams.agencyDomainName);

    const htmlConfig = {
        header: 'New Member(s) Joined Your Group!',
        body1: templateParams.membersList?.length
            ? `Welcome the new member(s): ${templateParams.membersList.join(', ')}`
            : 'Welcome the new members',
        body2: templateParams.membersList?.length
            ? `New members (${templateParams.membersList.join(', ')}) recently joined your group, ${templateParams.groupName}. Login and review their requests if approval is required to join the group.`
            : `New members recently joined your group, ${templateParams.groupName}. Login and review their requests if approval is required to join the group.`,
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}/login`,
        buttonText: contextConfig.brandGoLinkText,
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${globalConfig[process.env.NODE_ENV].hostFull}/login`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
