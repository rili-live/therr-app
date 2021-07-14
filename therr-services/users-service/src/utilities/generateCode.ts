import { v4 as uuidv4 } from 'uuid'; // eslint-disable-line import/no-unresolved

export default (userAgent) => {
    const code = uuidv4();
    return {
        code,
        type: userAgent.type,
        token: Buffer.from(JSON.stringify({
            code,
            email: userAgent.email,
            type: userAgent.type,
        }), 'utf-8').toString('base64'),
    };
};
