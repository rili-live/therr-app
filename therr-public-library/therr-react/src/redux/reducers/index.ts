import { combineReducers } from 'redux';
import { routerReducer as routing } from 'react-router-redux';
// import {user, users, isAuthenticated, redirectRoute} from '../library/authentication';
// import {loader} from '../library/loader';
import messages from './messages';
import moments from './moments';
import notifications from './notifications';
import userConnections from './userConnections';
import getUserReducer from './user';

export default (socketIO, additionalReducers = {}) => combineReducers({
    routing,

    // library
    // isAuthenticated,
    // loader,
    // redirectRoute,
    messages,
    moments,
    notifications,
    user: getUserReducer(socketIO),
    userConnections,
    ...additionalReducers,
});
