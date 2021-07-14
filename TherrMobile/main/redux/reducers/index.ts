import getCombinedReducers from 'therr-react/redux/reducers';
import { socketIO } from '../../socket-io-middleware';
import location from './location';

const localReducers = {
    location,
};

const reducers = getCombinedReducers(socketIO, localReducers);

export default reducers;
