import React from 'react';
import { Provider } from 'shared/react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import 'react-native-gesture-handler';
import store from './store';
import routes from './routes';
import { theme } from './styles';

const Stack = createStackNavigator();

export const isAuthorized = (route) => {
    return !route.options.access;
};

const App = () => {
    return (
        <Provider store={store}>
            <NavigationContainer theme={theme}>
                <Stack.Navigator>
                    {routes
                        .filter((route) => isAuthorized(route))
                        .map((route) => {
                            return <Stack.Screen key={route.name} {...route} />;
                        })}
                </Stack.Navigator>
            </NavigationContainer>
        </Provider>
    );
};

export default App;
