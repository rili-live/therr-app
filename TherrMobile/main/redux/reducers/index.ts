import getCombinedReducers from 'therr-react/redux/reducers';
import { socketIO } from '../../socket-io-middleware';
import location from './location';
import ui from './ui';

const localReducers = {
    location,
    ui,
};

const reducers = getCombinedReducers(socketIO, localReducers);

export default reducers;
