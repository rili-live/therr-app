import { Storage } from '@google-cloud/storage';
import { SESv2 } from '@aws-sdk/client-sesv2';

const awsSES = new SESv2({
    apiVersion: 'latest',
    region: process.env.AWS_SES_REGION,
    credentials: {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SES_ACCESS_KEY_SECRET || '',
    },
});

const storage = new Storage({
    credentials: JSON.parse(Buffer.from(process.env.MAPS_SERVICE_GOOGLE_CREDENTIALS_BASE64 || 'e30=', 'base64').toString('utf8')),
});

export {
    awsSES,
    storage,
};
