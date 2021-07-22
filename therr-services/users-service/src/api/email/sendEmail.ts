import { awsSES } from '../aws';

export interface ISendEmailConfig {
    charset?: string;
    html: string;
    subject: string;
    toAddresses: string[];
}

export default (config: ISendEmailConfig) => new Promise((resolve, reject) => {
    const params = {
        Content: {
            Simple: {
                Body: {
                    Html: {
                        Data: config.html,
                        Charset: config.charset || 'UTF-8',
                    },
                },
                Subject: {
                    Data: config.subject,
                    Charset: config.charset || 'UTF-8',
                },
            },
        },
        Destination: {
            // BccAddresses: [
            //     'STRING_VALUE',
            // ],
            // CcAddresses: [
            //     'STRING_VALUE',
            // ],
            ToAddresses: config.toAddresses,
        },
        FromEmailAddress: process.env.AWS_SES_FROM_EMAIL,
    };

    awsSES.sendEmail(params, (err, data) => {
        if (err) {
            return reject(err);
        }

        return resolve(data);
    });
});
