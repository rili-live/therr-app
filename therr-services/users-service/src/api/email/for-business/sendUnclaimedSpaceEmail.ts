/* eslint-disable quotes */
/* eslint-disable max-len */
import { MetricNames, MetricValueTypes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import sendEmail from '../sendEmail';
import * as globalConfig from '../../../../../../global-config';
import translate from '../../../utilities/translator';
import Store from '../../../store';

export interface ISendUnclaimedSpaceEmailConfig {
    charset?: string;
    locale?: string;
    subject: string;
    toAddresses: string[];
    agencyDomainName: string;
    brandVariation: string;
}

export interface ITemplateParams {
    spaceName: string;
    spaceId: string;
    missingFields?: string[];
}

/**
 * Check if an unclaimed space email has already been sent for this spaceId
 * by looking for an existing metric record.
 */
export const hasAlreadySentEmail = (spaceId: string): Promise<boolean> => Store.userMetrics.get({
    name: MetricNames.SPACE_UNCLAIMED_EMAIL_SENT,
}).then((rows) => rows.some((row) => {
    const dims = typeof row.dimensions === 'string' ? JSON.parse(row.dimensions) : row.dimensions;
    return dims?.spaceId === spaceId;
})).catch(() => false);

/**
 * Log that an unclaimed space email was sent, for dedup tracking.
 */
const logEmailSentMetric = (spaceId: string, businessEmail: string): Promise<any> => Store.userMetrics.create({
    name: MetricNames.SPACE_UNCLAIMED_EMAIL_SENT,
    userId: '', // system-level metric, no user context
    value: '1',
    valueType: MetricValueTypes.NUMBER,
    dimensions: JSON.stringify({ spaceId, businessEmail }),
}).catch((err) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Failed to log unclaimed space email metric'],
        traceArgs: {
            'error.message': err?.message,
            'space.id': spaceId,
        },
    });
});

export default async (emailParams: ISendUnclaimedSpaceEmailConfig, templateParams: ITemplateParams) => {
    const locale = emailParams.locale || 'en-us';

    // Check if email was already sent for this space
    const alreadySent = await hasAlreadySentEmail(templateParams.spaceId);
    if (alreadySent) {
        return { alreadySent: true };
    }

    const spaceUrl = `${globalConfig[process.env.NODE_ENV].hostFull}/spaces/${templateParams.spaceId}?claim=true`;
    let body3: string | undefined;
    if (templateParams.missingFields?.length) {
        const intro = translate(locale, 'emails.unclaimedSpace.missingFieldsIntro');
        const fieldLabels = templateParams.missingFields.map(
            (field) => translate(locale, `emails.unclaimedSpace.missingFieldLabels.${field}`) || field,
        );
        body3 = `${intro} ${fieldLabels.join(', ')}.`;
    }

    const htmlConfig: any = {
        header: translate(locale, 'emails.unclaimedSpace.header'),
        preheaderText: translate(locale, 'emails.unclaimedSpace.preheaderText'),
        dearUser: translate(locale, 'emails.unclaimedSpace.dearUser', { spaceName: templateParams.spaceName }),
        body1: translate(locale, 'emails.unclaimedSpace.body1', { spaceName: templateParams.spaceName }),
        body2: translate(locale, 'emails.unclaimedSpace.body2'),
        body3,
        bodyBold: translate(locale, 'emails.unclaimedSpace.bodyBold'),
        postBody1: translate(locale, 'emails.unclaimedSpace.postBody1'),
        buttonHref: spaceUrl,
        buttonText: translate(locale, 'emails.unclaimedSpace.buttonText'),
    };

    const result = await sendEmail({
        ...emailParams,
        subject: emailParams.subject || translate(locale, 'emails.unclaimedSpace.subject', { spaceName: templateParams.spaceName }),
    }, htmlConfig);

    // Log the metric after successful send (fire-and-forget)
    logEmailSentMetric(templateParams.spaceId, emailParams.toAddresses[0]);

    return result;
};
