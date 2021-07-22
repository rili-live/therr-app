import { UsersActions } from 'therr-react/redux/actions';
import { socketIO } from '../../socket-io-middleware';

export default new UsersActions(socketIO);
