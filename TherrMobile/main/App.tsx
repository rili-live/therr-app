import React from 'react';
import { Provider } from 'react-redux';
import SplashScreen from 'react-native-bootsplash';
import LogRocket from '@logrocket/react-native';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import getStore from './getStore';
import initInterceptors from './interceptors';
import Layout from './components/Layout';
// import { buildStyles } from './styles';

class App extends React.Component<any, any> {
    private store;
    // private theme = buildStyles()''

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
        };

        // changeNavigationBarColor(therrTheme.colors.primary, false, true);
    }

    componentDidMount() {
        this.loadStorage();

        LogRocket.init('pibaqj/therr-app-mobile', {
            network: {
                requestSanitizer: request => {
                    if (request.headers.authorization) {
                        request.headers.authorization = '';
                    }
                    if (request.body?.toString().includes('password')) {
                        request.body = '';
                    }

                    return request;
                },
                responseSanitizer: response => {
                    if (response.body?.toString().includes('password') || response.body?.toString().includes('idToken')) {
                        response.body = '';
                    }

                    return response;
                },
            },
            console: {
                shouldAggregateConsoleErrors: true,
            },
            redactionTags: ['RedactionString'],
        });
    }

    loadStorage = () => {
        getStore().then((response) => {
            this.store = response;
            initInterceptors(this.store);

            this.setState({
                isLoading: false,
            }, () => SplashScreen.hide({ fade: true }));
        }).catch((err) => {
            console.log(err);
        });
    };

    render() {
        const { isLoading } = this.state;

        if (isLoading || !this.store) {
            return null;
        }

        return (
            <Provider store={this.store}>
                <Layout />
            </Provider>
        );
    }
}

export default App;
