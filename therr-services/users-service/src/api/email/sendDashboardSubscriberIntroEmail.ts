/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from './sendEmail';
import * as globalConfig from '../../../../../global-config';
import templateString from './template';

export interface ISendDashboardSubscriberIntroEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

export interface ITemplateParams {
    productName?: string;
}

// TODO: Localize email
export default (emailParams: ISendDashboardSubscriberIntroEmailConfig, templateParams: ITemplateParams) => {
    const template = Handlebars.compile(templateString);
    const linkUrl = `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/login`;
    const productPlanName = templateParams.productName || 'Business Marketing & Customer Metrics';
    const htmlConfig = {
        header: 'Therr For Business: Marketing & Metrics Plan',
        dearUser: 'Welcome!',
        body1: `Your business is now activated for "${productPlanName}", and your subscription will auto-renew at the end of the free trial. If you already have a dashboard account, login to manage your business space.`,
        body2: 'Otherwise, follow the link to register and get started. Claim your space and update your business details for the best results from our marketing campaigns catered directly to your unique business needs.',
        body3: `If you have questions about the process or wish to update your plan, feel free to contact support at any time: ${process.env.AWS_FEEDBACK_EMAIL_ADDRESS}`,
        buttonHref: linkUrl,
        buttonText: 'Login or Register',
        postBody1: `If you are unable to click the link, copy paste the following URL in the browser: ${linkUrl}`,
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
    });
};