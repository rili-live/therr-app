import * as globalConfig from '../../env-config';

export default () => globalConfig[__DEV__ ? 'development' : 'production'];
