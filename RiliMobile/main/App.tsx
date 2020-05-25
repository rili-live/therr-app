/// <reference path="../../node_modules/@types/react-redux" />
import React from 'react';
import { Provider } from 'shared/react-redux';
import UsersService from 'rili-react/UsersService';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import 'react-native-gesture-handler';
import store from './store';
import routes from './routes';
import { theme } from './styles';

const Stack = createStackNavigator();

const App = () => {
    const user = store.getState().user;

    return (
        <Provider store={store}>
            <NavigationContainer theme={theme}>
                <Stack.Navigator>
                    {routes
                        .filter(
                            (route: any) =>
                                !(route.options && route.options.access) ||
                                UsersService.isAuthorized(
                                    route.options.access,
                                    user
                                )
                        )
                        .map((route: any) => {
                            if (route.options) {
                                delete route.options.access;
                            }
                            return <Stack.Screen key={route.name} {...route} />;
                        })}
                </Stack.Navigator>
            </NavigationContainer>
        </Provider>
    );
};

export default App;
