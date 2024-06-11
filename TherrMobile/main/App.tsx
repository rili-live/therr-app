import React from 'react';
import { Provider } from 'react-redux';
import LogRocket from '@logrocket/react-native';
import analytics from '@react-native-firebase/analytics';
import Toast, { BaseToast, ErrorToast, InfoToast } from 'react-native-toast-message';
import { enableLatestRenderer } from 'react-native-maps';
import {
    SpotlightTourProvider,
} from 'react-native-spotlight-tour';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import getStore from './getStore';
import initInterceptors from './interceptors';
import Layout from './components/Layout';
import { buttonMenuHeight } from './styles/navigation/buttonMenu';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import spacingStyles from './styles/layouts/spacing';
import { HEADER_HEIGHT_MARGIN } from './styles';
import getTourSteps from './TourSteps';

// Disable in development
analytics().setAnalyticsCollectionEnabled(!__DEV__);

enableLatestRenderer();

// import { buildStyles } from './styles';

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
    warnBig: (props) => (
        <ErrorToast
            {...props}
            style={{ borderLeftColor: '#FDBD2E' }}
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

        if (!__DEV__) {
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
    }

    loadStorage = () => {
        getStore().then((response) => {
            this.store = response;
            initInterceptors(this.store);

            this.setState({
                isLoading: false,
            });
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
                <GestureHandlerRootView style={spacingStyles.flexOne}>
                    <SpotlightTourProvider
                        steps={getTourSteps({
                            locale: this.store.getState()?.user?.settings?.locale || 'en-us',
                        })}
                        onBackdropPress="continue" // In case the tour gets stuck
                        overlayColor={'gray'}
                        overlayOpacity={0.4}
                        // This configurations will apply to all steps
                        floatingProps={{
                            placement: 'bottom',
                        }}
                    >
                        {
                            ({ start }) => <Layout startNavigationTour={start} />
                        }
                    </SpotlightTourProvider>
                </GestureHandlerRootView>
                <Toast
                    config={toastConfig}
                    position="bottom"
                    bottomOffset={buttonMenuHeight + 10}
                    topOffset={HEADER_HEIGHT_MARGIN + 30}
                />
            </Provider>
        );
    }
}

export default App;
