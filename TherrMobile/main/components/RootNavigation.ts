import { createNavigationContainerRef } from '@react-navigation/native';
import { PartialState, State } from '@react-navigation/routers';
import { StackActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export class RootNavigation {
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

    static reset = (state: PartialState<State> | State) => {
        if (navigationRef.isReady()) {
            navigationRef.reset(state);
        }
    };
}
