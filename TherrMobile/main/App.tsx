import React from 'react';
import { LogBox } from 'react-native';
import { Provider } from 'react-redux';
import SplashScreen from 'react-native-bootsplash';
import LogRocket from '@logrocket/react-native';
import Toast, { BaseToast, ErrorToast, InfoToast } from 'react-native-toast-message';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import getStore from './getStore';
import initInterceptors from './interceptors';
import Layout from './components/Layout';
import { buttonMenuHeight } from './styles/navigation/buttonMenu';
// import { buildStyles } from './styles';

// TODO: This is temporary to ignore the really annoying ViewPropTypes log
LogBox.ignoreLogs(['ViewPropTypes']);//Ignore all log notifications

const toastConfig = {
    info: (props) => (
        <InfoToast
            {...props}
            style={{ borderLeftColor: '#1C7F8A' }}
            text1Style={{
                fontSize: 17,
                fontWeight: '600',
                fontFamily: 'Lexend-Regular',
            }}
            text2Style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
            }}
        />
    ),
    success: (props) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: '#00A624' }}
            text1Style={{
                fontSize: 17,
                fontWeight: '600',
                fontFamily: 'Lexend-Regular',
            }}
            text2Style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
            }}
        />
    ),
    successBig: (props) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: '#00A624' }}
            text1Style={{
                fontSize: 17,
                fontWeight: '600',
                fontFamily: 'Lexend-Regular',
            }}
            text2Style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
            }}
            text2NumberOfLines={3}
        />
    ),
    error: (props) => (
        <ErrorToast
            {...props}
            style={{ borderLeftColor: '#D70000' }}
            text1Style={{
                fontSize: 17,
                fontWeight: '600',
                fontFamily: 'Lexend-Regular',
            }}
            text2Style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
            }}
        />
    ),
    errorBig: (props) => (
        <ErrorToast
            {...props}
            style={{ borderLeftColor: '#D70000' }}
            text1Style={{
                fontSize: 17,
                fontWeight: '600',
                fontFamily: 'Lexend-Regular',
            }}
            text2Style={{
                fontSize: 14,
                fontFamily: 'Lexend-Regular',
            }}
            text2NumberOfLines={3}
        />
    ),
};

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
                <Toast
                    config={toastConfig}
                    position="bottom"
                    bottomOffset={buttonMenuHeight + 10}
                />
            </Provider>
        );
    }
}

export default App;
