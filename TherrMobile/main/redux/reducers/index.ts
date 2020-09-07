import getCombinedReducers from 'therr-react/redux/reducers';
import { socketIO } from '../../socket-io-middleware';

const reducers = getCombinedReducers(socketIO);

export default reducers;
