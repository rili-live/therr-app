import awsSDK from 'aws-sdk';

awsSDK.config.apiVersions = {
    sesv2: '2019-09-27',
};

awsSDK.config.sesv2 = {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_ACCESS_KEY_SECRET,
    region: process.env.AWS_SES_REGION,
};

const awsSES = new awsSDK.SESV2();

export {
    awsSES,
};
