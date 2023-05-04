import awsSDK from 'aws-sdk';
import { Storage } from '@google-cloud/storage';

awsSDK.config.apiVersions = {
    sesv2: '2019-09-27',
};

awsSDK.config.sesv2 = {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_ACCESS_KEY_SECRET,
    region: process.env.AWS_SES_REGION,
};

const awsSES = new awsSDK.SESV2();

const storage = new Storage({
    credentials: JSON.parse(Buffer.from(process.env.MAPS_SERVICE_GOOGLE_CREDENTIALS_BASE64 || 'e30=', 'base64').toString('utf8')),
});

export {
    awsSES,
    storage,
};
