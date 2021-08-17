/* eslint-disable max-len */
import Handlebars from 'handlebars';
import sendEmail from './sendEmail';
// import * as globalConfig from '../../../../../global-config';
import templateString from './template';

export interface ISendSubscriberVerificationEmailConfig {
    charset?: string;
    subject: string;
    toAddresses: string[];
}

// export interface ITemplateParams {}

export default (emailParams: ISendSubscriberVerificationEmailConfig, templateParams: any) => {
    const template = Handlebars.compile(templateString);
    const htmlConfig = {
        header: 'Therr App: Subscribed to Updates',
        dearUser: 'Welcome!',
        body1: 'You were successfully subscribed to our general updates channel. We\'ll only send updates for big events to keep you in the loop.',
    };
    const html = template(htmlConfig);

    return sendEmail({
        ...emailParams,
        html,
    });
};
