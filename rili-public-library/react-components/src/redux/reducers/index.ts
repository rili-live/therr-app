import { combineReducers } from 'redux';
import { routerReducer as routing } from 'react-router-redux';
// import {user, users, isAuthenticated, redirectRoute} from '../library/authentication';
// import {loader} from '../library/loader';
import notifications from './notifications';
import socket from './socket';
import userConnections from './userConnections';
import getUserReducer from './user';

export default (socketIO) => combineReducers({
    routing,
    socket,

    // library
    // isAuthenticated,
    // loader,
    // redirectRoute,
    notifications,
    user: getUserReducer(socketIO),
    userConnections,
});
