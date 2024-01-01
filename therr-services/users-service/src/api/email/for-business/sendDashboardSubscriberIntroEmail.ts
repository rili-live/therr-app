/* eslint-disable max-len */
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';

export interface ISendDashboardSubscriberIntroEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
}

export interface ITemplateParams {
    productName?: string;
}

// TODO: Localize email
export default (emailParams: ISendDashboardSubscriberIntroEmailConfig, templateParams: ITemplateParams) => {
    const linkUrl = `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`;
    const productPlanName = templateParams.productName || 'Business Marketing & Customer Metrics';
    const htmlConfig = {
        header: 'Therr For Business: Marketing & Metrics Plan',
        dearUser: 'Welcome!',
        body1: `Your business is now activated for "${productPlanName}", and your subscription will auto-renew at the end of the free trial. If you already have a dashboard account, login to manage your business space.`,
        body2: 'Otherwise, follow the link to register and get started. Claim your space and update your business details for the best results. Our marketing campaigns cater directly to your unique business needs with advance AI and automation.',
        body3: `If you have questions about the process or wish to update your plan, feel free to contact support at any time: ${process.env.AWS_FEEDBACK_EMAIL_ADDRESS}`,
        bodyBold: 'You may need to logout and log back in to see the updated account access.',
        buttonHref: linkUrl,
        buttonText: 'Login or Register',
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${linkUrl}`,
    };

    return sendEmail({
        ...emailParams,
    }, htmlConfig);
};
