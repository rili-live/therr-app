import sendEmail from '../sendEmail';
import { getHostContext } from '../../../constants/hostContext';

export interface ISendCoachesWaitlistAdminEmailConfig {
    subject: string;
    agencyDomainName: string;
    brandVariation: string;
}

export interface ICoachesWaitlistAdminTemplateParams {
    email: string;
    details: Record<string, string>;
}

/**
 * Tells the founder a coach joined the habits.therr.com/coaches waitlist.
 *
 * The coach waitlist is a demand test measured in single digits, and each entry is someone to
 * reply to by hand. A row in a table nobody queries is a lead nobody answers, so every signup is
 * pushed to the same inboxes that receive new-user notifications.
 */
export default (emailParams: ISendCoachesWaitlistAdminEmailConfig, templateParams: ICoachesWaitlistAdminTemplateParams) => {
    const contextConfig = getHostContext(emailParams.agencyDomainName, emailParams.brandVariation);

    const otherEmails = (process.env.AWS_FEEDBACK_EMAIL_ADDRESS || '').split(',').filter((email) => !!email);
    const therrAdminEmails = (process.env.AWS_NOTIFY_ADMIN_EMAIL_ADDRESSES || '').split(',').filter((email) => !!email);
    const toAddresses = [...otherEmails, ...therrAdminEmails];
    if (!toAddresses.length) {
        return Promise.resolve();
    }

    const { coachingType, clientCount, monthlyBudget } = templateParams.details;
    const htmlConfig = {
        header: `${contextConfig.brandName}: New coach on the waitlist`,
        dearUser: `${templateParams.email} joined the coaches waitlist.`,
        body1: `Coaching: ${coachingType || 'not answered'}. `
            + `Clients: ${clientCount || 'not answered'}. `
            + `Would pay per month: ${monthlyBudget || 'not answered'}.`,
    };

    return sendEmail({
        ...emailParams,
        toAddresses,
    }, htmlConfig);
};
