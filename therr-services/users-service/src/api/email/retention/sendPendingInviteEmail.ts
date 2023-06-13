/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import templateString from '../template';

export interface ISendPendingInviteEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    fromName: string;
}

// TODO: Localize email
export default (emailParams: ISendPendingInviteEmailConfig, templateParams: ITemplateParams, isDashboardRegistration = false) => {
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'New Connection Request',
        body1: `You have a new friend request from ${templateParams.fromName} on Therr app.`,
        buttonHref: `${globalConfig[process.env.NODE_ENV].hostFull}`,
        buttonText: 'Go Therr',
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
    });
};
