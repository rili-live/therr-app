import { awsSES } from '../aws';

export default (user: any) => new Promise((resolve, reject) => {
    // TODO: RAUTO-7: Fill in values
    const params = {
        Content: {
            Simple: {
                Body: {
                    Html: {
                        Data: 'STRING_VALUE',
                        Charset: 'STRING_VALUE',
                    },
                    Text: {
                        Data: 'STRING_VALUE',
                        Charset: 'STRING_VALUE',
                    },
                },
                Subject: {
                    Data: 'STRING_VALUE',
                    Charset: 'STRING_VALUE',
                },
            },
        },
        Destination: {
            BccAddresses: [
                'STRING_VALUE',
            ],
            CcAddresses: [
                'STRING_VALUE',
            ],
            ToAddresses: [
                'STRING_VALUE',
            ],
        },
    };

    awsSES.sendEmail(params, (err, data) => {
        if (err) {
            return reject(err);
        }

        return resolve(data);
    });
});
