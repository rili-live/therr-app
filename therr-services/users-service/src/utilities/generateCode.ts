import { v4 as uuidv4 } from 'uuid'; // eslint-disable-line import/no-unresolved

export default (userAgent) => ({
    code: uuidv4(),
    type: 'email',
});
