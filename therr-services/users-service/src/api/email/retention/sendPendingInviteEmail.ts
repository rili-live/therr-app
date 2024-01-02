/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';

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
    const htmlConfig = {
        header: 'New Connection Request',
        body1: `You have a new friend request from ${templateParams.fromName} on Therr app.`,
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}`,
        buttonText: 'Go Therr',
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
