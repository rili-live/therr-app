/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendPendingInviteEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    fromName: string;
}

// TODO: Localize email
export default (emailParams: ISendPendingInviteEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName);

    const htmlConfig = {
        header: 'New Connection Request',
        body1: `You have a new friend request from ${templateParams.fromName} on ${contextConfig.brandName}.`,
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}`,
        buttonText: `${contextConfig.brandGoLinkText}`,
        fromEmailTitle: `${templateParams.fromName}, ${contextConfig.brandName}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
