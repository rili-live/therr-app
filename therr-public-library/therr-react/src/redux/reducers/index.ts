import { combineReducers } from 'redux';
import { routerReducer as routing } from 'react-router-redux';
// import {user, users, isAuthenticated, redirectRoute} from '../library/authentication';
// import {loader} from '../library/loader';
import campaigns from './campaigns';
import content from './content';
import forums from './forums';
import habits from './habits';
import messages from './messages';
import map from './map';
import notifications from './notifications';
import reactions from './reactions';
import userConnections from './userConnections';
import userInterface from './userInterface';
import getUserReducer from './user';

export default (socketIO, additionalReducers = {}) => combineReducers({
    routing,

    // library
    // isAuthenticated,
    // loader,
    // redirectRoute,
    campaigns,
    content,
    forums,
    habits,
    messages,
    map,
    notifications,
    reactions,
    user: getUserReducer(socketIO),
    userConnections,
    userInterface,
    ...additionalReducers,
});
