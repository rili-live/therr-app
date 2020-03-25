import { combineReducers } from 'redux';
import { routerReducer as routing } from 'react-router-redux';
// import {user, users, isAuthenticated, redirectRoute} from '../library/authentication';
// import {loader} from '../library/loader';
import socket from './socket';
import user from './user';
import userConnections from './userConnections';

export default combineReducers({
    routing,
    socket,

    // library
    // isAuthenticated,
    // loader,
    // redirectRoute,
    user,
    userConnections,
});
