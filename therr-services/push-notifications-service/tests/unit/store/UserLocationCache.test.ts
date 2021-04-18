import { expect } from 'chai';
import UserLocationCache from '../../../src/store/UserLocationCache';

describe('UserLocationCache', () => {
    it('should set a default expire', (done) => {
        const callback = () => {
            done();
        };
        const uesrLocationCache = new UserLocationCache(123, callback);
    });
});
