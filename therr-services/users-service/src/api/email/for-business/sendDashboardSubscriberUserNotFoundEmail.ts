/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';

export interface ISendDashboardSubscriberUserNotFoundEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    recipientIdentifiers: {
        id: string;
        accountEmail: string;
    };
}

export interface ITemplateParams {
    productName?: string;
}

// TODO: Localize email
export default (emailParams: ISendDashboardSubscriberUserNotFoundEmailConfig, templateParams: ITemplateParams) => {
    const linkUrl = `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`;
    const htmlConfig = {
        header: 'Subscriber Missing Email | Not Found',
        dearUser: 'Hello,',
        body1: 'The e-mail you provided when subscribing to Therr for Business was not found in our database.',
        body2: 'If you have not yet created a dashboard account, please do so now and/or let us know the e-mail you used to sign up.',
        body3: 'This will allow us to grant subscriber access to your account. We will notify you when this is complete so you can access the full features of the app.',
        buttonHref: linkUrl,
        buttonText: 'Go To Dashboard',
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${linkUrl}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
