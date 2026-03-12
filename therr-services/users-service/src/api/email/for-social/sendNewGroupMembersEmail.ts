/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';
import translate from '../../../utilities/translator';

export interface ISendNewGroupMembersEmailConfig {
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
    groupId: string;
    groupName: string;
    membersList?: string[];
}

export default (emailParams: ISendNewGroupMembersEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    if (!emailParams.recipientIdentifiers.settingsEmailInvites) {
        return Promise.resolve({});
    }

    const locale = emailParams.locale || 'en-us';
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);
    const linkUrl = `${globalConfig[process.env.NODE_ENV].hostFull}/groups/${templateParams.groupId}`;
    const membersList = templateParams.membersList?.join(', ') || '';

    const htmlConfig = {
        header: translate(locale, 'emails.newGroupMembers.header'),
        body1: templateParams.membersList?.length
            ? translate(locale, 'emails.newGroupMembers.body1WithMembers', { membersList })
            : translate(locale, 'emails.newGroupMembers.body1WithoutMembers'),
        body2: templateParams.membersList?.length
            ? translate(locale, 'emails.newGroupMembers.body2WithMembers', { membersList, groupName: templateParams.groupName })
            : translate(locale, 'emails.newGroupMembers.body2WithoutMembers', { groupName: templateParams.groupName }),
        buttonHref: linkUrl,
        buttonText: contextConfig.brandGoLinkText,
        postBody1: translate(locale, 'emails.newGroupMembers.postBody1', { linkUrl }),
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
