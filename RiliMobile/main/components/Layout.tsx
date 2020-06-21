import React from 'react';
import { UsersService } from 'rili-react/services';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import 'react-native-gesture-handler';
import routes from '../routes';
import { theme } from '../styles';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

const Stack = createStackNavigator();

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({}, dispatch);

class Layout extends React.Component<any, any> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    render() {
        const { user } = this.props;

        return (
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
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Layout);
