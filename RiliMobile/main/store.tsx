import thunkMiddleware from 'redux-thunk';
import { applyMiddleware, compose, createStore } from 'redux';
import rootReducer from './redux/reducers';

export default createStore(
    rootReducer,
    {},
    compose(
        applyMiddleware(
            // socketIOMiddleWare,
            thunkMiddleware // let's us dispatch functions
        )
    )
);
