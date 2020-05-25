import getCombinedReducers from 'rili-public-library/react/reducers.js';
import { socketIO } from '../../socket-io-middleware';

const reducers = getCombinedReducers(socketIO);

export default reducers;
