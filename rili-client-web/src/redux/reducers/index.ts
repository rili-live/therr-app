import getCombinedReducers from 'rili-react/reducers';
import { socketIO } from '../../socket-io-middleware';

const reducers = getCombinedReducers(socketIO);

export default reducers;
