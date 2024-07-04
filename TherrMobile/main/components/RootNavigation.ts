import { createNavigationContainerRef } from '@react-navigation/native';
import { PartialState, StackNavigationState } from '@react-navigation/routers';
import { StackActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export class RootNavigation {
    static getCurrentRoute = () => {
        if (navigationRef.isReady()) {
            return navigationRef.getCurrentRoute();
        }
    };

    static getCurrentOptions = () => {
        if (navigationRef.isReady()) {
            return navigationRef.getCurrentOptions();
        }
    };

    static navigate = (name, params?) => {
        if (navigationRef.isReady()) {
            // Cast as never (odd bug)
            navigationRef.navigate(name as never, params as never);
        }
    };

    static replace = (name, params?) => {
        if (navigationRef.isReady()) {
            navigationRef.dispatch(StackActions.replace(name as never, params as never));
        }
    };

    static push = (name, params?) => {
        if (navigationRef.isReady()) {
            navigationRef.dispatch(StackActions.push(name as never, params as never));
        }
    };

    static reset = (state: PartialState<StackNavigationState<any>> | StackNavigationState<any>) => {
        if (navigationRef.isReady()) {
            navigationRef.reset(state);
        }
    };
}
